/**
 * Scene builder: the ergonomic front door of @mpg/react.
 *
 * UI code should never hand-assemble `VisualizationScene` objects — this module
 * turns high-level intent ("show D dorian with its diatonic 7th chords, tonal
 * notation, frets 0–12") into a fully-resolved scene: patterns, relation groups,
 * layers, effects, and window clipping. It is the seam where "what the user asked
 * for" becomes "what the presenter receives".
 */
import { type Effect, type Instrument, type NotationMode, type Palette, type Pattern, type RelationGroup, type VisualizationScene, type ViewWindow } from '@mpg/core';
export interface LayerToggle {
    readonly connectors: boolean;
    readonly labels: boolean;
    readonly background: boolean;
    readonly effects: boolean;
}
export declare const DEFAULT_TOGGLES: LayerToggle;
export interface BuildSceneOptions {
    /** One pattern = single view; several = overlaid on the same instrument. */
    patterns: readonly Pattern[];
    mode?: NotationMode;
    /** Per-pattern modes (overrides `mode`). */
    modes?: readonly NotationMode[];
    palette?: Palette;
    window?: ViewWindow;
    toggles?: Partial<LayerToggle>;
    /** Draw diatonic chord blobs inside the first scale-typed pattern. */
    showChordsInScale?: boolean;
    /** Chord stack size for {@link showChordsInScale}: 3 = triads, 4 = sevenths. */
    chordSize?: 3 | 4;
    /** Overlap/difference analysis between the first two patterns. */
    showOverlap?: boolean;
    /** Extra semantic groups merged in after the computed ones. */
    extraGroups?: readonly RelationGroup[];
    includeAllCandidates?: boolean;
    rootEffect?: Effect;
}
/** Build a complete visualization scene. Pure; safe to call every render. */
export declare function buildScene(instrument: Instrument, options: BuildSceneOptions): VisualizationScene;
/** Shorthand: root a library template (`rootPattern('D', 'dorian')`). */
export declare function rootPattern(rootName: string, templateId: string): Pattern | undefined;
/** All 12 transpositions of a pattern's shape (for orbit browsers). */
export declare function transpositionFamily(pattern: Pattern): Pattern[];
//# sourceMappingURL=scene.d.ts.map