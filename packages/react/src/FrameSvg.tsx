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
import type { MarkerShape, RenderConnector, RenderFrame, RenderMarker } from '@mpg/core';

export interface FrameSvgProps {
  readonly frame: RenderFrame;
  /** Optional interaction hook — ids are position ids. */
  onMarkerClick?: (positionId: string) => void;
  className?: string;
}

interface Hints {
  cellW: number;
  cellH: number;
  padX: number;
  padY: number;
  labelH: number;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  /** True when the instrument is a fixed-pitch semitone grid (keyboard view). */
  keyboard: boolean;
  lowMidi: number;
}

function hintsOf(frame: RenderFrame): Hints {
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
    keyboard: Boolean(h.keyboard ?? false),
    lowMidi: Number(h.lowMidi ?? NaN),
  };
}

function centerOf(marker: RenderMarker, h: Hints): { x: number; y: number } {
  const laneOffset = h.keyboard && marker.position.row === 1 ? 0.5 : 0;
  return {
    x: h.padX + (marker.position.col - h.colStart + laneOffset) * h.cellW + h.cellW / 2,
    y: h.padY + (marker.position.row - h.rowStart) * h.cellH + h.cellH / 2,
  };
}

const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE_INLAY = new Set([12, 24]);

function convexHull(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return [...points];
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

/** Smooth closed path through points (Catmull-Rom → cubic Bézier). */
function blobPath(points: readonly { x: number; y: number }[], inflate: number): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) {
    const p = points[0]!;
    return `M ${p.x - inflate} ${p.y} a ${inflate} ${inflate} 0 1 0 ${inflate * 2} 0 a ${inflate} ${inflate} 0 1 0 ${-inflate * 2} 0 Z`;
  }
  if (n === 2) {
    const [a, b] = points as [{ x: number; y: number }, { x: number; y: number }];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * inflate;
    const oy = (dx / len) * inflate;
    return `M ${a.x + ox} ${a.y + oy} L ${b.x + ox} ${b.y + oy} A ${inflate} ${inflate} 0 0 1 ${b.x - ox} ${b.y - oy} L ${a.x - ox} ${a.y - oy} A ${inflate} ${inflate} 0 0 1 ${a.x + ox} ${a.y + oy} Z`;
  }
  const at = (i: number) => points[((i % n) + n) % n]!;
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


function pointInPolygon(pt: { x: number; y: number }, poly: readonly { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/** Grid cell centres enclosed by a group's hull — used to reject foreign notes. */
function cellsInsideHull(
  points: readonly { x: number; y: number }[],
  h: Hints,
): Set<string> {
  const out = new Set<string>();
  if (points.length < 3) return out;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const c0 = Math.max(h.colStart, Math.floor((minX - h.padX) / h.cellW));
  const c1 = Math.min(h.colEnd, Math.ceil((maxX - h.padX) / h.cellW));
  const r0 = Math.max(h.rowStart, Math.floor((minY - h.padY) / h.cellH));
  const r1 = Math.min(h.rowEnd, Math.ceil((maxY - h.padY) / h.cellH));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const cx = h.padX + (col - h.colStart) * h.cellW + h.cellW / 2;
      const cy = h.padY + (row - h.rowStart) * h.cellH + h.cellH / 2;
      if (pointInPolygon({ x: cx, y: cy }, points)) out.add(`${row}:${col}`);
    }
  }
  return out;
}

