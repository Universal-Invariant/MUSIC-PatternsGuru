/**
 * Notation: how a highlighted pitch is *labelled* and *coloured*.
 *
 * Four notational modes, all pure functions of (pattern, position, context):
 *   1. `blind`     — location only, zero information. Trains recall.
 *   2. `interval`  — degree from the root (`1 b3 5 b7`). Relational thinking.
 *   3. `letter`    — spelled note name (`C Eb G Bb`). Absolute identification.
 *   4. `tonal`     — interval labels *plus* function-driven colour. The label is
 *                    the same as `interval`; the colour adds a second channel so
 *                    the eye groups by harmonic role without reading text.
 *
 * Colour is assigned by *degree class*, never by pitch class, so the same colour
 * always means the same function across every key and every instrument. That
 * invariance is the whole point of tonal notation.
 */

import type { Pattern } from './pattern.js';
import { degreeLabelForStep, patternPcs } from './pattern.js';
import { pc, pcAdd, pcSub, type PitchClass } from './pitch-class.js';
import {
  formatSpelling,
  rootAnchoredSpelling,
  spellInKey,
  spellingToPc,
  type Spelling,
} from './spelling.js';
import { chooseEnharmonic, labelFor } from './labels.js';

/**
 * The classic four modes plus two new ones:
 *   number — chromatic distance from the root, 0..11 (0 = root)
 *   degree — scale-degree numbers 1..7 with #/b alterations
 * All labelling is routed through `labelFor` in ./labels.js — EDIT THAT FILE
 * to change what appears inside a fret dot.
 */
export type NotationMode =
  | 'blind'
  | 'interval'
  | 'letter'
  | 'tonal'
  | 'number'
  | 'degree';

export const NOTATION_MODES: readonly NotationMode[] = [
  'blind',
  'interval',
  'letter',
  'tonal',
  'number',
  'degree',
];

/** Everything a presenter needs to draw one marker. */
export interface MarkerContent {
  /** Primary glyph/text (empty string for blind mode). */
  readonly text: string;
  /** Optional secondary line (e.g. note name under an interval label). */
  readonly sub?: string;
  /** Fill colour resolved from the active palette. */
  readonly fill: string;
  /** Stroke/outline colour. */
  readonly stroke: string;
  /** Whether this marker is the pattern's root/anchor. */
  readonly isRoot: boolean;
  /** Degree label when meaningful, else undefined. */
  readonly degree?: string;
  /** Letter spelling when meaningful, else undefined. */
  readonly spelling?: Spelling;
  /**
   * Optional halo/outline colour for the label text. Renderers draw a thick
   * stroke of this colour around glyphs (paint-order: stroke) so labels stay
   * legible on any background — replaces the old opaque plate underlay.
   */
  readonly halo?: string;
}

/** A palette maps a semantic role onto colours. Swap palettes freely. */
export interface Palette {
  readonly id: string;
  readonly name: string;
  /** Root / tonic colour. */
  readonly root: string;
  /** Colours indexed by degree class (1..7 plus alterations). */
  readonly degrees: Record<string, string>;
  /** Non-member ("outside") colour. */
  readonly outside: string;
  /** Background/canvas tint. */
  readonly canvas: string;
  /** Text colour that reads well on `fill`. */
  readonly ink: string;
}

/**
 * Default tonal palette. Degrees are keyed by their *canonical* label so `b3`
 * and `#4` each get stable, distinct hues. Inspired by functional harmony:
 * warm for stable tones, cool/tension for leading and altered tones.
 */
export const TONAL_PALETTE: Palette = {
  id: 'tonal-default',
  name: 'Tonal Function',
  root: '#f5c518',
  degrees: {
    '1': '#f5c518',
    '2': '#7ec8ff',
    'b2': '#4f8fd6',
    '3': '#5ddc9a',
    'b3': '#3fb0a0',
    '4': '#9b8cff',
    '#4': '#ff8fd0',
    '5': '#ff9f45',
    'b5': '#d06060',
    '6': '#c2f56a',
    'b6': '#8fae3f',
    '7': '#ff6b6b',
    'b7': '#e05a8a',
  },
  outside: '#3a4048',
  canvas: '#12161b',
  ink: '#0c0f12',
};

/** Simple hue-wheel palette keyed by semitone distance from root. */
export const CHROMATIC_PALETTE: Palette = {
  ...TONAL_PALETTE,
  id: 'chromatic-wheel',
  name: 'Chromatic Wheel',
  degrees: Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [String(i), `hsl(${i * 30} 80% 55%)`]),
  ),
};

