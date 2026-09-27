/**
 * Keys, key signatures, and the circle of fifths.
 *
 * The circle is not decoration: it is the generator of diatonic collections and
 * the natural coordinate for "how far apart are these two keys" (shared-tone
 * count, pivot availability, modal interchange distance). We derive everything —
 * signature, relative minor, mode list, neighbourhood — from that one structure.
 */

import { pc, pcAdd, pcSub, type PitchClass } from '../pitch-class.js';
import { LETTER_SEMITONE, STEP_LETTER, spellingToPc, type Spelling } from '../spelling.js';
import { SCALE_TEMPLATES } from './scales.js';
import { rootLabel, parseRootShorthand, type Template } from './template.js';

export interface KeySignature {
  /** Tonic pitch class. */
  readonly tonic: PitchClass;
  /** Tonic spelling (so `F# major` renders as F♯, never G♭). */
  readonly tonicSpelling: Spelling;
  /** 'major' | 'minor' | template id for non-diatonic key centres. */
  readonly mode: string;
  /** Signed count of sharps (positive) or flats (negative). */
  readonly accidentals: number;
  /** Ordered letters carrying the accidental, e.g. ['F','C','G'] for 3 sharps. */
  readonly sharpOrder: readonly string[];
  readonly flatOrder: readonly string[];
  /** Scale template this key is built on. */
  readonly template: Template;
}

/** Order in which sharps/flats appear in signatures. */
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const;
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const;

const MAJOR = SCALE_TEMPLATES.find((t) => t.id === 'ionian')!;
const MINOR = SCALE_TEMPLATES.find((t) => t.id === 'aeolian')!;

/** Number of sharps (or minus flats) in the signature of a major key. */
export function majorSignatureCount(tonic: PitchClass): number {
  // Position of tonic along the chain of fifths from C.
  const fifths = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; // C G D A E B F# C# G# D# A# F
  const idx = fifths.indexOf(pc(tonic));
  if (idx < 0) return 0;
  return idx > 6 ? idx - 12 : idx;
}

/** Build a key signature record. */
export function keySignature(
  tonic: PitchClass | string,
  mode: 'major' | 'minor' = 'major',
): KeySignature {
  const t = typeof tonic === 'string' ? parseRootShorthand(tonic) : pc(tonic);
  // A minor key borrows the signature of its relative major (tonic + 3 semitones).
  const count = mode === 'major' ? majorSignatureCount(t) : majorSignatureCount(pcAdd(t, 3));
  const preferFlats = count < 0;
  const tonicSpelling = spellTonic(t, preferFlats);
  return {
    tonic: t,
    tonicSpelling,
    mode,
    accidentals: count,
    sharpOrder: SHARP_ORDER.slice(0, Math.max(0, count)),
    flatOrder: FLAT_ORDER.slice(0, Math.max(0, -count)),
    template: mode === 'major' ? MAJOR : MINOR,
  };
}

/**
 * Pick a spelling for a tonic pitch class. Natural letters are used when the pc
 * has one; otherwise we choose the sharp or flat neighbour according to the
 * signature preference (flat keys spell with flats, sharp keys with sharps).
 */
function spellTonic(tonic: PitchClass, preferFlats: boolean): Spelling {
  const naturals = new Map<PitchClass, Spelling>();
  for (let step = 0; step < 7; step++) {
    const s = { step, alteration: 0 };
    if (!naturals.has(spellingToPc(s))) naturals.set(spellingToPc(s), s);
  }
  const direct = naturals.get(tonic);
  if (direct) return direct;
  return preferFlats
    ? { step: letterStepFor(pcAdd(tonic, 1)), alteration: -1 }
    : { step: letterStepFor(pcAdd(tonic, 11)), alteration: 1 };
}

/** Diatonic step whose *natural* pitch class equals `target` (e.g. 6 → B). */
function letterStepFor(target: PitchClass): number {
  for (let step = 0; step < 7; step++) {
    if (pc(LETTER_SEMITONE[STEP_LETTER[step] ?? 'C']) === target) return step;
  }
  return 0;
}

/** The full circle of fifths, ordered by signature count, sharps then flats. */
export interface CircleEntry {
  readonly position: number; // fifths distance from C, negative = flat side
  readonly major: KeySignature;
  readonly relativeMinor: KeySignature;
}

export function circleOfFifths(): CircleEntry[] {
  const out: CircleEntry[] = [];
  for (let pos = -6; pos <= 6; pos++) {
    const tonic = pc(pos * 7);
    out.push({
      position: pos,
      major: keySignature(tonic, 'major'),
      relativeMinor: keySignature(pcAdd(tonic, 9), 'minor'),
    });
  }
  return out;
}

/** Diatonic fifths distance between two tonics (steps around the circle). */
export function fifthsDistance(a: PitchClass, b: PitchClass): number {
  // Map a semitone difference to its position along the chain of fifths.
  const table = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
  const raw = table[pc(pcSub(b, a))] ?? 0;
  return raw > 6 ? raw - 12 : raw;
}

/** Keys sharing the most tones with `tonic` (nearest neighbours on the circle). */
export function nearestKeys(tonic: PitchClass, radius = 3): KeySignature[] {
  const out: KeySignature[] = [];
  for (let r = 1; r <= radius; r++) {
    out.push(keySignature(pcAdd(tonic, 7 * r), 'major'));
    out.push(keySignature(pcAdd(tonic, -7 * r), 'major'));
  }
  return out;
}

/** Count of shared pitch classes between two keys' diatonic collections. */
export function sharedToneCount(a: PitchClass, b: PitchClass): number {
  const setA = new Set(diatonicPcs(a));
  return diatonicPcs(b).filter((x) => setA.has(x)).length;
}

/** Pitch classes of the major collection rooted at `tonic`. */
export function diatonicPcs(tonic: PitchClass): PitchClass[] {
  return MAJOR.steps.map((s) => pcAdd(tonic, s));
}

/** Parallel/minor partner of a key. */
export function parallelMinor(tonic: PitchClass): KeySignature {
  return keySignature(pcAdd(tonic, 9), 'minor');
}

/** Human label, e.g. `E♭ major`, `C minor`. */
export function keyLabel(k: KeySignature): string {
  return `${rootLabel(k.tonic, k.accidentals < 0)} ${k.mode}`;
}

/**
 * Mode names for each degree of a parent scale, using the conventional church
 * names when the parent is the major scale and generic ordinals otherwise.
 */
export const CHURCH_MODES = [
  'Ionian',
  'Dorian',
  'Phrygian',
  'Lydian',
  'Mixolydian',
  'Aeolian',
  'Locrian',
] as const;

export const MELODIC_MINOR_MODES = [
  'Melodic Minor',
  'Dorian b2',
  'Lydian Augmented',
  'Lydian Dominant',
  'Mixolydian b6',
  'Locrian Natural 9',
  'Altered (Super Locrian)',
] as const;

export function modeNamesFor(templateId: string): readonly string[] {
  if (templateId === 'ionian') return CHURCH_MODES;
  if (templateId === 'melodic-minor') return MELODIC_MINOR_MODES;
  const t = SCALE_TEMPLATES.find((x) => x.id === templateId);
  const n = t?.steps.length ?? 7;
  return Array.from({ length: n }, (_, i) => `Mode ${i + 1}`);
}
