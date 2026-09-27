/**
 * The instrument abstraction — the heart of the plugin architecture.
 *
 * An instrument is *only* a coordinate system plus a mapping into and out of
 * pitch space. Nothing about drawing, colour, or notation lives here. That is
 * deliberate: it means adding a new instrument is a small, pure, testable module
 * with no rendering code at all, and it means the same visualization logic works
 * on a fretboard, a keyboard, a flute's key chart, or a trumpet's valve table.
 *
 * ## The adjunction
 *
 * `pitchToPosition` and `positionToPitch` are not required to be inverses. On a
 * guitar, `pitchToPosition(67)` returns several candidates (5th string 2nd fret,
 * 4th string 10th fret, ...) while `positionToPitch` returns exactly one. Formally
 * we have an adjunction between the preorder of pitches (by register) and the
 * preorder of positions (by playability):
 *
 *     positions(pitch) ⊣ pitch(position)
 *
 * The "lossiness" of each direction is first-class data:
 *   - `many-to-one`  → enharmonic collapse (piano: D# = Eb)
 *   - `one-to-many`  → octave/string ambiguity (fretboard, harp)
 *   - `partial`      → notes outside range, or impossible fingerings
 *
 * Presenters ask for *all* candidates and decide how to display the multiplicity
 * (ghost markers, badges, "also available at…" hints).
 */
export const DEFAULT_CAPABILITIES = {
    polyphonicPositions: false,
    enharmonicEquivalent: true,
    continuousPitch: false,
    timbralVariation: false,
    voicingConstrained: false,
    transposing: false,
    microtonal: false,
};
/** Convenience: build a position id from two axis indices. */
export function posId(row, col, prefix = '') {
    return `${prefix}${row}:${col}`;
}
/** Parse a `row:col` id back into coordinates (presenter hit-testing helper). */
export function parsePosId(id) {
    const m = /^(\d+):(\d+)$/.exec(id);
    if (!m)
        return undefined;
    return { row: Number(m[1]), col: Number(m[2]) };
}
/** MIDI number of a position, respecting optional transposition offset. */
export function soundingMidi(binding, transposeBy = 0) {
    if (binding.kind === 'exact')
        return binding.midi + transposeBy;
    if (binding.kind === 'class')
        return undefined;
    return undefined;
}
/**
 * Map a set of pitch classes onto an instrument, returning the position ids that
 * should light up. This is the single most-called function in the app: every
 * pattern view, every overlay, every relation group goes through it.
 */
export function highlightPositions(instrument, pcs, options = {}) {
    const out = new Set();
    for (const p of pcs) {
        for (const cand of instrument.pitchClassToPositions(p)) {
            if (!options.includeNonPreferred && !cand.preferred)
                continue;
            out.add(cand.position.id);
        }
    }
    return out;
}
/** Base MIDI for a tuning/open-string note, so instruments share one helper. */
export function openStringMidi(letterPc, octave) {
    return 12 * (octave + 1) + ((letterPc % 12) + 12) % 12;
}
//# sourceMappingURL=instrument.js.map