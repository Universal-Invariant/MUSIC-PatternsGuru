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
import type { RenderFrame } from '@mpg/core';
export interface FrameSvgProps {
    readonly frame: RenderFrame;
    /** Optional interaction hook — ids are position ids. */
    onMarkerClick?: (positionId: string) => void;
    className?: string;
}
export declare function FrameSvg({ frame, onMarkerClick, className }: FrameSvgProps): import("react").JSX.Element;
//# sourceMappingURL=FrameSvg.d.ts.map