/**
 * The pattern algebra.
 *
 * A {@link Pattern} is a finite, *ordered* subset of pitch space — this single
 * abstraction covers scales (usually interval-ordered), arpeggios/chords
 * (usually stack-ordered), modes, symmetric cells, melodic fragments, and hand
 * shapes. Everything the visualizer draws is a pattern; instrument layouts,
 * notations, and relation layers are all just functors on patterns.
 *
 * Patterns are transpositionally structured: `transpose` moves the anchor while
 * preserving the intervallic skeleton, which is what makes "shape" reasoning
 * (guitar positions, piano fingerings, trumpet valve combos) possible at all.
 */

import { pc, pcAdd, pcSub, type PitchClass } from './pitch-class.js';
import {spellInKey, formatSpelling, type Spelling, spellingToPc} from './spelling.js';
import { intervalBySemitones, normalOrder } from './interval.js';

/** Ordered list of absolute semitones above the pattern's anchor (first = 0). */
export type Steps = readonly number[];

/** Stable identifier for a pattern shape, independent of root. */
export type PatternId = string;

/** Kinds of pattern recognized by the library and search index. */
export type PatternKind = 'scale' | 'chord' | 'arpeggio' | 'mode' | 'set' | 'melody';

/** How a pattern is built — drives search filters and provenance display. */
export type PatternSource =
  | 'manual'
  | 'library'
  | 'rotation'
  | 'stack'
  | 'subset'
  | 'combination'
  | 'derived';

export interface Pattern {
  readonly id: PatternId;
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly kind: PatternKind;
  /** Root / anchor / tonal center in `[0,12)`. */
  readonly root: PitchClass;
  /** Ordered semitone steps above `root`, ascending, first element 0. */
  readonly steps: Steps;
  /** Optional spelled members (same length as `steps`) for letter/tonal notation. */
  readonly spellings?: readonly (Spelling | undefined)[];
  /**
   * How the root itself is spelled (`Bb` vs `A#`). Drives every member's letter:
   * a flat-rooted pattern spells with flats, a sharp-rooted one with sharps, so
   * `F lydian` shows `B\u266f` while `G mixolydian` shows `F\u266e`.
   */
  readonly rootSpelling?: Spelling;
  /** Parent collection this pattern was derived from (modes, diatonic chords). */
  readonly parentId?: string;
  /** Degree of `parent` that anchors this pattern (1-based). */
  readonly parentDegree?: number;
  readonly source?: PatternSource;
  /** Free-form tags used by search (`jazz`, `messiaen`, `gypsy`, ...). */
  readonly tags?: readonly string[];
  readonly comment?: string;
}

/** Normalize steps: dedupe mod 12, keep first occurrence, sort ascending. */
export function normalizeSteps(steps: Iterable<number>): number[] {
  const seen = new Map<number, number>();
  for (const raw of steps) {
    const s = pc(raw);
    if (!seen.has(s)) seen.set(s, raw === 0 ? 0 : s);
  }
  return [...seen.keys()].sort((a, b) => a - b);
}

/** Create a pattern from root + steps, filling in derived fields. */
export interface CreatePatternInput {
  id?: PatternId;
  name: string;
  kind?: PatternKind;
  root?: PitchClass;
  steps: Iterable<number>;
  aliases?: readonly string[];
  tags?: readonly string[];
  source?: PatternSource;
  comment?: string;
  degrees?: readonly DegreeAnnotation[];
  /** Letter spelling of the anchor (e.g. `{step:3, alteration:-1}` = Fb). */
  rootSpelling?: Spelling;
  parentId?: string;
  parentDegree?: number;
}

