/**
 * Concrete instrument registry entries.
 *
 * Each export is a fully-formed `Instrument` built from the generic engines. The
 * web app and tests consume these directly; third-party plugins register their
 * own via {@link registerInstrument}.
 */
import { BASS_TUNING, GUITAR_TUNINGS, MANDOLIN_TUNING, STANDARD_TUNING, createFrettedInstrument, } from './fretted.js';
export const guitarStandard = createFrettedInstrument({
    id: 'guitar-standard',
    name: 'Guitar (Standard)',
    summary: '6 strings, E A D G B E, 24 frets.',
    strings: STANDARD_TUNING,
    numFrets: 24,
});
export const bassStandard = createFrettedInstrument({
    id: 'bass-standard',
    name: 'Bass (Standard)',
    summary: '4 strings, E A D G, 22 frets.',
    strings: BASS_TUNING,
    numFrets: 22,
});
export const mandolinStandard = createFrettedInstrument({
    id: 'mandolin-standard',
    name: 'Mandolin (Standard)',
    summary: '4 courses, G D A E (fifths), 21 frets.',
    strings: MANDOLIN_TUNING,
    numFrets: 21,
});
export const guitarDropD = createFrettedInstrument({
    id: 'guitar-dropd',
    name: 'Guitar (Drop D)',
    summary: '6 strings, D A D G B E, 24 frets.',
    strings: GUITAR_TUNINGS.dropD,
    numFrets: 24,
});
/** Built-in instruments keyed by id — the default plugin set. */
export const INSTRUMENTS = {
    [guitarStandard.id]: guitarStandard,
    [bassStandard.id]: bassStandard,
    [mandolinStandard.id]: mandolinStandard,
    [guitarDropD.id]: guitarDropD,
};
const registry = new Map(Object.entries(INSTRUMENTS));
/** Register (or replace) an instrument plugin at runtime. */
export function registerInstrument(instrument) {
    registry.set(instrument.id, instrument);
}
/** Look up a registered instrument by id. */
export function getInstrument(id) {
    return registry.get(id);
}
/** All registered instruments, for pickers. */
export function listInstruments() {
    return [...registry.values()];
}
//# sourceMappingURL=index.js.map