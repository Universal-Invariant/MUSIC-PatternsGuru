/**
 * Intervals: the ordered, spelled relation between two pitches.
 *
 * Two independent measurements are needed and must not be conflated:
 *   - `semitones` — physical/acoustic size in 12-TET (what the instrument sees),
 *   - `letterSteps` — diatonic span (what theory and notation see).
 * `A# → Bb` is 0 semitones across 1 letter step: an augmented unison, not a
 * perfect octave's complement. Tonal notation and chord construction both depend
 * on keeping these separate.
 */
import { type PitchClass } from './pitch-class.js';
/** Generic interval quality codes. */
export type Quality = 'dd' | 'd' | 'P' | 'A' | 'AA' | 'm' | 'M';
/** Simple (≤ octave) interval identifiers used throughout the app. */
export type IntervalId = 'P1' | 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'TT' | 'P5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8';
/** All simple intervals in ascending order. */
export declare const INTERVAL_IDS: readonly IntervalId[];
/** A fully specified interval. */
export interface Interval {
    /** Signed semitone distance (positive = ascending). */
    readonly semitones: number;
    /** Signed diatonic letter-step distance, e.g. 7 for any kind of tenth-ish span. */
    readonly letterSteps: number;
    /** Human label such as `Major third`, `Augmented fourth`. */
    readonly name: string;
    /** Compact label such as `M3`, `A4`. */
    readonly short: string;
    /** True when the interval belongs to the perfect family (unison/fourth/fifth/octave). */
    readonly perfect: boolean;
}
export declare function isPerfectDegree(degree: number): boolean;
/** Number of octaves contained in an absolute semitone span. */
export declare function compoundOf(semitones: number): number;
/** Reduce any semitone span into `[0, 12)` (interval class, ascending). */
export declare function simplifySemitones(semitones: number): number;
/**
 * Build an interval from its two measurements. Quality is derived, never guessed:
 * we compare the actual semitone count against the reference semitone count for
 * that diatonic span.
 */
export declare function makeInterval(semitones: number, letterSteps: number): Interval;
/** Natural (unmodified) semitone count for a simple diatonic degree. */
export declare function naturalSemitonesFor(degree: number): number;
export declare function degreeName(degree: number): string;
/** Canonical simple interval for a semitone span (no spelling information). */
export declare function intervalBySemitones(semitones: number): Interval;
/** Look up by identifier (`'M3'`, `'P5'`, `'TT'`). */
export declare function intervalById(id: IntervalId | string): Interval;
/** Ascending pitch-class interval between two pitch classes. */
export declare function pcInterval(a: PitchClass, b: PitchClass): Interval;
/**
 * Interval between two spelled notes, using both measurements. Octave difference
 * contributes 7 letter steps per octave.
 */
export declare function spelledInterval(low: {
    step: number;
    alteration: number;
    octave?: number;
}, high: {
    step: number;
    alteration: number;
    octave?: number;
}): Interval;
/** Invert an interval across an octave (`complementWithinOctave(P5) = P4`). */
export declare function invertWithinOctave(iv: Interval): Interval;
/** True when the interval is consonant in the common-practice sense. */
export declare function isConsonant(iv: Interval): boolean;
/** Aggregate interval vector (prime form analysis helper, index = ic). */
export declare function intervalVector(pcs: readonly PitchClass[]): number[];
/** Unique normal-order rotation of a pc-set (Babbard-style canonicalization). */
export declare function normalOrder(pcs: readonly PitchClass[]): PitchClass[];
/** Transpose-and-invert search for the closest prime form partner (lightweight). */
export declare function transpositionallyEquivalent(a: readonly PitchClass[], b: readonly PitchClass[]): boolean;
//# sourceMappingURL=interval.d.ts.map