/**
 * Note spelling: the *diatonic* side of pitch space.
 *
 * Equal temperament collapses `D#` and `Eb` into one pitch class, but music does
 * not: `D#` is the raised submediant of B major while `Eb` is the mediant of C
 * minor. Our visualizer must be able to show that difference (letter notation and
 * tonal notation both depend on it), so spelling is first-class data.
 *
 * A spelled note is a pair `(step, alteration)` where
 *   - `step ∈ [0, 7)` indexes the diatonic letter cycle C D E F G A B,
 *   - `alteration ∈ Z` is a count of chromatic alterations (sharps positive).
 *
 * The pitch class is `diatonicSemitone[step] + alteration`, i.e. there is a
 * surjection `spell → pc` with non-trivial kernel — precisely the enharmonic
 * relation we refuse to quotient out by default.
 */
import { type PitchClass } from './pitch-class.js';
export declare const LETTERS: readonly ["C", "D", "E", "F", "G", "A", "B"];
export type Letter = (typeof LETTERS)[number];
/** Semitone offset of each natural letter above C. */
export declare const LETTER_SEMITONE: Record<Letter, number>;
/** Diatonic step index for each letter. */
export declare const LETTER_STEP: Record<Letter, number>;
export declare const STEP_LETTER: readonly Letter[];
export declare function isLetter(value: string): value is Letter;
/** Parse a single letter (with optional lowercase) into a {@link Letter}. */
export declare function letterOf(value: string): Letter;
/** A spelled pitch class: diatonic step plus chromatic alteration. */
export interface Spelling {
    /** Diatonic step 0..6 (C=0, D=1, ... B=6). */
    readonly step: number;
    /** Chromatic alteration in semitones; positive = sharp, negative = flat. */
    readonly alteration: number;
}
/** Full note name with octave (`step`/`alteration` + `octave`). */
export interface NoteName extends Spelling {
    /** Scientific octave number; `4` contains middle C (C4 = MIDI 60). */
    readonly octave: number;
}
export declare function spelling(step: number, alteration?: number): Spelling;
export declare function noteName(step: number, alteration: number, octave: number): NoteName;
export declare function letterOfSpelling(s: Spelling): Letter;
/** Textual accidental for an alteration (`##`, `b`, empty for natural). */
export declare function accidentalText(alteration: number): string;
/** Unicode accidental glyph for an alteration. */
export declare function accidentalGlyph(alteration: number): string;
/** `D#`, `Bbb`, `C` — ASCII-friendly display spelling. */
export declare function formatSpelling(s: Spelling): string;
export declare function formatNoteName(n: NoteName): string;
/** Pitch class of a spelling (the lossy projection `spell → pc`). */
export declare function spellingToPc(s: Spelling): PitchClass;
export declare function noteNameToPc(n: NoteName): PitchClass;
/** Absolute MIDI number (C4 = 60). Middle C is `noteNameFrom('C4')`. */
export declare function noteNameToMidi(n: NoteName): number;
export declare function midiToPc(midi: number): PitchClass;
export declare function midiToOctave(midi: number): number;
/** Diatonic degree of a spelled note within its octave, 1-based (C=1 ... B=7). */
export declare function degreeOf(s: Spelling): number;
/**
 * Choose the conventional spelling for a pitch class inside a key signature.
 *
 * This is the "spelling problem": given only a residue, which letter do we draw?
 * We resolve it by preferring letters whose diatonic degree belongs to the key's
 * own degree set, then by minimizing absolute alteration. It is deliberately
 * simple and pluggable — see {@link spellWithDegrees}.
 */
export declare function spellInKey(target: PitchClass, keyScale: readonly PitchClass[]): Spelling;
/**
 * Generic spelling resolver used by presenters: given a pc-set context (scale or
 * chord tones) produce a stable spelling for every member. Exported separately so
 * instrument presenters can request spellings without knowing about keys.
 */
export declare function spellWithDegrees(target: PitchClass, contextDegrees: readonly number[]): Spelling;
/**
 * Parse common textual forms: `C#`, `Eb`, `Bbb`, `F##`, `A#4`, `C-2`.
 * Round-trips with {@link formatNoteName} for the usual cases.
 */
export declare function parseNoteName(input: string): NoteName;
/** All 17 common spellings of the chromatic total, ordered by pitch class. */
export declare const COMMON_SPELLINGS: readonly Spelling[];
//# sourceMappingURL=spelling.d.ts.map