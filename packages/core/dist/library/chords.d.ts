/**
 * Chord / arpeggio templates.
 *
 * Degrees are labelled against the major scale so `m7` = `1 b3 5 b7` and a
 * dominant `7` = `1 3 5 b7`. That single convention is what makes tonal notation
 * (coloring by function) work uniformly across scales and chords: a `b7` is the
 * same colour whether it came from Mixolydian or from G7 in C.
 */
import { type Template } from './template.js';
export declare const CHORD_TEMPLATES: readonly Template[];
/** Lookup by symbol-ish query (`m7`, `maj7#5`, `dim`). */
export declare function findChordTemplate(query: string): Template | undefined;
//# sourceMappingURL=chords.d.ts.map