function ConnectorShape({ c, h }: { c: RenderConnector; h: Hints }) {
  const { group, points, anchor } = c;
  const color = group.color;
  const stroke = { stroke: color, strokeWidth: 2, fill: 'none' } as const;
  switch (group.kind) {
    case 'hull': {
      const hull = convexHull(points);
      if (hull.length < 3) return null;
      const poly = hull.map((p) => `${p.x},${p.y}`).join(' ');
      return (
        <g opacity={0.5}>
          <polygon points={poly} fill={color} fillOpacity={0.1} stroke={color} strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={hull[0]!.x} y={hull[0]!.y - 8} fontSize={10} fill={color}>{group.label}</text>
        </g>
      );
    }
    case 'bracket': {
      const minY = Math.min(...points.map((p) => p.y));
      const maxY = Math.max(...points.map((p) => p.y));
      const minX = Math.min(...points.map((p) => p.x)) - h.cellW * 0.35;
      const maxX = Math.max(...points.map((p) => p.x)) + h.cellW * 0.35;
      return (
        <g {...stroke} opacity={0.7}>
          <path d={`M ${minX} ${maxY + h.cellH * 0.55} q ${(maxX - minX) / 2} 14 ${maxX - minX} 0`} />
          <text x={(minX + maxX) / 2} y={maxY + h.cellH * 0.95} fontSize={10} fill={color} stroke="none" textAnchor="middle">
            {group.label}
          </text>
        </g>
      );
    }
    case 'arrow-fan': {
      if (!anchor) return null;
      return (
        <g opacity={0.75}>
          {points.map((p, i) => (
            <line key={i} x1={anchor.x} y1={anchor.y} x2={p.x} y2={p.y} stroke={color} strokeWidth={1.5} markerEnd="url(#mpg-arrow)" />
          ))}
        </g>
      );
    }
    case 'path': {
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return <path d={d} {...stroke} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />;
    }
    case 'ring': {
      if (points.length === 0) return null;
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      const r = Math.max(...points.map((p) => Math.hypot(p.x - cx, p.y - cy))) + h.cellW * 0.4;
      return <circle cx={cx} cy={cy} r={r} {...stroke} strokeDasharray="6 4" opacity={0.5} />;
    }
    case 'blob':
    default: {
      // The blob is a smoothed convex hull of the *member* points only — it
      // never grows beyond them, so notes outside the set stay outside the
      // shape. `cellsInsideHull` gives the renderer an exact membership mask
      // (used via data attributes for hit-testing/tooling).
      const hull = points.length > 3 ? convexHull(points) : [...points];
      const d = blobPath(hull, Math.min(h.cellW, h.cellH) * 0.45);
      const mask = cellsInsideHull(hull, h);
      return (
        <g>
          <path
            d={d}
            fill={color}
            fillOpacity={0.12}
            stroke={color}
            strokeOpacity={0.6}
            strokeWidth={2}
            data-members={Array.from(mask).join(' ')}
          />
        </g>
      );
    }
  }
}

/**
 * SVG path for the configurable marker shapes (shape palette). Returns null for
 * 'disc' so the caller keeps using a plain <circle> (cheaper + round stroke).
 */
export function shapePathFor(shape: MarkerShape, x: number, y: number, r: number): string | null {
  const poly = (n: number, rotDeg: number, radii?: number[]): string => {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const rad = radii ? radii[i % radii.length]! : r;
      const a = ((rotDeg + (360 / n) * i) * Math.PI) / 180;
      pts.push(`${(x + rad * Math.cos(a)).toFixed(2)} ${(y + rad * Math.sin(a)).toFixed(2)}`);
    }
    return `M ${pts.join(' L ')} Z`;
  };
  switch (shape) {
    case 'disc':
      return null;
    case 'hexagon':
      return poly(6, -90);
    case 'octagon':
      return poly(8, -90 + 22.5);
    case 'square':
      return poly(4, -45);
    case 'diamond':
      return `M ${x} ${y - r} L ${x + r * 0.78} ${y} L ${x} ${y + r} L ${x - r * 0.78} ${y} Z`;
    case 'star': {
      // 5-point star: alternating outer/inner radii.
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = ((-90 + 36 * i) * Math.PI) / 180;
        pts.push(`${(x + rad * Math.cos(a)).toFixed(2)} ${(y + rad * Math.sin(a)).toFixed(2)}`);
      }
      return `M ${pts.join(' L ')} Z`;
    }
    case 'cloud': {
      // Four overlapping arcs forming a puffy cloud silhouette.
      const rr = r * 0.62;
      return (
        `M ${x - r} ${y + rr * 0.4} ` +
        `A ${rr} ${rr} 0 1 1 ${x - rr * 0.5} ${y - rr * 0.9} ` +
        `A ${rr} ${rr} 0 1 1 ${x + rr * 0.6} ${y - rr * 0.8} ` +
        `A ${rr} ${rr} 0 1 1 ${x + r} ${y + rr * 0.4} ` +
        `A ${rr * 1.2} ${rr * 0.7} 0 0 1 ${x - r} ${y + rr * 0.4} Z`
      );
    }
    default:
      return null;
  }
}

