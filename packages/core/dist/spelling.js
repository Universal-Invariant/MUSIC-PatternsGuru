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
import { pc } from './pitch-class.js';
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Semitone offset of each natural letter above C. */
export const LETTER_SEMITONE = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};
/** Diatonic step index for each letter. */
export const LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
export const STEP_LETTER = LETTERS;
/** Accidental glyphs, indexed by alteration clamped to a printable range. */
const SHARP_GLYPHS = ['', '#', '##', '###', '####'];
const FLAT_GLYPHS = ['', 'b', 'bb', 'bbb', 'bbbb'];
const UNICODE_SHARP = '\u{1D12E}';
const UNICODE_FLAT = '\u{1D12B}';
const UNICODE_NATURAL = '\u{266E}';
const UNICODE_DOUBLE_SHARP = '\u{1D12A}';
const UNICODE_DOUBLE_FLAT = '\u{1D12B}\u{1D12B}';
export function isLetter(value) {
    return LETTERS.includes(value.toUpperCase()[0] ?? '');
}
/** Parse a single letter (with optional lowercase) into a {@link Letter}. */
export function letterOf(value) {
    const c = value.trim().charAt(0).toUpperCase();
    if (!isLetter(c))
        throw new TypeError(`Not a note letter: ${JSON.stringify(value)}`);
    return c;
}
export function spelling(step, alteration = 0) {
    const s = ((Math.trunc(step) % 7) + 7) % 7;
    return { step: s, alteration: Math.trunc(alteration) };
}
export function noteName(step, alteration, octave) {
    const sp = spelling(step, alteration);
    return { step: sp.step, alteration: sp.alteration, octave: Math.trunc(octave) };
}
export function letterOfSpelling(s) {
    return STEP_LETTER[s.step] ?? 'C';
}
/** Textual accidental for an alteration (`##`, `b`, empty for natural). */
export function accidentalText(alteration) {
    if (alteration === 0)
        return '';
    return alteration > 0
        ? (SHARP_GLYPHS[Math.min(alteration, 4)] ?? '#'.repeat(alteration))
        : (FLAT_GLYPHS[Math.min(-alteration, 4)] ?? 'b'.repeat(-alteration));
}
/** Unicode accidental glyph for an alteration. */
export function accidentalGlyph(alteration) {
    switch (alteration) {
        case 0:
            return UNICODE_NATURAL;
        case 1:
            return UNICODE_SHARP;
        case -1:
            return UNICODE_FLAT;
        case 2:
            return UNICODE_DOUBLE_SHARP;
        case -2:
            return UNICODE_DOUBLE_FLAT;
        default:
            return accidentalText(alteration);
    }
}
/** `D#`, `Bbb`, `C` — ASCII-friendly display spelling. */
export function formatSpelling(s) {
    return `${letterOfSpelling(s)}${accidentalText(s.alteration)}`;
}
export function formatNoteName(n) {
    return `${formatSpelling(n)}${n.octave}`;
}
/** Pitch class of a spelling (the lossy projection `spell → pc`). */
export function spellingToPc(s) {
    return pc(LETTER_SEMITONE[letterOfSpelling(s)] + s.alteration);
}
export function noteNameToPc(n) {
    return spellingToPc(n);
}
/** Absolute MIDI number (C4 = 60). Middle C is `noteNameFrom('C4')`. */
export function noteNameToMidi(n) {
    return 12 * (n.octave + 1) + spellingToPc(n);
}
export function midiToPc(midi) {
    return pc(Math.round(midi));
}
export function midiToOctave(midi) {
    return Math.floor(Math.round(midi) / 12) - 1;
}
/** Diatonic degree of a spelled note within its octave, 1-based (C=1 ... B=7). */
export function degreeOf(s) {
    return s.step + 1;
}
/**
 * Choose the conventional spelling for a pitch class inside a key signature.
 *
 * This is the "spelling problem": given only a residue, which letter do we draw?
 * We resolve it by preferring letters whose diatonic degree belongs to the key's
 * own degree set, then by minimizing absolute alteration. It is deliberately
 * simple and pluggable — see {@link spellWithDegrees}.
 */
export function spellInKey(target, keyScale) {
    const degrees = keyScale.map((k) => pc(k));
    const candidates = [];
    for (let step = 0; step < 7; step++) {
        for (let alt = -2; alt <= 2; alt++) {
            const s = spelling(step, alt);
            if (spellingToPc(s) === target)
                candidates.push(s);
        }
    }
    if (candidates.length === 0)
        return spelling(0, target); // unreachable, keeps types honest
    candidates.sort((a, b) => {
        const aIn = degrees.includes(spellingToPc(a)) ? 0 : 1;
        const bIn = degrees.includes(spellingToPc(b)) ? 0 : 1;
        if (aIn !== bIn)
            return aIn - bIn;
        return Math.abs(a.alteration) - Math.abs(b.alteration) || a.step - b.step;
    });
    return candidates[0];
}
/**
 * Generic spelling resolver used by presenters: given a pc-set context (scale or
 * chord tones) produce a stable spelling for every member. Exported separately so
 * instrument presenters can request spellings without knowing about keys.
 */
export function spellWithDegrees(target, contextDegrees) {
    let best;
    for (let step = 0; step < 7; step++) {
        if (!contextDegrees.includes(step + 1))
            continue;
        for (let alt = -2; alt <= 2; alt++) {
            const s = spelling(step, alt);
            if (spellingToPc(s) === pc(target)) {
                if (!best || Math.abs(s.alteration) < Math.abs(best.alteration))
                    best = s;
            }
        }
    }
    return best ?? spellInKey(pc(target), []);
}
/**
 * Parse common textual forms: `C#`, `Eb`, `Bbb`, `F##`, `A#4`, `C-2`.
 * Round-trips with {@link formatNoteName} for the usual cases.
 */
export function parseNoteName(input) {
    const m = /^\s*([A-Ga-g])\s*([#b\u266F\u266D]*)(?:\s*(-?\d+))?\s*$/.exec(input);
    if (!m)
        throw new TypeError(`Cannot parse note name: ${JSON.stringify(input)}`);
    const step = LETTER_STEP[letterOf(m[1])];
    let alteration = 0;
    for (const ch of m[2] ?? '') {
        if (ch === '#' || ch === '\u266F')
            alteration += 1;
        else if (ch === 'b' || ch === '\u266D')
            alteration -= 1;
    }
    const octave = m[3] === undefined ? 4 : Number.parseInt(m[3], 10);
    return noteName(step, alteration, octave);
}
/** All 17 common spellings of the chromatic total, ordered by pitch class. */
export const COMMON_SPELLINGS = [
    spelling(0, 0),
    spelling(0, 1),
    spelling(1, 0),
    spelling(1, 1),
    spelling(2, 0),
    spelling(3, -1),
    spelling(3, 0),
    spelling(3, 1),
    spelling(4, 0),
    spelling(4, 1),
    spelling(5, 0),
    spelling(5, 1),
    spelling(6, 0),
    spelling(6, -1),
    spelling(0, -1),
    spelling(0, 0),
];
//# sourceMappingURL=spelling.js.map