/** Monochrome palette for print / low-vision / distraction-free study. */
export const MONO_PALETTE: Palette = {
  ...TONAL_PALETTE,
  id: 'mono',
  name: 'Monochrome',
  root: '#ffffff',
  degrees: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i), '#9aa4b2'])),
  outside: '#2a2f36',
  canvas: '#0d0d0d',
  ink: '#000000',
};

export const PALETTES: readonly Palette[] = [TONAL_PALETTE, CHROMATIC_PALETTE, MONO_PALETTE];

/** Resolve the colour for a step relative to a root, honouring the palette. */
export function colorForStep(
  step: number,
  palette: Palette,
  mode: NotationMode,
  preferredLabel?: string,
): string {
  if (mode === 'blind') return palette.outside;
  const label = preferredLabel ?? degreeLabelForStep(pc(step));
  const direct = palette.degrees[label];
  if (direct) return direct;
  const bySemitone = palette.degrees[String(pc(step))];
  return bySemitone ?? palette.outside;
}

/** Build the marker content for one member of a pattern.
 *
 * All text comes from `labelFor` (packages/core/src/labels.ts — THE rules file
 * you edit by hand). The presenter supplies concrete LINEAR pitch numbers
 * (pitch + 12·octave, C0 = 0) of the sounding note and of an octave-anchored
 * root, plus pattern context (name, steps, declared degree annotations), so
 * your rules can consult everything needed to decide the fret-dot string.
 */
export function markerForPatternMember(
  pattern: Pattern,
  stepIndex: number,
  options: {
    mode: NotationMode;
    palette?: Palette;
    keyContext?: readonly PitchClass[];
    showNoteNamesUnderIntervals?: boolean;
    /** Linear pitch number of the sounding note at this position (e.g. E2 = 28). */
    pitchLinear?: number;
    /** Linear pitch number of the pattern root in the same octave region. */
    rootLinear?: number;
  },
): MarkerContent {
  const palette = options.palette ?? TONAL_PALETTE;
  const step = pattern.steps[stepIndex] ?? 0;
  const memberPc = pcAdd(pattern.root, step);
  const isRoot = stepIndex === 0 || pcSub(memberPc, pattern.root) === 0;
  const degree = patternDegrees(pattern)[stepIndex] ?? degreeLabelForStep(pc(step));
  const spelling = spellingForMember(pattern, stepIndex, memberPc, options.keyContext);

  // Octave-anchored linear root: if the sounding note is F#3 (=54) and its pc
  // distance above the root is 6 semitones, the root's linear number in that
  // octave region is 54 - 6 = 48. Keeps label maths octave-correct.
  const rootLinear =
    options.rootLinear ??
    (options.pitchLinear !== undefined ? options.pitchLinear - pc(step) : pc(pattern.root));
  const soundingLinear = options.pitchLinear ?? pcAdd(rootLinear, pc(step));

  const label = labelFor({
    rootLinear,
    pitchLinear: soundingLinear,
    mode: options.mode,
    context: {
      scaleName: pattern.name,
      rootSpelling: formatSpelling({
        step: pattern.root,
        alteration: pattern.rootSpelling?.alteration ?? 0,
      }),
      steps: pattern.steps,
      declaredDegree: isRoot || options.mode === 'letter' ? undefined : degree,
      preferFlats: pattern.rootSpelling ? pattern.rootSpelling.alteration < 0 : undefined,
    },
  });

  // Letter-mode text: prefer the diatonically-correct spelling engine result
  // (handles one-letter-per-scale, e.g. D harmonic minor → C#, F## etc.).
  // Only fall back to the enharmonic pool when the spelling engine has nothing.
  // The diatonic spelling engine is authoritative for note names: one letter
  // per scale degree, key-aware accidentals (D harmonic minor → C#, Eb dorian
  // → C natural, Gb major → Bbb if ever needed…). `chooseEnharmonic` remains
  // exported from labels.ts for hand-authored override rules.
  const letterText = formatSpelling(spelling);
  void chooseEnharmonic;

  switch (options.mode) {
    case 'blind':
      return {
        text: '',
        fill: palette.outside,
        stroke: palette.canvas,
        isRoot,
      };
    case 'interval':
    case 'tonal':
    case 'number':
    case 'degree':
      return {
        text: label || degree,
        sub:
          options.showNoteNamesUnderIntervals || options.mode === 'tonal'
            ? letterText
            : undefined,
        fill: colorForStep(step, palette, options.mode, degree),
        stroke: isRoot ? palette.root : palette.canvas,
        isRoot,
        degree,
        spelling,
        halo: '#f5f7fa',
      };
    case 'letter':
      return {
        text: letterText,
        fill: palette.degrees[degree] ?? palette.outside,
        stroke: palette.canvas,
        isRoot,
        degree,
        spelling,
        halo: '#f5f7fa',
      };
  }
}

