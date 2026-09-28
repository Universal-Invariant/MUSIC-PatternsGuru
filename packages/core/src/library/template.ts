/**
 * The pattern library: named shapes with no root attached.
 *
 * A {@link Template} is a `Pattern` with `root = 0`. Rooting it (`root()`) yields
 * a concrete pattern; enumerating all roots yields a family. Templates are the
 * unit that search, import/export, and user "my library" features operate on.
 */

import {
  createPattern,
  degreeLabelForStep,
  type DegreeAnnotation,
  type Pattern,
  type PatternKind,
} from '../pattern.js';
import { pc, type PitchClass } from '../pitch-class.js';
import { spelling, type Spelling } from '../spelling.js';

export interface Template {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly kind: PatternKind;
  readonly steps: readonly number[];
  /**
   * Degree annotation per step. Accepts bare labels (`['1', 'b3', '5']`) or
   * `[semitonesAboveRoot, label]` pairs (the pairing keeps a label such as `'9'`
   * attached to its own octave placement when steps are normalized/sorted).
   */
  readonly degrees: readonly DegreeAnnotation[];
  readonly tags: readonly string[];
  readonly comment?: string;
  /** Family grouping used by the UI (`major`, `harmonic-minor`, ...). */
  readonly family?: string;
}

export function template(input: {
  id: string;
  name: string;
  kind: PatternKind;
  steps: readonly number[];
  degrees?: readonly DegreeAnnotation[];
  aliases?: readonly string[];
  tags?: readonly string[];
  comment?: string;
  family?: string;
}): Template {
  const steps = [...new Set(input.steps.map(pc))].sort((a, b) => a - b);
  return {
    id: input.id,
    name: input.name,
    aliases: input.aliases ?? [],
    kind: input.kind,
    steps,
    degrees: input.degrees ?? steps.map((st) => [st, degreeLabelForStep(st)] as const),
    tags: input.tags ?? [],
    comment: input.comment,
    family: input.family,
  };
}

/**
 * Letter anchor for each pitch class. Index = pitch class; value = preferred
 * (letter-step, alteration) pair. Flat-side classes (Db/Eb/Gb/Ab/Bb) are spelled
 * with flats — the standard convention when the root itself is a flat note —
 * while sharp/natural classes keep sharps. Callers may override per-pattern.
 */
export const DEFAULT_ROOT_SPELLINGS: readonly Spelling[] = [
  spelling(0, 0), // C
  spelling(1, -1), // Db
  spelling(1, 0), // D
  spelling(2, -1), // Eb
  spelling(2, 0), // E
  spelling(3, 0), // F
  spelling(4, 1), // F#
  spelling(4, 0), // G
  spelling(5, -1), // Ab
  spelling(5, 0), // A
  spelling(6, -1), // Bb
  spelling(6, 0), // B
];

/** Attach a root to a template → concrete pattern. */
export function root(t: Template, note: PitchClass | string = 0, preferFlats = false): Pattern {
  const parsed = typeof note === 'string' ? parseRootShorthandWithSpelling(note) : undefined;
  const r = typeof note === 'number' ? pc(note) : parsed!.pc;
  const rootSpelling = parsed?.spelling ?? DEFAULT_ROOT_SPELLINGS[r]!;
  return createPattern({
    id: `${t.id}@${r}${preferFlats ? '@flat' : ''}`,
    name: `${rootLabel(r, preferFlats || rootSpelling.alteration < 0)} ${t.name}`,
    kind: t.kind,
    root: r,
    steps: t.steps,
    degrees: t.degrees,
    rootSpelling,
    tags: t.tags,
    source: 'library',
    comment: t.comment,
  });
}

/** Parse a root token, preserving the *spelling* the user typed (`Eb` vs `D#`). */
function parseRootShorthandWithSpelling(value: string): { pc: PitchClass; spelling: Spelling } {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/\u266F/g, '#')
    .replace(/\u266D/g, 'b');
  const m = /^([a-g])([#b]*)$/.exec(key);
  if (!m) return { pc: parseRootShorthand(value), spelling: DEFAULT_ROOT_SPELLINGS[parseRootShorthand(value)]! };
  const LETTER_STEP: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
  const step = LETTER_STEP[m[1]!]!;
  let alteration = 0;
  for (const ch of m[2] ?? '') alteration += ch === '#' ? 1 : -1;
  const table = [0, 2, 4, 5, 7, 9, 11];
  const pcs = ((table[step]! + alteration) % 12 + 12) % 12;
  return { pc: pcs, spelling: { step, alteration } };
}

/** All distinct rooted copies of a template. */
export function family(t: Template): Pattern[] {
  const seen = new Set<string>();
  const out: Pattern[] = [];
  for (let n = 0; n < 12; n++) {
    const p = root(t, n);
    const key = p.steps.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export function rootLabel(n: PitchClass, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pc(n)] ?? '?';
}

/** Accept `C`, `c#`, `Eb`, `7`, or a pitch class number. */
export function parseRootShorthand(value: string | number): PitchClass {
  if (typeof value === 'number') return pc(value);
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return pc(Number(trimmed));
  const table: Record<string, number> = {
    c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6,
    g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11, cb: 11, bs: 0,
  };
  const key = trimmed.toLowerCase().replace(/\u266F/g, '#').replace(/\u266D/g, 'b');
  if (key in table) return table[key]!;
  throw new TypeError(`Unrecognized root: ${JSON.stringify(value)}`);
}
