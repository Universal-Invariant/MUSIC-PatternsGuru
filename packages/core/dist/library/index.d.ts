/**
 * The pattern library: named, root-less templates plus the computed harmony that
 * makes "chords within scales / scales containing chords" possible.
 */
export * from './template.js';
export * from './scales.js';
export * from './chords.js';
export * from './keys.js';
export * from './harmony.js';
import { type Pattern } from '../pattern.js';
import { type PitchClass } from '../pitch-class.js';
import { type Template } from './template.js';
/** Every template in the library (scales + chords), for search UIs. */
export declare const ALL_TEMPLATES: readonly Template[];
/** Look a template up by id, name, alias, or chord symbol (`m7`, `dorian`). */
export declare function findTemplate(query: string): Template | undefined;
/**
 * Parse free-text pattern queries used by the search box.
 *
 *   "D dorian"          → rooted scale
 *   "Gb maj7#11"        → rooted chord
 *   "harmonic minor"    → unrooted (C-rooted) scale
 *   "7"                 → root shorthand only → chromatic-ish fallback rejected
 */
export declare function parsePatternQuery(query: string): Pattern | undefined;
/** Root a template at a pitch class, with a human-readable name. */
export declare function rootTemplateAt(t: Template, note: PitchClass | string): Pattern;
//# sourceMappingURL=index.d.ts.map