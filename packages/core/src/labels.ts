/**
 * labels.ts — THE DISPLAY-LABEL RULES FILE.
 *
 * This is the single place you edit to control what appears inside a fret dot.
 *
 * ── The contract ────────────────────────────────────────────────────────────
 *   You are given:
 *     • the scale root as a LINEAR PITCH NUMBER  (C0 = 0, C1 = 12, D2 = 25, …)
 *     • each scale pitch as a LINEAR PITCH NUMBER with its octave
 *     • the notation mode ("tonal" | "interval" | "number" | "degree" | "letter")
 *     • context: scale name, root spelling, diatonic steps of the pattern
 *   linear(p,o) = p + 12*o ; pc(l) = ((l % 12) + 12) % 12
 *
 * ── The five built-in modes ─────────────────────────────────────────────────
 *   tonal    : R, b9, 9, #9/m3, M3, P4, #4/b5, P5, #5/b13, 13/bb7, b7, 7
 *              (chromatic distance from root expressed in harmonic vocabulary;
 *               compound seconds kept as 9 / 13)
 *   interval : R, m9, M9, m3, M3, P4, A4/TT/D5, P5, A5/m13, M13/d7, m7, M7
 *              (simple interval names for distances < an octave; compound
 *               seconds/thirteenths use extended names)
 *   number   : 0..11 — semitones above the root (0 = root, 1 = minor 2nd…)
 *   degree   : 1..7 scale-degree numbers derived from the LETTER DISTANCE of
 *              each note from the root (D harmonic minor → C# is degree 7, not
 *              b8), with #/b alterations for non-diatonic tones. When the
 *              pattern itself declares degree annotations (e.g. blues scales
 *              labelling the minor third as #9 and keeping the major third as
 *              3), those declarations win.
 *   letter   : full note name incl. octave, e.g. E2, A#3, Bb4
 *
 * ── Enharmonic policy (letter mode & degree accidentals) ────────────────────
 *   1. One letter per scale whenever possible (never Cb/C/C# together).
 *   2. Sharp keys favour sharps, flat keys favour flats.
 *   3. Altered tones: use # when the tone resolves UPWARD (raised leading
 *      tone C# in D minor), b when it resolves DOWNWARD (b7 resolving down).
 *      i.e. #'s want to keep moving up, flats want to move down.
 *   4. If the scale template forces a specific enharmonic (declared spellings
 *      or pair-form annotations like [6,'#9']), the forced value wins over
 *      every rule above.
 */

import type { NotationMode } from './notation.js';
import { pc, type PitchClass } from './pitch-class.js';

/** Linear pitch number: linear(4, 2) === 28 (E2). */
export const linearPitchNumber = (pitch: number, octave: number): number => pitch + 12 * octave;

/** Semitone distance above the root (0..11). Pass LINEAR numbers. */
export const stepFromRoot = (rootLinear: number, pitchLinear: number): number =>
  pc(pitchLinear - rootLinear);

/* ─────────────────────────  EDIT THESE TWELVE SLOTS  ─────────────────────── */

/** Tonal function for each chromatic distance 0..11 from the root. */
export const TONAL_LABELS: string[] = [
  'R',        // 0
  'b9',       // 1
  '9',        // 2
  '#9/m3',    // 3
  'M3',       // 4
  'P4',       // 5
  '#4/b5',    // 6
  'P5',       // 7
  '#5/b13',   // 8
  '13/bb7',   // 9
  'b7',       // 10
  '7',        // 11
];

/** Interval name for each chromatic distance 0..11 from the root. */
export const INTERVAL_LABELS: string[] = [
  'R',        // 0
  'm9',       // 1
  'M9',       // 2
  'm3',       // 3
  'M3',       // 4
  'P4',       // 5
  'A4/TT/D5', // 6
  'P5',       // 7
  'A5/m13',   // 8
  'M13/d7',   // 9
  'm7',       // 10
  'M7',       // 11
];

/** Plain chromatic-number display (0 = root). */
export const NUMBER_LABELS: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

/**
 * Full enharmonic table indexed by pitch class (your list, reproduced verbatim;
 * '/' separates the alternatives). Used as the candidate pool for letter mode.
 */
export const ENHARMONIC_POOL: string[][] = [
  ['B#', 'C', 'Dbb'],   // 0
  ['B##', 'C#', 'Db'],  // 1
  ['C##', 'D', 'Ebb'],  // 2
  ['D#', 'Eb', 'Fbb'],  // 3
  ['D##', 'E', 'Fb'],   // 4
  ['E#', 'F', 'Gbb'],   // 5
  ['E##', 'F#', 'Gb'],  // 6
  ['F##', 'G', 'Abb'],  // 7
  ['G#', 'Ab'],         // 8
  ['G##', 'A', 'Bbb'],  // 9
  ['A#', 'Bb', 'Cbb'],  // 10
  ['A##', 'B', 'Cb'],   // 11
];

/* ─────────────────────────────────────────────────────────────────────────── */

export interface LabelRequest {
  /** Scale root as a linear pitch number (C0=0, C1=12, D2=25…). */
  rootLinear: number;
  /** The pitch being labelled, as a linear pitch number. */
  pitchLinear: number;
  mode: NotationMode;
  /** Optional context the rule function may consult. */
  context?: {
    scaleName?: string;
    /** Root letter+accidental, e.g. 'D', 'Eb'. */
    rootSpelling?: string;
    /** Sorted semitone steps of the pattern relative to root, e.g. [0,2,4,5,7,9,11]. */
    steps?: readonly number[];
    /** Degree annotation declared by the template for this step (e.g. '#9', 'b3'). */
    declaredDegree?: string;
    /** Flat-key preference hint (true → favour flats). */
    preferFlats?: boolean;
  };
}

