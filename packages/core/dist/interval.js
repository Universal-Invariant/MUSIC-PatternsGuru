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
import { pcSub } from './pitch-class.js';
import { LETTER_SEMITONE, STEP_LETTER } from './spelling.js';
/** All simple intervals in ascending order. */
export const INTERVAL_IDS = [
    'P1',
    'm2',
    'M2',
    'm3',
    'M3',
    'P4',
    'TT',
    'P5',
    'm6',
    'M6',
    'm7',
    'M7',
    'P8',
];
const SPECS = [
    { id: 'P1', semitones: 0, degree: 1, perfect: true, name: 'Perfect unison', short: 'P1' },
    { id: 'm2', semitones: 1, degree: 2, perfect: false, name: 'Minor second', short: 'm2' },
    { id: 'M2', semitones: 2, degree: 2, perfect: false, name: 'Major second', short: 'M2' },
    { id: 'm3', semitones: 3, degree: 3, perfect: false, name: 'Minor third', short: 'm3' },
    { id: 'M3', semitones: 4, degree: 3, perfect: false, name: 'Major third', short: 'M3' },
    { id: 'P4', semitones: 5, degree: 4, perfect: true, name: 'Perfect fourth', short: 'P4' },
    { id: 'TT', semitones: 6, degree: 4, perfect: true, name: 'Tritone', short: 'TT' },
    { id: 'P5', semitones: 7, degree: 5, perfect: true, name: 'Perfect fifth', short: 'P5' },
    { id: 'm6', semitones: 8, degree: 6, perfect: false, name: 'Minor sixth', short: 'm6' },
    { id: 'M6', semitones: 9, degree: 6, perfect: false, name: 'Major sixth', short: 'M6' },
    { id: 'm7', semitones: 10, degree: 7, perfect: false, name: 'Minor seventh', short: 'm7' },
    { id: 'M7', semitones: 11, degree: 7, perfect: false, name: 'Major seventh', short: 'M7' },
    { id: 'P8', semitones: 12, degree: 8, perfect: true, name: 'Perfect octave', short: 'P8' },
];
const BY_SEMITONES = new Map();
for (const s of SPECS)
    if (!BY_SEMITONES.has(s.semitones))
        BY_SEMITONES.set(s.semitones, s);
const BY_ID = new Map(SPECS.map((s) => [s.id, s]));
export function isPerfectDegree(degree) {
    const d = ((degree - 1) % 7 + 7) % 7 + 1;
    return d === 1 || d === 4 || d === 5 || d === 8;
}
/** Number of octaves contained in an absolute semitone span. */
export function compoundOf(semitones) {
    return Math.floor(Math.abs(semitones) / 12);
}
/** Reduce any semitone span into `[0, 12)` (interval class, ascending). */
export function simplifySemitones(semitones) {
    return ((Math.trunc(semitones) % 12) + 12) % 12;
}
/**
 * Build an interval from its two measurements. Quality is derived, never guessed:
 * we compare the actual semitone count against the reference semitone count for
 * that diatonic span.
 */
