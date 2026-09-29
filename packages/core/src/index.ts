/**
 * @mpg/core — the business end of MUSIC-PatternsGuru.
 *
 * Everything exported here is pure TypeScript with zero DOM / framework /
 * rendering dependencies. It runs in Node, browsers, workers, and (eventually)
 * native shells. The visualization packages consume this API; nothing here ever
 * imports from them.
 *
 * Layering (bottom → top):
 *   pitch-class   Z/12Z algebra (pc, T_n, I_n, interval classes)
 *   spelling      diatonic letter + alteration (the un-quotiented side of pitch)
 *   interval      two-dimensional intervals (semitones × letter steps)
 *   pattern       ordered pc-subsets: scales, chords, modes, sets + algebra
 *   notation      blind / interval / letter / tonal labelling + palettes
 *   instrument    the pitch ⇄ position adjunction (plugin contract)
 *   presenter     scene → RenderFrame (markers, connectors, layers, effects)
 *   relations     semantic groups ("these positions mean the same thing")
 *   library       templates: scales, chords, keys, computed diatonic harmony
 */

export * from './pitch-class.js';
export * from './spelling.js';
export * from './interval.js';
export * from './pattern.js';
export * from './notation.js';
export * from './instrument.js';
export * from './presenter.js';
export * from './relations.js';
export * from './library/index.js';