function Marker({ m, h, onClick }: { m: RenderMarker; h: Hints; onClick?: (id: string) => void }) {
  const { x, y } = centerOf(m, h);
  const r = (Math.min(h.cellW, h.cellH) * 0.38) * (m.scale ?? 1);
  // Label font size and halo thickness are independently configurable so users
  // can enlarge small degree/interval text without growing the dot itself.
  const fontScale = m.fontSizeScale ?? 1;
  const haloScale = m.haloWidthScale ?? 1;
  const c = m.content;
  const alpha = m.alpha ?? 1;
  const glowing = m.effect && m.effect.kind === 'glow';
  // Halo colour: the canvas (background) colour makes the stroke "cut out" of
  // whatever sits behind the text — wood, blobs, ghosts — so labels stay
  // legible on any background without an opaque plate.
  const haloColor = m.content.halo ?? '#f5f7fa';
  const shapePath = shapePathFor(m.shape ?? 'disc', x, y, r);
  return (
    <g
      opacity={alpha}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick ? () => onClick(m.position.id) : undefined}
    >
      {glowing && (
        <circle cx={x} cy={y} r={r * 1.6} fill={c.fill} opacity={0.35} filter="url(#mpg-glow)">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur={`${1 / (m.effect?.rate ?? 0.6)}s`} repeatCount="indefinite" />
        </circle>
      )}
      {shapePath ? (
        <path d={shapePath} fill={c.fill} stroke={c.stroke} strokeWidth={c.isRoot ? 2.5 : 1} />
      ) : (
        <circle cx={x} cy={y} r={r} fill={c.fill} stroke={c.stroke} strokeWidth={c.isRoot ? 2.5 : 1} />
      )}
      {/* Labels sit directly on the marker with a thick contrasting halo
          (paint-order stroke) instead of an opaque plate — readable against
          any background: wood, connector blobs, ghost dots, or glow. */}
      {c.text && (
        <text
          x={x}
          y={c.sub ? y - 1 : y + 4}
          textAnchor="middle"
          fontSize={r * 1.05 * fontScale}
          fontWeight={c.isRoot ? 800 : 600}
          fill={c.isRoot ? '#1a1400' : '#0c0f12'}
          stroke={haloColor}
          strokeWidth={Math.max(1.5, r * 0.3) * haloScale}
          strokeLinejoin="round"
          style={{ paintOrder: 'stroke', pointerEvents: 'none', userSelect: 'none' }}
        >
          {c.text}
        </text>
      )}
      {c.sub && (
        <text
          x={x}
          y={y + r * 0.85}
          textAnchor="middle"
          fontSize={r * 0.55 * fontScale}
          fill="#0c0f12"
          opacity={0.9}
          stroke={haloColor}
          strokeWidth={Math.max(1, r * 0.18) * haloScale}
          strokeLinejoin="round"
          style={{ paintOrder: 'stroke', pointerEvents: 'none', userSelect: 'none' }}
        >
          {c.sub}
        </text>
      )}
    </g>
  );
}

/**
 * Piano-style body for fixed-pitch semitone grids: white keys as full-height
 * rectangles (one per diatonic column), black keys as shorter raised rectangles
 * straddling the seams between whites. Markers are drawn on top by the caller.
 */
/**
 * Piano-style body for fixed-pitch semitone grids: white keys as full-height
 * rectangles (one per diatonic column), black keys as shorter raised rectangles
 * straddling the seams between whites. Markers are drawn on top by the caller.
 */
