import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SVG renderer for `RenderFrame`s produced by the fretboard presenter.
 *
 * This is deliberately a *dumb* renderer: it consumes only the frame's data and
 * hints, never music theory. All decisions (what colour, what label, which
 * positions) were made upstream in core + presenter. That is what lets us swap in
 * Canvas/WebGL/Skia renderers later without touching a note of logic, and what
 * makes snapshot-testing frames meaningful.
 *
 * Visual features wired up here:
 *   - strings, frets, nut, inlay markers (the instrument "body")
 *   - pattern markers with degree/letter text, root emphasis, ghost duplicates
 *   - glow effect via SVG filters (driven by `Effect`)
 *   - connectors: blob / hull / bracket / arrow-fan / path / ring
 *   - layer visibility + opacity from `RenderLayer`
 */
import { useMemo } from 'react';
function hintsOf(frame) {
    const h = frame.hints;
    return {
        cellW: Number(h.cellW ?? 46),
        cellH: Number(h.cellH ?? 40),
        padX: Number(h.padX ?? 28),
        padY: Number(h.padY ?? 24),
        labelH: Number(h.labelH ?? 26),
        rowStart: Number(h.rowStart ?? 0),
        rowEnd: Number(h.rowEnd ?? 5),
        colStart: Number(h.colStart ?? 0),
        colEnd: Number(h.colEnd ?? 12),
    };
}
function centerOf(marker, h) {
    return {
        x: h.padX + (marker.position.col - h.colStart) * h.cellW + h.cellW / 2,
        y: h.padY + (marker.position.row - h.rowStart) * h.cellH + h.cellH / 2,
    };
}
const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE_INLAY = new Set([12, 24]);
function convexHull(points) {
    if (points.length < 3)
        return [...points];
    const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
            lower.pop();
        lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
            upper.pop();
        upper.push(p);
    }
    upper.pop();
    lower.pop();
    return [...lower, ...upper];
}
/** Smooth closed path through points (Catmull-Rom → cubic Bézier). */
function blobPath(points, inflate) {
    const n = points.length;
    if (n === 0)
        return '';
    if (n === 1) {
        const p = points[0];
        return `M ${p.x - inflate} ${p.y} a ${inflate} ${inflate} 0 1 0 ${inflate * 2} 0 a ${inflate} ${inflate} 0 1 0 ${-inflate * 2} 0 Z`;
    }
    if (n === 2) {
        const [a, b] = points;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * inflate;
        const oy = (dx / len) * inflate;
        return `M ${a.x + ox} ${a.y + oy} L ${b.x + ox} ${b.y + oy} A ${inflate} ${inflate} 0 0 1 ${b.x - ox} ${b.y - oy} L ${a.x - ox} ${a.y - oy} A ${inflate} ${inflate} 0 0 1 ${a.x + ox} ${a.y + oy} Z`;
    }
    const at = (i) => points[((i % n) + n) % n];
    let d = `M ${at(0).x} ${at(0).y}`;
    for (let i = 0; i < n; i++) {
        const p0 = at(i - 1);
        const p1 = at(i);
        const p2 = at(i + 1);
        const p3 = at(i + 2);
        const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
        const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
        d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
    }
    return `${d} Z`;
}
function ConnectorShape({ c, h }) {
    const { group, points, anchor } = c;
    const color = group.color;
    const stroke = { stroke: color, strokeWidth: 2, fill: 'none' };
    switch (group.kind) {
        case 'hull': {
            const hull = convexHull(points);
            if (hull.length < 3)
                return null;
            const poly = hull.map((p) => `${p.x},${p.y}`).join(' ');
            return (_jsxs("g", { opacity: 0.5, children: [_jsx("polygon", { points: poly, fill: color, fillOpacity: 0.1, stroke: color, strokeWidth: 1.5, strokeDasharray: "4 3" }), _jsx("text", { x: hull[0].x, y: hull[0].y - 8, fontSize: 10, fill: color, children: group.label })] }));
        }
        case 'bracket': {
            const minY = Math.min(...points.map((p) => p.y));
            const maxY = Math.max(...points.map((p) => p.y));
            const minX = Math.min(...points.map((p) => p.x)) - h.cellW * 0.35;
            const maxX = Math.max(...points.map((p) => p.x)) + h.cellW * 0.35;
            return (_jsxs("g", { ...stroke, opacity: 0.7, children: [_jsx("path", { d: `M ${minX} ${maxY + h.cellH * 0.55} q ${(maxX - minX) / 2} 14 ${maxX - minX} 0` }), _jsx("text", { x: (minX + maxX) / 2, y: maxY + h.cellH * 0.95, fontSize: 10, fill: color, stroke: "none", textAnchor: "middle", children: group.label })] }));
        }
        case 'arrow-fan': {
            if (!anchor)
                return null;
            return (_jsx("g", { opacity: 0.75, children: points.map((p, i) => (_jsx("line", { x1: anchor.x, y1: anchor.y, x2: p.x, y2: p.y, stroke: color, strokeWidth: 1.5, markerEnd: "url(#mpg-arrow)" }, i))) }));
        }
        case 'path': {
            const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return _jsx("path", { d: d, ...stroke, strokeLinecap: "round", strokeLinejoin: "round", opacity: 0.8 });
        }
        case 'ring': {
            if (points.length === 0)
                return null;
            const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
            const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
            const r = Math.max(...points.map((p) => Math.hypot(p.x - cx, p.y - cy))) + h.cellW * 0.4;
            return _jsx("circle", { cx: cx, cy: cy, r: r, ...stroke, strokeDasharray: "6 4", opacity: 0.5 });
        }
        case 'blob':
        default: {
            const hull = points.length > 3 ? convexHull(points) : [...points];
            const d = blobPath(hull, Math.min(h.cellW, h.cellH) * 0.55);
            return (_jsx("g", { children: _jsx("path", { d: d, fill: color, fillOpacity: 0.12, stroke: color, strokeOpacity: 0.6, strokeWidth: 2 }) }));
        }
    }
}
function Marker({ m, h, onClick }) {
    const { x, y } = centerOf(m, h);
    const r = (Math.min(h.cellW, h.cellH) * 0.38) * (m.scale ?? 1);
    const c = m.content;
    const alpha = m.alpha ?? 1;
    const glowing = m.effect && m.effect.kind === 'glow';
    return (_jsxs("g", { opacity: alpha, style: { cursor: onClick ? 'pointer' : 'default' }, onClick: onClick ? () => onClick(m.position.id) : undefined, children: [glowing && (_jsx("circle", { cx: x, cy: y, r: r * 1.6, fill: c.fill, opacity: 0.35, filter: "url(#mpg-glow)", children: _jsx("animate", { attributeName: "opacity", values: "0.2;0.5;0.2", dur: `${1 / (m.effect?.rate ?? 0.6)}s`, repeatCount: "indefinite" }) })), _jsx("circle", { cx: x, cy: y, r: r, fill: c.fill, stroke: c.stroke, strokeWidth: c.isRoot ? 2.5 : 1 }), c.text && (_jsx("text", { x: x, y: c.sub ? y - 1 : y + 4, textAnchor: "middle", fontSize: r * 1.05, fontWeight: c.isRoot ? 800 : 600, fill: c.isRoot ? '#1a1400' : '#0c0f12', style: { pointerEvents: 'none', userSelect: 'none' }, children: c.text })), c.sub && (_jsx("text", { x: x, y: y + r * 0.85, textAnchor: "middle", fontSize: r * 0.55, fill: "#0c0f12", opacity: 0.85, style: { pointerEvents: 'none', userSelect: 'none' }, children: c.sub }))] }));
}
export function FrameSvg({ frame, onMarkerClick, className }) {
    const h = useMemo(() => hintsOf(frame), [frame]);
    const rows = h.rowEnd - h.rowStart + 1;
    const cols = h.colEnd - h.colStart + 1;
    const bodyVisible = frame.layers.find((l) => l.id === 'body')?.visible ?? true;
    const patternsVisible = frame.layers.find((l) => l.id === 'patterns')?.visible ?? true;
    const connectorsVisible = frame.layers.find((l) => l.id === 'connectors')?.visible ?? true;
    const stringLines = useMemo(() => {
        const out = [];
        for (let row = h.rowStart; row <= h.rowEnd; row++) {
            out.push({
                y: h.padY + (row - h.rowStart) * h.cellH + h.cellH / 2,
                key: `string-${row}`,
            });
        }
        return out;
    }, [h]);
    const fretLines = useMemo(() => {
        const out = [];
        for (let col = h.colStart; col <= h.colEnd + 1; col++) {
            out.push({
                x: h.padX + (col - h.colStart) * h.cellW,
                key: `fret-${col}`,
                nut: col === 0,
            });
        }
        return out;
    }, [h]);
    // Markers split into background dots vs pattern markers.
    const background = frame.markers.filter((m) => !m.patternId);
    const foreground = frame.markers.filter((m) => m.patternId);
    return (_jsxs("svg", { className: className, width: frame.width, height: frame.height, viewBox: `0 0 ${frame.width} ${frame.height}`, role: "img", "aria-label": `${frame.instrumentId} visualization (${frame.mode} notation)`, children: [_jsxs("defs", { children: [_jsxs("filter", { id: "mpg-glow", x: "-80%", y: "-80%", width: "260%", height: "260%", children: [_jsx("feGaussianBlur", { stdDeviation: "6", result: "blur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "blur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] }), _jsx("marker", { id: "mpg-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: _jsx("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "context-stroke" }) })] }), _jsx("rect", { x: 0, y: 0, width: frame.width, height: frame.height, fill: frame.palette.canvas, rx: 10 }), bodyVisible && (_jsxs("g", { children: [fretLines.map((f) => (_jsx("line", { x1: f.x, y1: h.padY, x2: f.x, y2: h.padY + rows * h.cellH, stroke: f.nut ? '#e8e8e8' : '#5a626c', strokeWidth: f.nut ? 4 : 1.5 }, f.key))), stringLines.map((s) => (_jsx("line", { x1: h.padX, y1: s.y, x2: h.padX + cols * h.cellW, y2: s.y, stroke: "#8d97a5", strokeWidth: 1.2 }, s.key))), INLAY_FRETS.filter((f) => f >= h.colStart && f <= h.colEnd).map((f) => {
                        const x = h.padX + (f - h.colStart) * h.cellW + h.cellW / 2;
                        const midY = h.padY + (rows * h.cellH) / 2;
                        const dot = (yy, key) => (_jsx("circle", { cx: x, cy: yy, r: 4, fill: "#3d444d" }, key));
                        return DOUBLE_INLAY.has(f)
                            ? [dot(midY - h.cellH, `inlay-${f}-a`), dot(midY + h.cellH, `inlay-${f}-b`)]
                            : dot(midY, `inlay-${f}`);
                    }), Array.from({ length: cols }, (_, i) => i + h.colStart).map((f) => (_jsx("text", { x: h.padX + (f - h.colStart) * h.cellW + h.cellW / 2, y: frame.height - h.labelH / 2, textAnchor: "middle", fontSize: 11, fill: INLAY_FRETS.includes(f) ? '#cfd6df' : '#6b7480', fontWeight: INLAY_FRETS.includes(f) ? 700 : 400, children: f }, `fn-${f}`)))] })), connectorsVisible && (_jsx("g", { children: frame.connectors.map((c) => (_jsx(ConnectorShape, { c: c, h: h }, c.group.id))) })), _jsx("g", { children: background.map((m) => _jsx(Marker, { m: m, h: h }, m.position.id)) }), patternsVisible && (_jsx("g", { children: foreground.map((m) => _jsx(Marker, { m: m, h: h, onClick: onMarkerClick }, m.position.id)) }))] }));
}
//# sourceMappingURL=FrameSvg.js.map