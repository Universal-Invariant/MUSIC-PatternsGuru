/**
 * Pitch-class space: the 12 equal-tempered residues of Z/12Z.
 *
 * A `PitchClass` is an integer in `[0, 12)` — a pure residue with no spelling.
 * Spelling (C vs B#, and which octave) lives in {@link Pitch} / {@link NoteName}.
 *
 * The distinction matters: instrument layouts are mappings from *pitch space*
 * into physical key-layout space, and that mapping is generally **lossy** in both
 * directions (enharmonic equivalence on a piano keyboard; octave ambiguity on a
 * fretboard). Keeping pc-level algebra separate from spelling lets us model that
 * lossiness honestly instead of pretending it away.
 */
export declare const PC_MODULUS: 12;
/** Integer pitch class in `[0, 12)`. */
export type PitchClass = number;
/** Wrap any integer into `[0, 12)` (true modulo, handles negatives). */
export declare function pc(n: number): PitchClass;
/** Add pitch classes modulo 12 (translation / transposition in Z/12Z). */
export declare function pcAdd(a: PitchClass, b: PitchClass): PitchClass;
/** Subtract pitch classes modulo 12. */
export declare function pcSub(a: PitchClass, b: PitchClass): PitchClass;
/** Multiply pitch classes modulo 12 (used by modulatory / Messiaen-style maps). */
export declare function pcMul(a: PitchClass, b: PitchClass): PitchClass;
/** Inversion about axis 0: `x ↦ -x`. */
export declare function pcInvert(a: PitchClass): PitchClass;
/** Inversion about an arbitrary axis: `x ↦ 2*axis - x`. */
export declare function pcInvert(a: PitchClass, axis: PitchClass): PitchClass;
/** Canonical transposition map `T_n`, as a reusable function. */
export declare function t(n: PitchClass): (x: PitchClass) => PitchClass;
/** Canonical inversion map `I_n` (`x ↦ n - x`), as a reusable function. */
export declare function i(n: PitchClass): (x: PitchClass) => PitchClass;
/**
 * Interval between two pitch classes, normalized to the ascending complement
 * in `[0, 12)`. Direction-aware variants live in {@link interval}.
 */
export declare function pcDistance(a: PitchClass, b: PitchClass): number;
/** Shortest distance between two pitch classes on the clock, in `[0, 6]`. */
export declare function pcIntervalClass(a: PitchClass, b: PitchClass): number;
/** True when `x` lies on the ascending path from `start` to `stop` (mod 12). */
export declare function pcInclusiveBetween(start: PitchClass, stop: PitchClass, x: PitchClass): boolean;
/** Iterate pitch classes ascending from `start` for `steps` semitones. */
export declare function pcRange(start: PitchClass, steps: number): PitchClass[];
/** Deduplicate + sort ascending, treating input as pitch classes. */
export declare function pcSet(values: Iterable<number>): PitchClass[];
/** Multiset-free membership test helper. */
export declare function pcContains(set: readonly PitchClass[], value: PitchClass): boolean;
/**
 * Complement of a pc-set within the chromatic total. Useful for "what is left
 * over" views (e.g. notes *not* in a scale, available tensions).
 */
export declare function pcComplement(set: readonly PitchClass[]): PitchClass[];
/** Rotate a list of pitch classes so `root` leads (mode extraction at pc level). */
export declare function pcRotateTo(set: readonly PitchClass[], root: PitchClass): PitchClass[];
/** Cardinality-set name ( Forte-friendly shorthand). */
export declare function pcCardinalityName(size: number): string;
//# sourceMappingURL=pitch-class.d.ts.map