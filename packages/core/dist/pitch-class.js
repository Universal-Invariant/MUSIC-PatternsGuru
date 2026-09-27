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
export const PC_MODULUS = 12;
/** Wrap any integer into `[0, 12)` (true modulo, handles negatives). */
export function pc(n) {
    return ((Math.trunc(n) % PC_MODULUS) + PC_MODULUS) % PC_MODULUS;
}
/** Add pitch classes modulo 12 (translation / transposition in Z/12Z). */
export function pcAdd(a, b) {
    return pc(a + b);
}
/** Subtract pitch classes modulo 12. */
export function pcSub(a, b) {
    return pc(a - b);
}
/** Multiply pitch classes modulo 12 (used by modulatory / Messiaen-style maps). */
export function pcMul(a, b) {
    return pc(a * b);
}
export function pcInvert(a, axis = 0) {
    return pc(2 * axis - a);
}
/** Canonical transposition map `T_n`, as a reusable function. */
export function t(n) {
    return (x) => pcAdd(x, n);
}
/** Canonical inversion map `I_n` (`x ↦ n - x`), as a reusable function. */
export function i(n) {
    return (x) => pc(n - x);
}
/**
 * Interval between two pitch classes, normalized to the ascending complement
 * in `[0, 12)`. Direction-aware variants live in {@link interval}.
 */
export function pcDistance(a, b) {
    return pcSub(b, a);
}
/** Shortest distance between two pitch classes on the clock, in `[0, 6]`. */
export function pcIntervalClass(a, b) {
    const d = pcDistance(a, b);
    return Math.min(d, PC_MODULUS - d);
}
/** True when `x` lies on the ascending path from `start` to `stop` (mod 12). */
export function pcInclusiveBetween(start, stop, x) {
    const span = pcDistance(start, stop);
    return pcDistance(start, x) <= span;
}
/** Iterate pitch classes ascending from `start` for `steps` semitones. */
export function pcRange(start, steps) {
    const out = [];
    for (let k = 0; k < steps; k++)
        out.push(pcAdd(start, k));
    return out;
}
/** Deduplicate + sort ascending, treating input as pitch classes. */
export function pcSet(values) {
    const s = new Set();
    for (const v of values)
        s.add(pc(v));
    return [...s].sort((x, y) => x - y);
}
/** Multiset-free membership test helper. */
export function pcContains(set, value) {
    return set.includes(pc(value));
}
/**
 * Complement of a pc-set within the chromatic total. Useful for "what is left
 * over" views (e.g. notes *not* in a scale, available tensions).
 */
export function pcComplement(set) {
    const has = new Set(set.map(pc));
    const out = [];
    for (let k = 0; k < PC_MODULUS; k++)
        if (!has.has(k))
            out.push(k);
    return out;
}
/** Rotate a list of pitch classes so `root` leads (mode extraction at pc level). */
export function pcRotateTo(set, root) {
    const sorted = pcSet(set);
    const idx = sorted.indexOf(pc(root));
    if (idx < 0)
        return sorted;
    return [...sorted.slice(idx), ...sorted.slice(0, idx)];
}
/** Cardinality-set name ( Forte-friendly shorthand). */
export function pcCardinalityName(size) {
    const names = [
        'empty',
        'singleton',
        'dyad',
        'trichord',
        'tetrachord',
        'pentachord',
        'hexachord',
        'heptachord',
        'octachord',
        'nonachord',
        'dechord',
        'undechord',
        'chromatic total',
    ];
    return names[size] ?? `${size}-tone set`;
}
//# sourceMappingURL=pitch-class.js.map