export function createPattern(input: CreatePatternInput): Pattern {
  const root = pc(input.root ?? 0);
  const steps = normalizeSteps(input.steps);
  // Align degree annotations with the *normalized* step order. Pair-form
  // annotations ([semitones, label]) are keyed by semitone so they survive
  // sorting/deduping; bare-label lists are assumed to already match.
  let alignedDegrees: readonly DegreeAnnotation[] | undefined;
  if (input.degrees && input.degrees.length > 0) {
    const pairForm = input.degrees.some((d) => Array.isArray(d));
    if (!pairForm && input.degrees.length === steps.length) {
      alignedDegrees = input.degrees;
    } else if (pairForm) {
      const byStep = new Map<number, DegreeAnnotation>();
      for (const d of input.degrees) {
        if (Array.isArray(d)) byPcSet(byStep, d[0], d);
      }
      alignedDegrees = steps.map((st) => byStep.get(st) ?? byStep.get(pc(st)) ?? degreeLabelForStep(st));
    } else {
      alignedDegrees = steps.map((_, i) => input.degrees![i] ?? degreeLabelForStep(steps[i]!));
    }
  }
  return {
    id: input.id ?? slugify(input.name),
    name: input.name,
    aliases: input.aliases,
    kind: input.kind ?? 'set',
    root,
    steps,
    source: input.source ?? 'manual',
    tags: input.tags,
    comment: input.comment,
    parentId: input.parentId,
    parentDegree: input.parentDegree,
    // Store degree-derived spellings *relative to C* (step = degree-1). The
    // anchor point is supplied separately via `rootSpelling`; re-anchoring onto
    // the actual root happens in `spellPattern`. Storing them relative to the
    // root here would double-shift when anchored.
    spellings: alignedDegrees
      ? alignedDegrees.map((d) => labelToSpelling(degreeLabelText(d)))
      : undefined,
    rootSpelling:
      input.rootSpelling ??
      // Degree-0 labels are always `1` -> labelToSpelling gives C-natural, which
      // would clobber the actual anchor. Only trust a declared label that carries
      // an accidental; otherwise the caller's root spelling wins.
      (alignedDegrees?.[0] && degreeLabelText(alignedDegrees[0]) !== '1'
        ? labelToSpelling(degreeLabelText(alignedDegrees[0]))
        : undefined),
  };
}

