/**
 * Diatonic harmony: the chords that live inside a scale, and the scales that
 * contain a chord.
 *
 * This is the workhorse behind "chords within scales", "scales containing this
 * chord", Roman-numeral analysis, and functional (tonal) colouring. Everything is
 * computed rather than tabulated, so it works for *any* heptatonic or
 * non-heptatonic collection the user invents — not just the major scale.
 */

import { pc, pcAdd, pcSub, type PitchClass } from '../pitch-class.js';
import {
  createPattern,
  degreeLabelForStep,
  naturalDegreeSemitone,
  patternPcs,
  type Pattern,
} from '../pattern.js';
import { CHORD_TEMPLATES } from './chords.js';
import { SCALE_TEMPLATES } from './scales.js';
import { rootLabel, type Template } from './template.js';


/** A chord built on one degree of a parent collection. */
export interface DiatonicChord {
  /** 1-based index into the parent's ordered members. */
  readonly degree: number;
  /** Roman numeral, case/sign reflecting quality (`bVII`, `iv`, `#ii°`). */
  readonly numeral: string;
  /** Root pitch class. */
  readonly root: PitchClass;
  /** Chord symbol as rendered text (`F#m7`, `G7`, ...). */
  readonly symbol: string;
  /** The concrete chord pattern. */
  readonly pattern: Pattern;
  /** Template the stack matched (undefined when the stack is non-standard). */
  readonly templateId?: string;
  /** Parent-collection degrees used to build the stack. */
  readonly memberDegrees: readonly number[];
}

/** Stack every `size` notes at `skip` intervals starting from each degree. */
export function stackedMembers(
  parent: Pattern,
  size = 3,
  skip = 2,
): { degree: number; roots: number[] }[] {
  const n = parent.steps.length;
  if (n === 0) return [];
  const out: { degree: number; roots: number[] }[] = [];
  for (let d = 0; d < n; d++) {
    const picks: number[] = [];
    for (let k = 0; k < size; k++) {
      const idx = (d + k * skip) % n;
      const octaves = Math.floor((d + k * skip) / n);
      picks.push(pcAdd(parent.root, parent.steps[idx]! + 12 * octaves));
    }
    out.push({ degree: d + 1, roots: picks });
  }
  return out;
}

/** Build diatonic seventh chords (stack of thirds) for any parent collection. */
export function diatonicSevenths(parent: Pattern, size = 4, skip = 2): DiatonicChord[] {
  return buildStacked(parent, size, skip);
}

export function diatonicTriads(parent: Pattern): DiatonicChord[] {
  return buildStacked(parent, 3, 2);
}

function buildStacked(parent: Pattern, size: number, skip: number): DiatonicChord[] {
  const degreesOrdered = parent.steps.length;
  const results: DiatonicChord[] = [];
  for (const { degree, roots } of stackedMembers(parent, size, skip)) {
    const rootPc = pc(roots[0]!);
    const steps = roots.map((r) => pcSub(r, rootPc)).sort((a, b) => a - b);
    const match = bestTemplateMatch(steps);
    const memberDegrees = roots.map((_, i) => ((degree - 1 + i * skip) % degreesOrdered) + 1);
    // Degree labels come from the parent collection when it is heptatonic, so a
    // stack on the 6th degree of a major scale reads `6 1 3` style; otherwise we
    // fall back to interval-from-root labelling.
    const labels = steps.map((st) => {
      const parentIdx = steps.indexOf(st);
      const fromParent =
        degreesOrdered === 7
          ? degreeLabelForStep(parent.steps[(degree - 1 + parentIdx * skip) % 7]!)
          : undefined;
      return fromParent ?? degreeLabelForStep(st);
    });
    const pattern = createPattern({
      id: `diatonic-${parent.id}-${degree}-stack${size}`,
      name: `${rootLabel(rootPc)} ${match?.name ?? `${size}-note stack`}`,
      kind: 'chord',
      root: rootPc,
      steps,
      degrees: labels,
      source: 'derived',
      tags: ['diatonic'],
      parentId: parent.id,
      parentDegree: degree,
    });
    results.push({
      degree,
      numeral: romanNumeral(degree, pattern, parent),
      root: rootPc,
      symbol: chordSymbol(pattern, match?.id),
      pattern,
      templateId: match?.id,
      memberDegrees,
    });
  }
  return results;
}

/** Closest chord template by exact step-set equality. */
function bestTemplateMatch(steps: readonly number[]): { id: string; name: string } | undefined {
  const key = [...new Set(steps.map(pc))].sort((a, b) => a - b).join(',');
  for (const t of CHORD_TEMPLATES) {
    if (t.steps.join(',') === key) return { id: t.id, name: t.name };
  }
  return undefined;
}

/**
 * Roman numeral with quality-aware case and accidental prefix. The accidental is
 * measured against the *major* scale degree at that position, which is what makes
 * numerals readable in borrowed/mixed collections (harmonic minor, Messiaen...).
 */