function KeyboardBody({ h }: { h: Hints }) {
  const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
  // Pitch class of a column depends on where the window starts relative to C.
  const lowMidi = Number(h.lowMidi ?? NaN);
  const pcOf = (col: number) => {
    if (Number.isFinite(lowMidi)) return (((lowMidi + col) % 12) + 12) % 12;
    return ((col % 12) + 12) % 12;
  };
  const boardTop = h.padY;
  const boardH = 2 * h.cellH;
  const boardW = (h.colEnd - h.colStart + 1) * h.cellW;
  const whites: { x: number; key: string }[] = [];
  const blacks: { x: number; w: number; key: string }[] = [];
  for (let col = h.colStart; col <= h.colEnd; col++) {
    const p = pcOf(col);
    const x = h.padX + (col - h.colStart) * h.cellW;
    if (WHITE_PCS.includes(p)) {
      whites.push({ x, key: `w-${col}` });
    } else {
      const w = h.cellW * 0.62;
      blacks.push({ x: x + h.cellW - w / 2, w, key: `b-${col}` });
    }
  }
  const labelY = boardTop + boardH + h.labelH / 2;
  return (
    <g>
      <rect x={h.padX} y={boardTop} width={boardW} height={boardH} fill="#f4f6f9" rx={4} />
      {whites.map((k) => (
        <line key={k.key} x1={k.x + h.cellW} y1={boardTop} x2={k.x + h.cellW} y2={boardTop + boardH} stroke="#9aa3af" strokeWidth={1.2} />
      ))}
      {blacks.map((k) => (
        <rect key={k.key} x={k.x} y={boardTop} width={k.w} height={boardH * 0.6} fill="#23282f" rx={2} />
      ))}
      <rect x={h.padX} y={boardTop} width={boardW} height={boardH} fill="none" stroke="#5a626c" strokeWidth={1.5} rx={4} />
      {Array.from({ length: Math.max(0, h.colEnd - h.colStart + 1) }, (_, i) => i + h.colStart)
        .filter((col) => pcOf(col) === 0)
        .map((col) => (
          <text
            key={`oc-${col}`}
            x={h.padX + (col - h.colStart) * h.cellW + h.cellW / 2}
            y={labelY}
            textAnchor="middle"
            fontSize={11}
            fill="#6b7480"
          >
            {Number.isFinite(lowMidi) ? `C${Math.floor((lowMidi + col) / 12) - 1}` : 'C'}
          </text>
        ))}
    </g>
  );
}

