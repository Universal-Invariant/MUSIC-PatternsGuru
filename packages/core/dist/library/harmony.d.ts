/**
 * Diatonic harmony: the chords that live inside a scale, and the scales that
 * contain a chord.
 *
 * This is the workhorse behind "chords within scales", "scales containing this
 * chord", Roman-numeral analysis, and functional (tonal) colouring. Everything is
 * computed rather than tabulated, so it works for *any* heptatonic or
 * non-heptatonic collection the user invents — not just the major scale.
 */
import { type PitchClass } from '../pitch-class.js';
import { type Pattern } from '../pattern.js';
import { SCALE_TEMPLATES } from './scales.js';
/** A chord built on one degree of a parent collection. */
export interface DiatonicChord {
    /** 1-based index into the parent's ordered members. */
    readonly degree: number;
    /** Roman numeral, case/sign reflecting quality (`bVII`, `iv`, `#ii°`). */
    readonly numeral: string;
    /** Root pitch class. */
    readonly root: PitchClass;
    /** Chord symbol as rendered text (`F#m7`, `G7`, ...). */
    readonly symbol: string;
    /** The concrete chord pattern. */
    readonly pattern: Pattern;
    /** Template the stack matched (undefined when the stack is non-standard). */
    readonly templateId?: string;
    /** Parent-collection degrees used to build the stack. */
    readonly memberDegrees: readonly number[];
}
/** Stack every `size` notes at `skip` intervals starting from each degree. */
export declare function stackedMembers(parent: Pattern, size?: number, skip?: number): {
    degree: number;
    roots: number[];
}[];
/** Build diatonic seventh chords (stack of thirds) for any parent collection. */
export declare function diatonicSevenths(parent: Pattern, size?: number, skip?: number): DiatonicChord[];
export declare function diatonicTriads(parent: Pattern): DiatonicChord[];
/**
 * Roman numeral with quality-aware case and accidental prefix. The accidental is
 * measured against the *major* scale degree at that position, which is what makes
 * numerals readable in borrowed/mixed collections (harmonic minor, Messiaen...).
 */
export declare function romanNumeral(degree: number, chord: Pattern, parent: Pattern): string;
/** Compact chord symbol from a pattern plus optional template id. */
export declare function chordSymbol(pattern: Pattern, templateId?: string): string;
/**
 * Every library scale whose pc set contains all members of `chord`. Powers the
 * "which scales can I play over this chord?" query. Results are ranked by how
 * many chord tones are *strong* positions (root/3rd/5th/7th) they support.
 */
export declare function scalesContainingChord(chord: Pattern, options?: {
    templates?: readonly typeof SCALE_TEMPLATES[number];
    maxResults?: number;
}): {
    template: (typeof SCALE_TEMPLATES)[number];
    transpositions: PitchClass[];
}[];
/** All library chords that are subsets of a given scale (per degree). */
export declare function chordsWithinScale(scale: Pattern): DiatonicChord[];
/**
 * Modal-interchange pool: chords available from every same-root parallel mode.
 * Central to the "tonal relations" view — shows where a foreign chord came from.
 */
export declare function modalInterchange(tonic: PitchClass, parents: readonly Pattern[]): {
    source: Pattern;
    chord: DiatonicChord;
}[];
/** Functional classification used by tonal notation colours. */
export type HarmonicFunction = 'tonic' | 'subdominant' | 'dominant' | 'leading' | 'mediant' | 'submediant' | 'supertonic' | 'chromatic';
/** Coarse function label for a degree in a major/minor context. */
export declare function harmonicFunction(degree: number): HarmonicFunction;
/** Cadential strength heuristic: V→I, iv→V, ii→V etc. */
export declare function cadentialMotion(from: DiatonicChord, to: DiatonicChord): number;
//# sourceMappingURL=harmony.d.ts.map