export function romanNumeral(degree: number, chord: Pattern, parent: Pattern): string {
  const baseRoman = ROMAN[Math.min(degree, ROMAN.length) - 1] ?? String(degree);
  const parentStep = parent.steps[(degree - 1) % parent.steps.length] ?? 0;
  const expected = naturalDegreeSemitone(((degree - 1) % 7) + 1);
  const delta = pcSub(parentStep, expected % 12);
  const adjusted = delta > 6 ? delta - 12 : delta;
  const prefix = adjusted === 0 ? '' : adjusted < 0 ? 'b'.repeat(-adjusted) : '#'.repeat(adjusted);
  const third = findStep(chord, 3) ?? findStep(chord, 4);
  const fifth = findStep(chord, 5) ?? findStep(chord, 6);
  const minorThird = third === 3;
  let suffix = '';
  if (minorThird && fifth === 6) suffix = '°';
  else if (minorThird && fifth === 9) suffix = '°7';
  else if (minorThird && fifth === 8) suffix = '+';
  else if (!minorThird && fifth === 6) suffix = 'ø';
  const body = minorThird ? baseRoman.toLowerCase() : baseRoman;
  return `${prefix}${body}${suffix}`;
}

function findStep(chord: Pattern, degreeNumber: number): number | undefined {
  const target = naturalDegreeSemitone(degreeNumber);
  const exact = chord.steps.find((s) => s === target);
  if (exact !== undefined) return exact;
  // tolerate enharmonic placement (e.g. bb7 spelled as 9)
  const near = chord.steps.find((s) => Math.abs(s - target) <= 1);
  return near;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Compact chord symbol from a pattern plus optional template id. */
export function chordSymbol(pattern: Pattern, templateId?: string): string {
  const head = rootLabel(pattern.root);
  if (!templateId) return `${head} (${pattern.steps.length})`;
  const suffix = SYMBOL_SUFFIX[templateId] ?? templateId;
  return `${head}${suffix}`;
}

const SYMBOL_SUFFIX: Record<string, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  power: '5',
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  m7b5: 'm7b5',
  dim7: 'dim7',
  mmaj7: 'mMaj7',
  maj7s5: 'maj7#5',
  '7sus4': '7sus4',
  add9: 'add9',
  madd9: 'm(add9)',
  '69': '6/9',
  'six-add9': '6/9',
  m6: 'm6',
  maj9: 'maj9',
  dom9: '9',
  min9: 'm9',
  m9b5: 'm9b5',
  dim9: 'dim9',
  '7b9': '7b9',
  '7#9': '7#9',
  '7sus9': '7sus9',
  min11: 'm11',
  dom11: '11',
  maj11: 'maj11',
  m11b5: 'm11b5',
  maj13: 'maj13',
  dom13: '13',
  '13b9': '13b9',
  '7b9b5': '7b9b5',
  '7#9#5': '7#9#5',
  alt: '7alt',
  'lydian-dominant': '7#11',
  quartal3: 'sus(no3)',
  quartal4: 'quartal',
  'second-cluster': 'cluster',
};

/**
 * Every library scale whose pc set contains all members of `chord`. Powers the
 * "which scales can I play over this chord?" query. Results are ranked by how
 * many chord tones are *strong* positions (root/3rd/5th/7th) they support.
 */
export function scalesContainingChord(
  chord: Pattern,
  options: { templates?: readonly Template[]; maxResults?: number } = {},
): { template: Template; transpositions: PitchClass[] }[] {
  const templates = options.templates ?? SCALE_TEMPLATES;
  const chordSet = new Set(patternPcs(chord));
  const results: { template: Template; transpositions: PitchClass[] }[] = [];
  for (const t of templates) {
    const roots: PitchClass[] = [];
    for (let n = 0; n < 12; n++) {
      const pcs = t.steps.map((s) => pcAdd(n, s));
      if (pcs.every((x) => chordSet.has(x))) roots.push(pc(n));
    }
    if (roots.length > 0) results.push({ template: t, transpositions: roots });
  }
  results.sort((a, b) => a.template.steps.length - b.template.steps.length);
  return results.slice(0, options.maxResults ?? results.length);
}

/** All library chords that are subsets of a given scale (per degree). */
export function chordsWithinScale(scale: Pattern): DiatonicChord[] {
  const out: DiatonicChord[] = [];
  for (const size of [3, 4]) {
    out.push(...buildStacked(scale, size, 2));
  }
  return out;
}

/**
 * Modal-interchange pool: chords available from every same-root parallel mode.
 * Central to the "tonal relations" view — shows where a foreign chord came from.
 */
export function modalInterchange(
  tonic: PitchClass,
  parents: readonly Pattern[],
): { source: Pattern; chord: DiatonicChord }[] {
  const out: { source: Pattern; chord: DiatonicChord }[] = [];
  for (const p of parents) {
    const rooted = { ...p, root: pc(tonic) };
    for (const c of diatonicSevenths(rooted)) out.push({ source: rooted, chord: c });
  }
  return out;
}

/** Functional classification used by tonal notation colours. */
export type HarmonicFunction =
  | 'tonic'
  | 'subdominant'
  | 'dominant'
  | 'leading'
  | 'mediant'
  | 'submediant'
  | 'supertonic'
  | 'chromatic';

/** Coarse function label for a degree in a major/minor context. */
export function harmonicFunction(degree: number): HarmonicFunction {
  switch (((degree - 1) % 7) + 1) {
    case 1:
      return 'tonic';
    case 2:
      return 'supertonic';
    case 3:
      return 'mediant';
    case 4:
      return 'subdominant';
    case 5:
      return 'dominant';
    case 6:
      return 'submediant';
    case 7:
      return 'leading';
    default:
      return 'chromatic';
  }
}

/** Cadential strength heuristic: V→I, iv→V, ii→V etc. */
export function cadentialMotion(from: DiatonicChord, to: DiatonicChord): number {
  const diff = pcSub(to.root, from.root);
  if (diff === 7 || diff === 5) return 2; // descending fifth / ascending fourth
  if (diff === 2) return 1; // stepwise
  return 0;
}
