/**
 * Notation: how a highlighted pitch is *labelled* and *coloured*.
 *
 * Four notational modes, all pure functions of (pattern, position, context):
 *   1. `blind`     — location only, zero information. Trains recall.
 *   2. `interval`  — degree from the root (`1 b3 5 b7`). Relational thinking.
 *   3. `letter`    — spelled note name (`C Eb G Bb`). Absolute identification.
 *   4. `tonal`     — interval labels *plus* function-driven colour. The label is
 *                    the same as `interval`; the colour adds a second channel so
 *                    the eye groups by harmonic role without reading text.
 *
 * Colour is assigned by *degree class*, never by pitch class, so the same colour
 * always means the same function across every key and every instrument. That
 * invariance is the whole point of tonal notation.
 */
import type { Pattern } from './pattern.js';
import { type PitchClass } from './pitch-class.js';
import { type Spelling } from './spelling.js';
export type NotationMode = 'blind' | 'interval' | 'letter' | 'tonal';
export declare const NOTATION_MODES: readonly NotationMode[];
/** Everything a presenter needs to draw one marker. */
export interface MarkerContent {
    /** Primary glyph/text (empty string for blind mode). */
    readonly text: string;
    /** Optional secondary line (e.g. note name under an interval label). */
    readonly sub?: string;
    /** Fill colour resolved from the active palette. */
    readonly fill: string;
    /** Stroke/outline colour. */
    readonly stroke: string;
    /** Whether this marker is the pattern's root/anchor. */
    readonly isRoot: boolean;
    /** Degree label when meaningful, else undefined. */
    readonly degree?: string;
    /** Letter spelling when meaningful, else undefined. */
    readonly spelling?: Spelling;
}
/** A palette maps a semantic role onto colours. Swap palettes freely. */
export interface Palette {
    readonly id: string;
    readonly name: string;
    /** Root / tonic colour. */
    readonly root: string;
    /** Colours indexed by degree class (1..7 plus alterations). */
    readonly degrees: Record<string, string>;
    /** Non-member ("outside") colour. */
    readonly outside: string;
    /** Background/canvas tint. */
    readonly canvas: string;
    /** Text colour that reads well on `fill`. */
    readonly ink: string;
}
/**
 * Default tonal palette. Degrees are keyed by their *canonical* label so `b3`
 * and `#4` each get stable, distinct hues. Inspired by functional harmony:
 * warm for stable tones, cool/tension for leading and altered tones.
 */
export declare const TONAL_PALETTE: Palette;
/** Simple hue-wheel palette keyed by semitone distance from root. */
export declare const CHROMATIC_PALETTE: Palette;
/** Monochrome palette for print / low-vision / distraction-free study. */
export declare const MONO_PALETTE: Palette;
export declare const PALETTES: readonly Palette[];
/** Resolve the colour for a step relative to a root, honouring the palette. */
export declare function colorForStep(step: number, palette: Palette, mode: NotationMode): string;
/** Build the marker content for one member of a pattern. */
export declare function markerForPatternMember(pattern: Pattern, stepIndex: number, options: {
    mode: NotationMode;
    palette?: Palette;
    keyContext?: readonly PitchClass[];
    showNoteNamesUnderIntervals?: boolean;
}): MarkerContent;
/** Marker for a position that is *not* part of any displayed pattern. */
export declare function markerForNonMember(palette: Palette, _mode: NotationMode): MarkerContent;
/**
 * Decide the letter shown at a concrete absolute pitch, given a pattern context.
 * Presenters call this when they need "the note at this fret" rather than "the
 * nth member of the pattern" — e.g. hover tooltips on non-pattern positions.
 */
export declare function spellingAtAbsolute(midi: number, pattern: Pattern | undefined, preferFlats?: boolean): Spelling;
/** Text-only rendering used by CLI examples, tests, and accessibility output. */
export declare function renderPatternText(pattern: Pattern, mode: NotationMode): string;
//# sourceMappingURL=notation.d.ts.map