export function makeInterval(semitones, letterSteps) {
    const sign = semitones < 0 ? -1 : 1;
    const absSemis = Math.abs(semitones);
    const absLetters = Math.abs(letterSteps);
    const degree = absLetters + 1; // 1-based diatonic degree
    const withinOctaves = absLetters % 7;
    const simpleDegree = withinOctaves + 1;
    const simpleSemitones = absSemis % 12;
    const natural = naturalSemitonesFor(simpleDegree);
    const perfect = isPerfectDegree(simpleDegree);
    const delta = simpleSemitones - natural;
    let qualityText;
    let shortQuality;
    if (perfect) {
        if (delta === 0)
            [qualityText, shortQuality] = ['Perfect', 'P'];
        else if (delta === -1)
            [qualityText, shortQuality] = ['Diminished', 'd'];
        else if (delta === 1)
            [qualityText, shortQuality] = ['Augmented', 'A'];
        else if (delta === -2)
            [qualityText, shortQuality] = ['Doubly diminished', 'dd'];
        else if (delta === 2)
            [qualityText, shortQuality] = ['Doubly augmented', 'AA'];
        else
            [qualityText, shortQuality] = [`${delta > 0 ? '+' : ''}${delta} semitones`, `${delta}`];
    }
    else {
        if (delta === 0)
            [qualityText, shortQuality] = ['Major', 'M'];
        else if (delta === -1)
            [qualityText, shortQuality] = ['Minor', 'm'];
        else if (delta === -2)
            [qualityText, shortQuality] = ['Diminished', 'd'];
        else if (delta === 1)
            [qualityText, shortQuality] = ['Augmented', 'A'];
        else if (delta === -3)
            [qualityText, shortQuality] = ['Doubly diminished', 'dd'];
        else if (delta === 2)
            [qualityText, shortQuality] = ['Doubly augmented', 'AA'];
        else
            [qualityText, shortQuality] = [`${delta > 0 ? '+' : ''}${delta} semitones`, `${delta}`];
    }
    const compoundPrefix = absLetters >= 7 ? `Compound ${degreeName(simpleDegree)} (${degree}) ` : '';
    const baseName = `${qualityText} ${degreeName(simpleDegree)}`;
    const ordinal = sign < 0 ? 'Descending ' : '';
    return {
        semitones: semitones,
        letterSteps: letterSteps,
        name: `${ordinal}${compoundPrefix}${baseName}`.trim(),
        short: `${shortQuality}${degree}`,
        perfect,
    };
}
/** Natural (unmodified) semitone count for a simple diatonic degree. */
export function naturalSemitonesFor(degree) {
    const table = [0, 2, 4, 5, 7, 9, 11];
    const idx = ((degree - 1) % 7 + 7) % 7;
    const octaves = Math.floor(((degree - 1) % 7 + 7) / 7);
    return (table[idx] ?? 0) + 12 * octaves;
}
const DEGREE_NAMES = [
    'unison',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'octave',
    'ninth',
    'tenth',
    'eleventh',
    'twelfth',
    'thirteenth',
];
export function degreeName(degree) {
    return DEGREE_NAMES[degree - 1] ?? `${degree}th`;
}
/** Canonical simple interval for a semitone span (no spelling information). */
export function intervalBySemitones(semitones) {
    const spec = BY_SEMITONES.get(simplifySemitones(semitones)) ?? SPECS[0];
    return makeInterval(semitones, spec.degree - 1);
}
/** Look up by identifier (`'M3'`, `'P5'`, `'TT'`). */
export function intervalById(id) {
    const spec = BY_ID.get(id);
    if (!spec)
        throw new TypeError(`Unknown interval id: ${JSON.stringify(id)}`);
    return makeInterval(spec.semitones, spec.degree - 1);
}
/** Ascending pitch-class interval between two pitch classes. */
export function pcInterval(a, b) {
    return intervalBySemitones(pcSub(b, a));
}
/**
 * Interval between two spelled notes, using both measurements. Octave difference
 * contributes 7 letter steps per octave.
 */
export function spelledInterval(low, high) {
    const loOct = low.octave ?? 0;
    const hiOct = high.octave ?? 0;
    const letterSteps = high.step - low.step + 7 * (hiOct - loOct);
    const loSemi = LETTER_SEMITONE[STEP_LETTER[low.step] ?? 'C'] + low.alteration + 12 * loOct;
    const hiSemi = LETTER_SEMITONE[STEP_LETTER[high.step] ?? 'C'] + high.alteration + 12 * hiOct;
    return makeInterval(hiSemi - loSemi, letterSteps);
}
/** Invert an interval across an octave (`complementWithinOctave(P5) = P4`). */
export function invertWithinOctave(iv) {
    const semi = 12 - simplifySemitones(iv.semitones);
    const letters = 7 - (Math.abs(iv.letterSteps) % 7);
    return makeInterval(semi, letters);
}
/** True when the interval is consonant in the common-practice sense. */
export function isConsonant(iv) {
    const simple = simplifySemitones(iv.semitones);
    const perfectFamily = iv.perfect && (simple === 0 || simple === 5 || simple === 7);
    return perfectFamily || simple === 3 || simple === 4 || simple === 8 || simple === 9;
}
/** Aggregate interval vector (prime form analysis helper, index = ic). */
export function intervalVector(pcs) {
    const v = new Array(7).fill(0);
    const list = [...new Set(pcs.map((p) => ((p % 12) + 12) % 12))];
    for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
            const d = pcInterval(list[a], list[b]).semitones;
            const ic = Math.min(d, 12 - d);
            v[ic] = (v[ic] ?? 0) + 1;
        }
    }
    return v;
}
/** Unique normal-order rotation of a pc-set (Babbard-style canonicalization). */
export function normalOrder(pcs) {
    const set = [...new Set(pcs.map((p) => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
    if (set.length <= 1)
        return set;
    let best = set;
    let bestSpan = Infinity;
    for (let start = 0; start < set.length; start++) {
        const rot = [...set.slice(start), ...set.slice(0, start)];
        const first = rot[0];
        const last = rot[rot.length - 1];
        const span = ((last - first) % 12 + 12) % 12;
        if (span < bestSpan) {
            bestSpan = span;
            best = rot;
        }
    }
    return best;
}
/** Transpose-and-invert search for the closest prime form partner (lightweight). */
export function transpositionallyEquivalent(a, b) {
    const na = normalOrder(a);
    const nb = normalOrder(b);
    if (na.length !== nb.length)
        return false;
    for (let n = 0; n < 12; n++) {
        const shifted = nb.map((x) => (x + n) % 12);
        if (normalOrder(shifted).join(',') === na.join(','))
            return true;
    }
    return false;
}
//# sourceMappingURL=interval.js.map