/**
 * The pattern algebra.
 *
 * A {@link Pattern} is a finite, *ordered* subset of pitch space — this single
 * abstraction covers scales (usually interval-ordered), arpeggios/chords
 * (usually stack-ordered), modes, symmetric cells, melodic fragments, and hand
 * shapes. Everything the visualizer draws is a pattern; instrument layouts,
 * notations, and relation layers are all just functors on patterns.
 *
 * Patterns are transpositionally structured: `transpose` moves the anchor while
 * preserving the intervallic skeleton, which is what makes "shape" reasoning
 * (guitar positions, piano fingerings, trumpet valve combos) possible at all.
 */
import { type PitchClass } from './pitch-class.js';
import { type Spelling } from './spelling.js';
/** Ordered list of absolute semitones above the pattern's anchor (first = 0). */
export type Steps = readonly number[];
/** Stable identifier for a pattern shape, independent of root. */
export type PatternId = string;
/** Kinds of pattern recognized by the library and search index. */
export type PatternKind = 'scale' | 'chord' | 'arpeggio' | 'mode' | 'set' | 'melody';
/** How a pattern is built — drives search filters and provenance display. */
export type PatternSource = 'manual' | 'library' | 'rotation' | 'stack' | 'subset' | 'combination' | 'derived';
export interface Pattern {
    readonly id: PatternId;
    readonly name: string;
    readonly aliases?: readonly string[];
    readonly kind: PatternKind;
    /** Root / anchor / tonal center in `[0,12)`. */
    readonly root: PitchClass;
    /** Ordered semitone steps above `root`, ascending, first element 0. */
    readonly steps: Steps;
    /** Optional spelled members (same length as `steps`) for letter/tonal notation. */
    readonly spellings?: readonly (Spelling | undefined)[];
    /** Parent collection this pattern was derived from (modes, diatonic chords). */
    readonly parentId?: string;
    /** Degree of `parent` that anchors this pattern (1-based). */
    readonly parentDegree?: number;
    readonly source?: PatternSource;
    /** Free-form tags used by search (`jazz`, `messiaen`, `gypsy`, ...). */
    readonly tags?: readonly string[];
    readonly comment?: string;
}
/** Normalize steps: dedupe mod 12, keep first occurrence, sort ascending. */
export declare function normalizeSteps(steps: Iterable<number>): number[];
/** Create a pattern from root + steps, filling in derived fields. */
export interface CreatePatternInput {
    id?: PatternId;
    name: string;
    kind?: PatternKind;
    root?: PitchClass;
    steps: Iterable<number>;
    aliases?: readonly string[];
    tags?: readonly string[];
    source?: PatternSource;
    comment?: string;
    degrees?: readonly DegreeAnnotation[];
    parentId?: string;
    parentDegree?: number;
}
export declare function createPattern(input: CreatePatternInput): Pattern;
export declare function slugify(value: string): string;
/** Pitch classes of a pattern's members. */
export declare function patternPcs(p: Pattern): PitchClass[];
/** Sorted unique pitch classes (canonical set form). */
export declare function patternSet(p: Pattern): PitchClass[];
/** Cardinality. */
export declare function size(p: Pattern): number;
/** Is `value` a member of the pattern? */
export declare function contains(p: Pattern, value: number): boolean;
/** Transpose the anchor; skeleton preserved. */
export declare function transpose(p: Pattern, semitones: number): Pattern;
/** Rotate through every chromatic transposition (12 copies unless reduced). */
export declare function allTranspositions(p: Pattern, limit?: number): Pattern[];
/** Inversion about the root axis (mirror the skeleton). */
export declare function invert(p: Pattern, axis?: PitchClass): Pattern;
/** Retrograde (reverse the ordering; members unchanged). */
export declare function retrograde(p: Pattern): Pattern;
/** M5: transpose then invert (the classic jazz "minor 5th inversion" move). */
export declare function m5(p: Pattern): Pattern;
/**
 * Modal rotation: cyclically permute the step skeleton so that the degree at
 * index `offset` becomes the new anchor. This is the definition of a mode as an
 * orbit under rotation — no re-analysis needed.
 */
export declare function rotate(p: Pattern, offset: number): Pattern;
/** Every rotation of a pattern (its modal orbit), de-duplicated by set form. */
export declare function modalOrbit(p: Pattern): Pattern[];
/** Interval skeleton as step-to-step differences (the "shape" signature). */
export declare function intervalsBetween(p: Pattern): number[];
/** Signature used for structural equality (rotation-invariant). */
export declare function shapeSignature(p: Pattern): string;
/** Structural equality ignoring root and rotation. */
export declare function sameShape(a: Pattern, b: Pattern): boolean;
/** Exact set equality (same members, ignoring order/root). */
export declare function sameMembers(a: Pattern, b: Pattern): boolean;
/** Subset test: is every member of `sub` inside `super`? */
export declare function isSubsetOf(sub: Pattern, superSet: Pattern): boolean;
/** Set operations lifted onto patterns. */
export declare function union(a: Pattern, b: Pattern): Pattern;
export declare function intersection(a: Pattern, b: Pattern): Pattern;
export declare function difference(a: Pattern, b: Pattern): Pattern;
/** Complement within the chromatic total. */
export declare function complement(p: Pattern): Pattern;
/**
 * Spell the members of a pattern using a key context. Falls back to sharp-ish
 * spellings when no key is supplied. Presenters call this for letter notation.
 */
export declare function spellPattern(p: Pattern, keyContext?: readonly PitchClass[]): Spelling[];
/** Textual step signature, e.g. `W-H-W-W-H-W-W` for major (H/W helpers). */
export declare function stepSignature(p: Pattern): string;
/**
 * Derive a degree label (`1`, `b3`, `#4`) from a semitone step by finding the
 * diatonic degree whose natural pitch is closest below/equal to it. This is how
 * hand-drawn patterns get sensible interval notation without a template.
 */
export declare function degreeLabelForStep(step: number): string;
/**
 * A degree annotation is either a bare label (`'b3'`) or a `[semitonesAboveRoot,
 * label]` pair (the pairing keeps labels attached to their own octave placement
 * when steps are normalized/sorted). Library templates use the pair form;
 * derived patterns and manual entry usually use the bare-label form.
 */
export type DegreeAnnotation = string | readonly [number, string];
/** Extract the textual label from either annotation form. */
export declare function degreeLabelText(d: DegreeAnnotation): string;
/** Compact label list for tooltips: `1 b3 5 b7`. */
export declare function degreeLabels(p: Pattern, degrees?: readonly DegreeAnnotation[]): string[];
export declare function naturalDegreeSemitone(degree: number): number;
/** True when the pattern is invariant under some non-zero transposition. */
export declare function isSymmetric(p: Pattern): boolean;
/** Normal-order representative, handy for Forte-style identity checks. */
export declare function primeRepresentative(p: Pattern): number[];
/**
 * Turn a degree label (`b3`, `#4`, `13`) into a spelling relative to a C root:
 * the letter comes from the diatonic step, the accidental from the prefix. This
 * is what lets interval notation and tonal colour share one source of truth.
 */
export declare function labelToSpelling(label: string): Spelling | undefined;
/** Human-readable summary line for search results and headers. */
export declare function describePattern(p: Pattern): string;
//# sourceMappingURL=pattern.d.ts.map