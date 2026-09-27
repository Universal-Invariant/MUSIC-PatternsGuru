/**
 * Keys, key signatures, and the circle of fifths.
 *
 * The circle is not decoration: it is the generator of diatonic collections and
 * the natural coordinate for "how far apart are these two keys" (shared-tone
 * count, pivot availability, modal interchange distance). We derive everything —
 * signature, relative minor, mode list, neighbourhood — from that one structure.
 */
import { type PitchClass } from '../pitch-class.js';
import { type Spelling } from '../spelling.js';
import { type Template } from './template.js';
export interface KeySignature {
    /** Tonic pitch class. */
    readonly tonic: PitchClass;
    /** Tonic spelling (so `F# major` renders as F♯, never G♭). */
    readonly tonicSpelling: Spelling;
    /** 'major' | 'minor' | template id for non-diatonic key centres. */
    readonly mode: string;
    /** Signed count of sharps (positive) or flats (negative). */
    readonly accidentals: number;
    /** Ordered letters carrying the accidental, e.g. ['F','C','G'] for 3 sharps. */
    readonly sharpOrder: readonly string[];
    readonly flatOrder: readonly string[];
    /** Scale template this key is built on. */
    readonly template: Template;
}
/** Order in which sharps/flats appear in signatures. */
export declare const SHARP_ORDER: readonly ["F", "C", "G", "D", "A", "E", "B"];
export declare const FLAT_ORDER: readonly ["B", "E", "A", "D", "G", "C", "F"];
/** Number of sharps (or minus flats) in the signature of a major key. */
export declare function majorSignatureCount(tonic: PitchClass): number;
/** Build a key signature record. */
export declare function keySignature(tonic: PitchClass | string, mode?: 'major' | 'minor'): KeySignature;
/** The full circle of fifths, ordered by signature count, sharps then flats. */
export interface CircleEntry {
    readonly position: number;
    readonly major: KeySignature;
    readonly relativeMinor: KeySignature;
}
export declare function circleOfFifths(): CircleEntry[];
/** Diatonic fifths distance between two tonics (steps around the circle). */
export declare function fifthsDistance(a: PitchClass, b: PitchClass): number;
/** Keys sharing the most tones with `tonic` (nearest neighbours on the circle). */
export declare function nearestKeys(tonic: PitchClass, radius?: number): KeySignature[];
/** Count of shared pitch classes between two keys' diatonic collections. */
export declare function sharedToneCount(a: PitchClass, b: PitchClass): number;
/** Pitch classes of the major collection rooted at `tonic`. */
export declare function diatonicPcs(tonic: PitchClass): PitchClass[];
/** Parallel/minor partner of a key. */
export declare function parallelMinor(tonic: PitchClass): KeySignature;
/** Human label, e.g. `E♭ major`, `C minor`. */
export declare function keyLabel(k: KeySignature): string;
/**
 * Mode names for each degree of a parent scale, using the conventional church
 * names when the parent is the major scale and generic ordinals otherwise.
 */
export declare const CHURCH_MODES: readonly ["Ionian", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Aeolian", "Locrian"];
export declare const MELODIC_MINOR_MODES: readonly ["Melodic Minor", "Dorian b2", "Lydian Augmented", "Lydian Dominant", "Mixolydian b6", "Locrian Natural 9", "Altered (Super Locrian)"];
export declare function modeNamesFor(templateId: string): readonly string[];
//# sourceMappingURL=keys.d.ts.map