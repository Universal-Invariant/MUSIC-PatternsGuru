/**
 * Generic fretted-instrument engine.
 *
 * One implementation covers 6-string guitar, bass, mandolin, ukulele, 7-string
 * extended-range guitars, and (with a `fretsPerString` cap) even bowed strings if
 * we ever want a fingerboard grid model. The engine is pure: it knows about
 * tunings, fret counts, and offsets — nothing about drawing.
 *
 * Coordinate convention (matches `@mpg/core` `Position`):
 *   row : string index, 0 = highest pitch (1st string / thinnest). Larger row ⇒
 *         lower-pitched string, so rows increase *downwards* on screen.
 *   col : fret number, 0 = open string. Larger col ⇒ higher pitch, rightwards.
 *
 * Preference ordering for `pitchToPositions` implements a simple, honest notion
 * of playability: prefer positions reachable with the fewest frets, break ties by
 * preferring lower-pitched strings (room to bend above), then by distance from a
 * reference centre position. This is what makes "one marker per note" views look
 * like a sane fingering rather than noise.
 */
import { posId, DEFAULT_CAPABILITIES, } from '@mpg/core';
import { pc } from '@mpg/core';
/** Standard 6-string guitar tuning, high → low. */
export const STANDARD_TUNING = [
    { openMidi: 64, name: 'E' }, // E4
    { openMidi: 59, name: 'B' }, // B3
    { openMidi: 55, name: 'G' }, // G3
    { openMidi: 50, name: 'D' }, // D3
    { openMidi: 45, name: 'A' }, // A2
    { openMidi: 40, name: 'E' }, // E2
];
/** Common alternate tunings, exposed for the UI's tuning picker. */
export const GUITAR_TUNINGS = {
    standard: STANDARD_TUNING,
    dropD: [
        { openMidi: 64, name: 'E' },
        { openMidi: 59, name: 'B' },
        { openMidi: 55, name: 'G' },
        { openMidi: 50, name: 'D' },
        { openMidi: 45, name: 'A' },
        { openMidi: 38, name: 'D' },
    ],
    openG: [
        { openMidi: 67, name: 'G' },
        { openMidi: 59, name: 'B' },
        { openMidi: 55, name: 'G' },
        { openMidi: 50, name: 'D' },
        { openMidi: 43, name: 'G' },
        { openMidi: 38, name: 'D' },
    ],
    dadgad: [
        { openMidi: 62, name: 'D' },
        { openMidi: 57, name: 'A' },
        { openMidi: 55, name: 'G' },
        { openMidi: 50, name: 'D' },
        { openMidi: 45, name: 'A' },
        { openMidi: 40, name: 'D' },
    ],
    halfStepDown: STANDARD_TUNING.map((s) => ({ ...s, openMidi: s.openMidi - 1 })),
};
export const BASS_TUNING = [
    { openMidi: 43, name: 'G' },
    { openMidi: 38, name: 'D' },
    { openMidi: 33, name: 'A' },
    { openMidi: 28, name: 'E' },
];
export const MANDOLIN_TUNING = [
    { openMidi: 79, name: 'E' },
    { openMidi: 72, name: 'A' },
    { openMidi: 67, name: 'D' },
    { openMidi: 60, name: 'G' },
];
const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Build an {@link Instrument} from a fretted configuration. Pure + memoized. */
export function createFrettedInstrument(config) {
    const nut = config.nutOffset ?? 0;
    const stringCount = config.strings.length;
    const numFrets = config.numFrets;
    const centre = config.centre ?? [Math.floor(stringCount / 2), 5];
    const positions = [];
    const byId = new Map();
    const byPc = new Map();
    for (let row = 0; row < stringCount; row++) {
        const spec = config.strings[row];
        for (let col = 0; col <= numFrets; col++) {
            const midi = spec.openMidi + col + nut;
            const label = col === 0 ? `open ${spec.name}` : `${col}fr · ${spec.name}`;
            const p = {
                id: posId(row, col, `${config.id}:`),
                label,
                row,
                col,
                midi,
                group: `string-${row}`,
            };
            positions.push(p);
            byId.set(p.id, p);
            const target = pc(midi);
            const list = byPc.get(target) ?? [];
            list.push({ position: p, preferred: false, cost: costOf(row, col, centre) });
            byPc.set(target, list);
        }
    }
    // Mark exactly one preferred candidate per pitch class: lowest cost wins.
    for (const list of byPc.values()) {
        list.sort((a, b) => a.cost - b.cost || a.position.row - b.position.row);
        const first = list[0];
        if (first)
            list[0] = { ...first, preferred: true };
    }
    const lowMidi = Math.min(...positions.map((p) => p.midi ?? 0));
    const highMidi = Math.max(...positions.map((p) => p.midi ?? 0));
    const range = { lowMidi, highMidi, contiguous: true };
    const layout = {
        rows: stringCount,
        cols: numFrets + 1,
        axisLabels: ['string', 'fret'],
        orientation: 'horizontal',
        metric: 'uniform',
        ...config.layout,
    };
    return {
        id: config.id,
        name: config.name,
        family: 'fretted-string',
        summary: config.summary,
        range,
        positions: () => positions,
        positionAt: (id) => byId.get(id),
        pitchToPositions: (midi) => byPc.get(pc(midi)) ?? [],
        pitchClassToPositions: (target) => byPc.get(pc(target)) ?? [],
        positionToPitch: (p) => p.midi !== undefined ? { kind: 'exact', midi: p.midi } : { kind: 'none' },
        layout: () => layout,
        capabilities: () => ({
            ...DEFAULT_CAPABILITIES,
            polyphonicPositions: true,
            enharmonicEquivalent: true,
            continuousPitch: true,
            timbralVariation: true,
            voicingConstrained: true,
        }),
    };
}
function costOf(row, col, centre) {
    const fretPenalty = col === 0 ? 0 : col; // open strings are cheap but...
    const rowDist = Math.abs(row - centre[0]);
    const colDist = Math.abs(col - centre[1]);
    // Prefer mid-fret-region, low strings, compact hand shapes.
    return fretPenalty * 1.0 + colDist * 0.35 + rowDist * 0.5;
}
/** Convenience: human-readable note name for a MIDI number (sharps). */
export function midiLabel(midi) {
    const n = Math.round(midi);
    return `${PC_NAMES[pc(n)]}${Math.floor(n / 12) - 1}`;
}
//# sourceMappingURL=fretted.js.map