/** Marker for a position that is *not* part of any displayed pattern. */
export function markerForNonMember(palette: Palette, _mode: NotationMode): MarkerContent {
  return {
    text: '',
    fill: palette.outside,
    stroke: palette.canvas,
    isRoot: false,
  };
}

/**
 * Decide the letter shown at a concrete absolute pitch, given a pattern context.
 * Presenters call this when they need "the note at this fret" rather than "the
 * nth member of the pattern" — e.g. hover tooltips on non-pattern positions.
 */
export function spellingAtAbsolute(
  midi: number,
  pattern: Pattern | undefined,
  preferFlats = false,
): Spelling {
  const target = pc(midi);
  if (pattern) {
    const rel = pcSub(target, pattern.root);
    const idx = pattern.steps.findIndex((s) => s === rel);
    if (idx >= 0 && pattern.spellings?.[idx]) return pattern.spellings[idx]!;
  }
  const naturals: Spelling[] = [];
  for (let step = 0; step < 7; step++) {
    const s = { step, alteration: 0 };
    if (spellingToPc(s) === target) return s;
    naturals.push(s);
  }
  void naturals;
  return spellInKey(target, preferFlats ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]);
}

/** Text-only rendering used by CLI examples, tests, and accessibility output. */
export function renderPatternText(pattern: Pattern, mode: NotationMode): string {
  if (mode === 'blind') return pattern.steps.map(() => '·').join(' ');
  return pattern.steps
    .map((_, i) => markerForPatternMember(pattern, i, { mode }).text)
    .join(' ');
}

/**
 * Degree labels for a pattern (`1 b3 5 b7`). When the pattern carries explicit
 * spellings (library templates always do), labels are derived from the letter
 * distance between each member's spelling and the root's — so `b9` vs `#2`,
 * `#4` vs `b5`, and the harmonic-minor `7` fall out of real diatonic grammar
 * instead of a semitone lookup table.
 */
export function patternDegrees(p: Pattern): string[] {
  const rootSp = p.rootSpelling ?? p.spellings?.[0];
  if (p.spellings && rootSp && p.spellings.length === p.steps.length) {
    return p.steps.map((st, i) => {
      const sp = p.spellings![i];
      if (!sp) return degreeLabelForStep(pc(st));
      const relDeg = (((sp.step - rootSp.step) % 7) + 7) % 7;
      const delta = sp.alteration - rootSp.alteration;
      const prefix = delta === 0 ? '' : delta < 0 ? 'b'.repeat(-delta) : '#'.repeat(delta);
      return `${prefix}${relDeg + 1}`;
    });
  }
  return p.steps.map((st) => degreeLabelForStep(pc(st)));
}

/**
 * The enharmonic resolution rule, in priority order:
 *   1. Explicit template spellings re-anchored onto the *root's* letter culture:
 *      D harmonic minor spells its leading tone C# (degree 7 -> letter C), while
 *      Eb dorian spells degree 6 as C natural, and Bb mixolydian spells b7 as Ab.
 *   2. A caller-supplied key context (`spellInKey`).
 *   3. Minimal-alteration spelling within the pattern's own pitch classes.
 */
function spellingForMember(
  pattern: Pattern,
  stepIndex: number,
  memberPc: PitchClass,
  keyContext?: readonly PitchClass[],
): Spelling {
  const declared = pattern.spellings?.[stepIndex];
  const rootSp = pattern.rootSpelling ?? pattern.spellings?.[0];
  if (declared && rootSp) {
    // Template spellings are stored C-relative (letter index with C=0), so the
    // member's *letter distance above the root* is just `declared.step` — do NOT
    // subtract the root's step here or every label shifts a second time.
    const relStep = ((declared.step % 7) + 7) % 7;
    return rootAnchoredSpelling(memberPc, relStep, rootSp.step + 1, rootSp.alteration);
  }
  if (keyContext && keyContext.length > 0) return spellInKey(memberPc, keyContext);
  return spellInKey(memberPc, patternPcs(pattern));
}