export function FrameSvg({ frame, onMarkerClick, className }: FrameSvgProps) {
  const h = useMemo(() => hintsOf(frame), [frame]);
  const rows = h.rowEnd - h.rowStart + 1;
  const cols = h.colEnd - h.colStart + 1;
  const bodyVisible = frame.layers.find((l) => l.id === 'body')?.visible ?? true;
  const patternsVisible = frame.layers.find((l) => l.id === 'patterns')?.visible ?? true;
  const connectorsVisible = frame.layers.find((l) => l.id === 'connectors')?.visible ?? true;

  const stringLines = useMemo(() => {
    const out: { y: number; key: string }[] = [];
    for (let row = h.rowStart; row <= h.rowEnd; row++) {
      out.push({
        y: h.padY + (row - h.rowStart) * h.cellH + h.cellH / 2,
        key: `string-${row}`,
      });
    }
    return out;
  }, [h]);

  // Fretboard geometry, nut-aware. On a real instrument the "open" column is
  // not a fret cell — it sits BEHIND the nut. So we render one extra half-cell
  // of blank space to the left, draw the nut as a thick bar at its edge, and
  // label open markers as "0" while real frets keep their numbers:
  //   layout:  |0|1|2|3|...   →   visual:  0 |1|2|3|...
  const nutLayout = useMemo(() => {
    const nutX = h.padX + (0 - h.colStart) * h.cellW; // left edge of the open column
    return { nutX };
  }, [h]);

  const fretLines = useMemo(() => {
    const out: { x: number; key: string; nut: boolean }[] = [];
    if (h.colStart === 0) {
      // The nut itself (thick bar between the open strip and fret 1).
      out.push({ x: nutLayout.nutX + h.cellW, key: 'nut', nut: true });
      // Vertical wire separators for real frets only (open has no left wire).
      for (let col = 2; col <= h.colEnd + 1; col++) {
        out.push({
          x: h.padX + (col - h.colStart) * h.cellW,
          key: `fret-${col}`,
          nut: false,
        });
      }
    } else {
      for (let col = h.colStart; col <= h.colEnd + 1; col++) {
        out.push({
          x: h.padX + (col - h.colStart) * h.cellW,
          key: `fret-${col}`,
          nut: false,
        });
      }
    }
    return out;
  }, [h, nutLayout]);

  // Markers split into background dots vs pattern markers.
  const background = frame.markers.filter((m) => !m.patternId);
  const foreground = frame.markers.filter((m) => m.patternId);

  return (
    <svg
      className={className}
      width={frame.width}
      height={frame.height}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      role="img"
      aria-label={`${frame.instrumentId} visualization (${frame.mode} notation)`}
    >
      <defs>
        <filter id="mpg-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="mpg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>

      <rect x={0} y={0} width={frame.width} height={frame.height} fill={frame.palette.canvas} rx={10} />

      {bodyVisible && h.keyboard ? (
        <KeyboardBody h={h} />
      ) : null}
      {bodyVisible && !h.keyboard && (
        <g>
          {/* Strings start at the nut when present (open strip has no wires). */}
          {stringLines.map((s) => (
            <line
              key={s.key}
              x1={h.colStart === 0 ? nutLayout.nutX + h.cellW : h.padX}
              y1={s.y}
              x2={h.padX + cols * h.cellW}
              y2={s.y}
              stroke="#8d97a5"
              strokeWidth={1.2}
            />
          ))}
          {fretLines.map((f) => (
            <line
              key={f.key}
              x1={f.x}
              y1={h.padY}
              x2={f.x}
              y2={h.padY + rows * h.cellH}
              stroke={f.nut ? '#e8e8e8' : '#5a626c'}
              strokeWidth={f.nut ? 5 : 1.5}
            />
          ))}
          {INLAY_FRETS.filter(
            (f) => f >= Math.max(1, h.colStart) && f <= h.colEnd,
          ).map((f) => {
            const x = h.padX + (f - h.colStart) * h.cellW + h.cellW / 2;
            const midY = h.padY + (rows * h.cellH) / 2;
            const dot = (yy: number, key: string) => (
              <circle key={key} cx={x} cy={yy} r={4} fill="#3d444d" />
            );
            return DOUBLE_INLAY.has(f)
              ? [dot(midY - h.cellH, `inlay-${f}-a`), dot(midY + h.cellH, `inlay-${f}-b`)]
              : dot(midY, `inlay-${f}`);
          })}
          {/* Fret numbers along the bottom — real frets only (the open column
              is not a fret; markers there are labelled "0" by the engine). */}
          {Array.from({ length: Math.max(0, h.colEnd - Math.max(1, h.colStart) + 1) }, (_, i) => i + Math.max(1, h.colStart)).map(
            (f) => (
              <text
                key={`fn-${f}`}
                x={h.padX + (f - h.colStart) * h.cellW + h.cellW / 2}
                y={frame.height - h.labelH / 2}
                textAnchor="middle"
                fontSize={11}
                fill={INLAY_FRETS.includes(f) ? '#cfd6df' : '#6b7480'}
                fontWeight={INLAY_FRETS.includes(f) ? 700 : 400}
              >
                {f}
              </text>
            ),
          )}
        </g>
      )}

      {connectorsVisible && (
        <g>
          {frame.connectors.map((c) => (
            <ConnectorShape key={c.group.id} c={c} h={h} />
          ))}
        </g>
      )}

      <g>{background.map((m) => <Marker key={m.position.id} m={m} h={h} />)}</g>
      {patternsVisible && (
        <g>{foreground.map((m) => <Marker key={m.position.id} m={m} h={h} onClick={onMarkerClick} />)}</g>
      )}
    </svg>
  );
}
