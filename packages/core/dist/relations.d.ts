/**
 * Relations: the vocabulary for saying "these things are connected" without
 * ever naming pixel coordinates.
 *
 * This module exists because the hardest part of a rich visualizer is not
 * drawing dots — it is expressing that *this* set of positions belongs to *that*
 * chord, or that this note here and that note over there are the same function in
 * two different keys. We model that with semantic groups keyed by position id.
 *
 * Every relation returns {@link RelationGroup}s whose `members` are instrument
 * position ids. The presenter later resolves those ids into geometry. Nothing in
 * this file knows anything about layout, which means every relation here works on
 * every instrument, including instruments that do not exist yet.
 */
import type { Instrument } from './instrument.js';
import type { Pattern } from './pattern.js';
import type { RelationGroup, ConnectorKind } from './presenter.js';
import { type PitchClass } from './pitch-class.js';
export interface RelationOptions {
    /** Layer id the resulting groups should live on. */
    readonly layer?: string;
    /** Only include groups with at least this many visible members. */
    readonly minMembers?: number;
    /** Connector style override. */
    readonly kind?: ConnectorKind;
}
/** Positions on an instrument where any member of `pattern` appears. */
export declare function positionsForPattern(instrument: Instrument, pattern: Pattern, options?: {
    includeAllCandidates?: boolean;
}): string[];
/** Same as {@link positionsForPattern}, exposed for presenters needing detail. */
export declare function candidatesForPattern(instrument: Instrument, pattern: Pattern, options?: {
    includeAllCandidates?: boolean;
}): string[];
/** One group per pattern, labelled with its name. The simplest useful view. */
export declare function patternGroups(instrument: Instrument, patterns: readonly Pattern[], options?: RelationOptions): RelationGroup[];
/**
 * Overlap/difference analysis between two patterns on one instrument. Produces
 * three groups: shared tones, only-in-A, only-in-B. This is what powers the
 * "compare scales" and "what's new in Dorian vs Aeolian" views.
 */
export declare function overlapGroups(instrument: Instrument, a: Pattern, b: Pattern, options?: RelationOptions): RelationGroup[];
/**
 * Chord-tone groups inside a scale view: for each diatonic chord of `scale`, a
 * group containing the positions of its members. With `arrow-fan` connectors this
 * becomes the classic "chords hidden in the scale" picture.
 */
export declare function chordInScaleGroups(instrument: Instrument, scale: Pattern, options?: RelationOptions & {
    size?: number;
}): RelationGroup[];
/**
 * Same-function-across-keys: all positions playing pitch class `target`, grouped
 * by which key/pattern they belong to. Used for "show me every b7 everywhere".
 */
export declare function functionGroups(instrument: Instrument, target: PitchClass, patterns: readonly Pattern[], options?: RelationOptions): RelationGroup[];
/**
 * Cross-instrument correspondence: given two instruments, group positions that
 * carry the same pitch class. This is what makes "translate this guitar shape to
 * violin" legible — the shared colour/label across two layouts *is* the mapping.
 */
export declare function crossInstrumentGroups(left: Instrument, right: Instrument, pattern: Pattern, options?: RelationOptions): RelationGroup[];
/**
 * Intervallic symmetry axes: for symmetric collections, group positions related
 * by inversion about each axis. Reveals why whole-tone/diminished shapes repeat.
 */
export declare function symmetryGroups(instrument: Instrument, pattern: Pattern, options?: RelationOptions): RelationGroup[];
/** Cycle-of-fifths ordering groups: adjacent-fifth clusters within a pattern. */
export declare function fifthsChainGroups(instrument: Instrument, pattern: Pattern, options?: RelationOptions): RelationGroup[];
/** Union several relation sets, de-duplicating by group id. */
export declare function mergeGroups(...sets: readonly RelationGroup[][]): RelationGroup[];
/** Restrict groups to positions inside a window (used when zooming/cropping). */
export declare function filterGroupsByPositions(groups: readonly RelationGroup[], allowed: ReadonlySet<string>): RelationGroup[];
//# sourceMappingURL=relations.d.ts.map