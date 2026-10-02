/**
 * The pattern library: named, root-less templates plus the computed harmony that
 * makes "chords within scales / scales containing chords" possible.
 */

export * from './template.js';
export * from './scales.js';
export * from './chords.js';
export * from './keys.js';
export * from './harmony.js';
export * from './saved.js';

import { createPattern, type Pattern } from '../pattern.js';
import type { Spelling } from '../spelling.js';
import { pc, type PitchClass } from '../pitch-class.js';
import { CHORD_TEMPLATES } from './chords.js';
import { SCALE_TEMPLATES } from './scales.js';
import { DEFAULT_ROOT_SPELLINGS, parseRootShorthand, rootLabel, type Template } from './template.js';

/** Every template in the library (scales + chords), for search UIs. */
export const ALL_TEMPLATES: readonly Template[] = [...SCALE_TEMPLATES, ...CHORD_TEMPLATES];

/** Look a template up by id, name, alias, or chord symbol (`m7`, `dorian`). */
export function findTemplate(query: string): Template | undefined {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  return ALL_TEMPLATES.find(
    (t) =>
      t.id.toLowerCase() === q ||
      t.name.toLowerCase().replace(/\s+/g, '') === q ||
      t.aliases.some((a) => a.toLowerCase().replace(/\s+/g, '') === q),
  );
}

/**
 * Parse free-text pattern queries used by the search box.
 *
 *   "D dorian"          → rooted scale
 *   "Gb maj7#11"        → rooted chord
 *   "harmonic minor"    → unrooted (C-rooted) scale
 *   "7"                 → root shorthand only → chromatic-ish fallback rejected
 */
export function parsePatternQuery(query: string): Pattern | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  // Try "<root> <template>" first.
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const head = parts[0]!;
    const rest = parts.slice(1).join(' ');
    let rootPc: PitchClass | undefined;
    try {
      if (/^[A-Ga-g][#b\u266F\u266D]*$/.test(head)) rootPc = parseRootShorthand(head);
    } catch {
      rootPc = undefined;
    }
    if (rootPc !== undefined) {
      const t = findTemplate(rest);
      if (t) return rootTemplateAt(t, rootPc);
    }
  }

  const single = findTemplate(trimmed);
  if (single) return rootTemplateAt(single, 0);
  return undefined;
}

/**
 * Root a template at a pitch class or note-name string, with a human-readable
 * name and an enharmonic letter anchor. When `note` is a string like `Eb`, the
 * typed spelling wins over the default table (so users can request `A# lydian`
 * explicitly even though pc 10 usually prefers flats).
 */
export function rootTemplateAt(t: Template, note: PitchClass | string = 0): Pattern {
  const r = typeof note === 'number' ? pc(note) : parseRootShorthand(note);
  const rootSpelling = typeof note === 'string' ? spellingFromToken(note) ?? DEFAULT_ROOT_SPELLINGS[r]! : DEFAULT_ROOT_SPELLINGS[r]!;
  return createPattern({
    id: `${t.id}@${r}`,
    name: `${rootLabel(r, rootSpelling.alteration < 0)} ${t.name}`,
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

const LETTER_STEP_MAP: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11];

function spellingFromToken(token: string): Spelling | undefined {
  const key = token.trim().toLowerCase().replace(/\u266F/g, '#').replace(/\u266D/g, 'b');
  const m = /^([a-g])([#b]*)$/.exec(key);
  if (!m) return undefined;
  const step = LETTER_STEP_MAP[m[1]!]!;
  let alteration = 0;
  for (const ch of m[2] ?? '') alteration += ch === '#' ? 1 : -1;
  void LETTER_PCS;
  return { step, alteration };
}