function byPcSet(map: Map<number, DegreeAnnotation>, key: number, value: DegreeAnnotation): void {
  if (!map.has(pc(key))) map.set(pc(key), value);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Pitch classes of a pattern's members. */
export function patternPcs(p: Pattern): PitchClass[] {
  return p.steps.map((s) => pcAdd(p.root, s));
}

/** Sorted unique pitch classes (canonical set form). */
export function patternSet(p: Pattern): PitchClass[] {
  return [...new Set(patternPcs(p))].sort((a, b) => a - b);
}

/** Cardinality. */
export function size(p: Pattern): number {
  return p.steps.length;
}

/** Is `value` a member of the pattern? */
export function contains(p: Pattern, value: number): boolean {
  return p.steps.includes(pc(value - p.root));
}

/** Transpose the anchor; skeleton preserved. */
export function transpose(p: Pattern, semitones: number): Pattern {
  return { ...p, id: `${p.id}@${pc(semitones)}`, root: pcAdd(p.root, semitones) };
}

/** Rotate through every chromatic transposition (12 copies unless reduced). */
export function allTranspositions(p: Pattern, limit = 12): Pattern[] {
  const out: Pattern[] = [];
  const seen = new Set<string>();
  for (let n = 0; n < limit; n++) {
    const q = transpose(p, n);
    const key = patternSet(q).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

/** Inversion about the root axis (mirror the skeleton). */
export function invert(p: Pattern, axis: PitchClass = p.root): Pattern {
  const steps = p.steps.map((s) => pc(2 * pcSub(axis, p.root) - s)).sort((a, b) => a - b);
  return createPattern({
    id: `${p.id}-inv`,
    name: `${p.name} (inverted)`,
    kind: p.kind,
    root: pcAdd(axis, -axis + p.root),
    steps,
    source: 'derived',
    tags: p.tags,
  });
}

/** Retrograde (reverse the ordering; members unchanged). */
export function retrograde(p: Pattern): Pattern {
  return { ...p, id: `${p.id}-retro`, steps: [...p.steps].reverse(), source: 'derived' };
}

/** M5: transpose then invert (the classic jazz "minor 5th inversion" move). */
export function m5(p: Pattern): Pattern {
  const inv = invert(p);
  return transpose(inv, 7);
}

/**
 * Modal rotation: cyclically permute the step skeleton so that the degree at
 * index `offset` becomes the new anchor. This is the definition of a mode as an
 * orbit under rotation — no re-analysis needed.
 */
export function rotate(p: Pattern, offset: number): Pattern {
  const n = p.steps.length;
  if (n === 0) return p;
  const k = ((offset % n) + n) % n;
  const shifted = p.steps.slice(k).map((s) => pcSub(s, p.steps[k]!));
  const wrapped = p.steps.slice(0, k).map((s) => pcAdd(s, 12 - p.steps[k]!));
  const steps = [...shifted, ...wrapped];
  const newName = `${p.name} ${ordinalName(k + 1)}`;
  return createPattern({
    id: `${p.id}@rot${k}`,
    name: newName,
    kind: 'mode',
    root: pcAdd(p.root, p.steps[k] ?? 0),
    steps,
    source: 'rotation',
    tags: [...(p.tags ?? []), 'modal-rotation'],
    comment: `Mode ${k + 1} of ${p.name}`,
  });
}

/** Every rotation of a pattern (its modal orbit), de-duplicated by set form. */
export function modalOrbit(p: Pattern): Pattern[] {
  const seen = new Set<string>();
  const out: Pattern[] = [];
  for (let k = 0; k < p.steps.length; k++) {
    const q = rotate(p, k);
    const key = patternSet(q).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function ordinalName(n: number): string {
  const names = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return names[n] ?? String(n);
}

/** Interval skeleton as step-to-step differences (the "shape" signature). */
export function intervalsBetween(p: Pattern): number[] {
  const out: number[] = [];
  for (let i = 1; i < p.steps.length; i++) out.push(pcSub(p.steps[i]!, p.steps[i - 1]!));
  if (p.steps.length > 1) out.push(pcSub(12, p.steps[p.steps.length - 1]!));
  return out;
}

/** Signature used for structural equality (rotation-invariant). */
export function shapeSignature(p: Pattern): string {
  return intervalsBetween(p).join('.');
}

/** Structural equality ignoring root and rotation. */
export function sameShape(a: Pattern, b: Pattern): boolean {
  return shapeSignature(a) === shapeSignature(b);
}

/** Exact set equality (same members, ignoring order/root). */
export function sameMembers(a: Pattern, b: Pattern): boolean {
  return patternSet(a).join(',') === patternSet(b).join(',');
}

/** Subset test: is every member of `sub` inside `super`? */
export function isSubsetOf(sub: Pattern, superSet: Pattern): boolean {
  const set = new Set(patternPcs(superSet));
  return patternPcs(sub).every((x) => set.has(x));
}

/** Set operations lifted onto patterns. */
export function union(a: Pattern, b: Pattern): Pattern {
  return createPattern({
    id: `${a.id}+${b.id}`,
    name: `${a.name} ∪ ${b.name}`,
    kind: 'set',
    root: a.root,
    steps: [...new Set([...a.steps, ...b.steps.map((s) => pcAdd(s, pcSub(b.root, a.root)))])],
    source: 'combination',
  });
}

export function intersection(a: Pattern, b: Pattern): Pattern {
  const bPcs = new Set(patternPcs(b));
  const kept = patternPcs(a).filter((x) => bPcs.has(x));
  return createPattern({
    id: `${a.id}∩${b.id}`,
    name: `${a.name} ∩ ${b.name}`,
    kind: 'set',
    root: a.root,
    steps: kept.map((x) => pcSub(x, a.root)),
    source: 'combination',
  });
}

export function difference(a: Pattern, b: Pattern): Pattern {
  const bPcs = new Set(patternPcs(b));
  const kept = patternPcs(a).filter((x) => !bPcs.has(x));
  return createPattern({
    id: `${a.id}-${b.id}`,
    name: `${a.name} \\ ${b.name}`,
    kind: 'set',
    root: a.root,
    steps: kept.map((x) => pcSub(x, a.root)),
    source: 'combination',
  });
}

/** Complement within the chromatic total. */
export function complement(p: Pattern): Pattern {
  const have = new Set(patternPcs(p));
  const steps: number[] = [];
  for (let k = 0; k < 12; k++) if (!have.has(pcAdd(p.root, k))) steps.push(k);
  return createPattern({
    id: `${p.id}-comp`,
    name: `Chromatic complement of ${p.name}`,
    kind: 'set',
    root: p.root,
    steps,
    source: 'derived',
  });
}

/**
 * Spell the members of a pattern using a key context. Falls back to sharp-ish
 * spellings when no key is supplied. Presenters call this for letter notation.
 */
export function spellPattern(p: Pattern, keyContext?: readonly PitchClass[]): Spelling[] {
  const rootSp = p.rootSpelling ?? p.spellings?.[0];
  if (p.spellings && rootSp && p.spellings.length === p.steps.length) {
    // Re-anchor template spellings onto the actual root's letter culture so
    // `Eb dorian` spells C natural while `F# dorian` spells E# etc.
    return p.steps.map((st, i) => {
      const declared = p.spellings![i];
      if (!declared) return spellInKey(pcAdd(p.root, st), keyContext ?? patternPcs(p));
      return anchorSpelling(rootSp, declared, st, pcAdd(p.root, st));
    });
  }
  const ctx = keyContext ?? patternPcs(p);
  return p.steps.map((s) => spellInKey(pcAdd(p.root, s), ctx));
}

/** Letter table for diatonic steps C D E F G A B. */
const LETTER_PCS = [0, 2, 4, 5, 7, 9, 11];

/**
 * Place a declared member spelling relative to the root's chosen letter:
 * the member keeps its *degree distance* from the root and absorbs the root's
 * accidental culture (D harmonic minor -> C#, Eb mixolydian -> Db).
 */
function anchorSpelling(
  rootSp: Spelling,
  declared: Spelling,
  stepAboveRoot: number,
  memberPc?: PitchClass,
): Spelling {
  // Degree labels are C-relative (letter index with C=0), so the *letter
  // distance above the root* is simply `declared.step`. The member's letter is
  // then root letter + that distance, and its alteration is forced by the
  // actual pitch class — exactly like reading a note off a staff.
  const relStep = ((declared.step % 7) + 7) % 7;
  const step = (((rootSp.step + relStep) % 7) + 7) % 7;
  const naturalPc = LETTER_PCS[step]!;
  const target = memberPc !== undefined ? pc(memberPc) : pc(stepAboveRoot);
  let alteration = target - naturalPc;
  if (alteration > 6) alteration -= 12;
  if (alteration < -6) alteration += 12;
  // Enharmonic tie-break (|alteration| == 6, e.g. C#/Db on degree B/C): prefer
  // the accidental culture of the root when it yields a single accidental.
  if (Math.abs(alteration) === 6 && Math.abs(rootSp.alteration) <= 1) {
    const preferred = rootSp.alteration < 0 ? -6 : 6;
    if (spellingToPc({ step, alteration: preferred }) === target) alteration = preferred;
  }
  return { step, alteration };
}

/** Textual step signature, e.g. `W-H-W-W-H-W-W` for major (H/W helpers). */
export function stepSignature(p: Pattern): string {
  return intervalsBetween(p)
    .map((s) => intervalBySemitones(s).short)
    .join(' ');
}

/**
 * Derive a degree label (`1`, `b3`, `#4`) from a semitone step by finding the
 * diatonic degree whose natural pitch is closest below/equal to it. This is how
 * hand-drawn patterns get sensible interval notation without a template.
 */
export function degreeLabelForStep(step: number): string {
  const table = [0, 2, 4, 5, 7, 9, 11];
  let bestDegree = 1;
  let bestDelta = -Infinity;
  for (let d = 0; d < 7; d++) {
    const nat = table[d]!;
    if (nat <= step && nat > bestDelta) {
      bestDelta = nat;
      bestDegree = d + 1;
    }
  }
  const delta = step - bestDelta;
  const prefix = delta === 0 ? '' : delta < 0 ? 'b'.repeat(-delta) : '#'.repeat(delta);
  return `${prefix}${bestDegree}`;
}

/**
 * A degree annotation is either a bare label (`'b3'`) or a `[semitonesAboveRoot,
 * label]` pair (the pairing keeps labels attached to their own octave placement
 * when steps are normalized/sorted). Library templates use the pair form;
 * derived patterns and manual entry usually use the bare-label form.
 */
export type DegreeAnnotation = string | readonly [number, string];

/** Extract the textual label from either annotation form. */
export function degreeLabelText(d: DegreeAnnotation): string {
  return typeof d === 'string' ? d : d[1];
}

/** Compact label list for tooltips: `1 b3 5 b7`. */
export function degreeLabels(
  p: Pattern,
  degrees?: readonly DegreeAnnotation[],
): string[] {
  if (degrees && degrees.length === p.steps.length) {
    return degrees.map((d) => (typeof d === 'string' ? d : d[1]));
  }
  return p.steps.map(degreeLabelForStep);
}

export function naturalDegreeSemitone(degree: number): number {
  const table = [0, 2, 4, 5, 7, 9, 11];
  return table[((degree - 1) % 7 + 7) % 7] ?? 0;
}

/** True when the pattern is invariant under some non-zero transposition. */
export function isSymmetric(p: Pattern): boolean {
  const set = patternSet(p);
  for (let n = 1; n < 12; n++) {
    const shifted = set.map((x) => pcAdd(x, n));
    if (shifted.join(',') === set.join(',')) return true;
  }
  return false;
}

/** Normal-order representative, handy for Forte-style identity checks. */
export function primeRepresentative(p: Pattern): number[] {
  return normalOrder(patternPcs(p));
}

const LABEL_STEP: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6,
};

/**
 * Turn a degree label (`b3`, `#4`, `13`) into a spelling relative to a C root:
 * the letter comes from the diatonic step, the accidental from the prefix. This
 * is what lets interval notation and tonal colour share one source of truth.
 */
export function labelToSpelling(label: string): Spelling | undefined {
  const m = /^(b|#)?(\d+)$/.exec(label.trim());
  if (!m) return undefined;
  const num = Number(m[2]);
  const base = ((num - 1) % 7) + 1;
  const step = LABEL_STEP[String(base)];
  if (step === undefined) return undefined;
  const alteration = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
  return { step, alteration };
}

/** Human-readable summary line for search results and headers. */
export function describePattern(p: Pattern): string {
  const notes = spellPattern(p)
    .map(formatSpelling)
    .join(' ');
  return `${p.name}: ${notes} [${stepSignature(p)}]`;
}