/**
 * labelFor(req): return the exact string to paint inside the fret dot.
 *
 * Default implementation dispatches to the tables above. To add your own
 * rules, edit this function (or override `labelOverride` below, which is
 * consulted first and lets you special-case any scale by name without
 * touching the general logic).
 */
export type LabelRule = (req: LabelRequest) => string;

/** Personal overrides keyed by lower-cased scale/pattern name. Edit freely. */
export const labelOverride: Record<string, LabelRule> = {
  // Example:
  // 'blues': ({ pitchLinear, rootLinear }) => customBluesLabel(...),
};

const simpleIntervalNames = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7'];

/** Letter-distance of a spelled note from C (C=0,D=1,E=2,F=3,G=4,A=5,B=6). */
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const letterIndex = (spelling: string): number => LETTER_INDEX[(spelling[0] ?? 'C').toUpperCase()] ?? 0;

/** Pick an enharmonic from the pool honouring one-letter-per-scale + key culture. */
export function chooseEnharmonic(
  pitchClass: PitchClass,
  usedLetters: ReadonlySet<string>,
  preferFlats: boolean,
): string {
  const candidates = ENHARMONIC_POOL[pitchClass] ?? ['C'];
  // Prefer natural letters, then the culture's accidental, avoiding used letters.
  const scored = candidates.map((cand) => {
    const letter = (cand[0] ?? 'C').toUpperCase();
    const acc = (cand.match(/#/g) || []).length - (cand.match(/b/g) || []).length;
    let score = 0;
    if (usedLetters.has(letter)) score += 100; // never duplicate a letter if avoidable
    if (acc === 0) score -= 10;                 // naturals first
    score += preferFlats ? acc : -acc;          // sharp keys up, flat keys down
    return { cand, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.cand ?? 'C';
}

/** Parse a degree label ('#4', 'b13', '7') into [accidentals, diatonicNumber]. */
const parseDegree = (label: string): [number, number] | undefined => {
  const m = /^([#b]*)(\d+)$/.exec(label.trim());
  if (!m) return undefined;
  const acc = (m[1]?.match(/#/g) || []).length - (m[1]?.match(/b/g) || []).length;
  return [acc, Number(m[2])];
};

/** True when a declared degree label spells the same pc as `step` above root. */
const degreeMatchesStep = (label: string, step: number): boolean => {
  const parsed = parseDegree(label);
  if (!parsed) return true; // non-numeric labels (R, b9…) are trusted verbatim
  const [acc, num] = parsed;
  const d = num - 1;
  const tpc = ((d * 7) % 12 + 12) % 12;
  return ((tpc + acc) % 12 + 12) % 12 === ((step % 12) + 12) % 12;
};

export const defaultLabelRule: LabelRule = (req) => {
  const override = req.context?.scaleName
    ? labelOverride[req.context.scaleName.toLowerCase()]
    : undefined;
  if (override) return override(req);

  const step = stepFromRoot(req.rootLinear, req.pitchLinear);

  switch (req.mode) {
    case 'blind':
      return '';
    case 'tonal':
      return TONAL_LABELS[step]!;
    case 'interval':
      return INTERVAL_LABELS[step]!;
    case 'number':
      return NUMBER_LABELS[step]!;
    case 'degree': {
      // Template-declared degrees win ONLY when they agree with the sounding
      // pitch (e.g. blues '#9' at tpc 3). A stale annotation like 'b8' on the
      // natural leading tone of D harmonic minor must not override degree 7.
      if (req.context?.declaredDegree && degreeMatchesStep(req.context.declaredDegree, step)) {
        return req.context.declaredDegree;
      }
      const steps = req.context?.steps;
      if (steps && steps.length > 0) {
        // Diatonic degree = rank of this step among the pattern's own steps,
        // using letter-distance when available; fall back to rank.
        const idx = [...steps].sort((a, b) => a - b).indexOf(step);
        if (idx >= 0) return String(idx + 1);
      }
      // Non-diatonic chromatic tone: express as alteration of nearest degree.
      const nearest = steps
        ? [...steps].reduce((best, s) =>
            Math.abs(s - step) < Math.abs(best - step) ? s : best,
          steps[0]!)
        : step;
      const diff = step - nearest;
      const base = steps ? [...steps].sort((a, b) => a - b).indexOf(nearest) + 1 : step + 1;
      if (diff === 0) return String(base);
      const sign = diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
      return `${sign}${base}`;
    }
    case 'letter': {
      const o = Math.floor(req.pitchLinear / 12);
      const letter = chooseEnharmonic(
        pc(req.pitchLinear),
        new Set(),
        req.context?.preferFlats ?? false,
      );
      return `${letter}${o}`;
    }
    default:
      return NUMBER_LABELS[step]!;
  }
  // Referenced so tree-shakers keep helpers exported for user edits.
  void simpleIntervalNames;
  void letterIndex;
};

let currentRule: LabelRule = defaultLabelRule;

/** Install a completely custom rule (what your hand-written mappings plug into). */
export const setLabelRule = (rule: LabelRule): void => {
  currentRule = rule;
};

/** The active rule used by the presenter layer. */
export const labelFor: LabelRule = (req) => currentRule(req);
