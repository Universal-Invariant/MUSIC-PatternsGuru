/**
 * The fretboard presenter: turns a `VisualizationScene` on any grid-oriented
 * instrument into a concrete `RenderFrame` (markers + connectors with pixel
 * geometry). Pure data in, pure data out — no DOM, fully unit-testable, and the
 * same frame feeds the SVG renderer today and a Canvas/WebGL renderer tomorrow.
 */
import { type Presenter, type RenderFrame, type VisualizationScene } from '@mpg/core';
export interface FretboardGeometry {
    readonly cellW: number;
    readonly cellH: number;
    readonly padX: number;
    readonly padY: number;
    /** Extra room at the bottom for fret-number labels. */
    readonly labelH: number;
}
export declare const DEFAULT_GEOMETRY: FretboardGeometry;
export interface ResolvedWindow {
    readonly rowStart: number;
    readonly rowEnd: number;
    readonly colStart: number;
    readonly colEnd: number;
}
/** Centre of a position's cell in pixel space. */
export declare function cellCenter(row: number, col: number, geo: FretboardGeometry, window: ResolvedWindow): {
    x: number;
    y: number;
};
export declare class FretboardPresenter implements Presenter {
    private readonly geo;
    readonly id = "fretboard";
    readonly name = "Fretboard Presenter";
    readonly accepts: string[];
    constructor(geo?: FretboardGeometry);
    present(scene: VisualizationScene): RenderFrame;
}
/** Default singleton presenter used by the React bindings. */
export declare const fretboardPresenter: FretboardPresenter;
//# sourceMappingURL=fretboard.d.ts.map