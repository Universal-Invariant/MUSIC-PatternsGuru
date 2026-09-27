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
import { pc, pcAdd, pcSub, type PitchClass } from './pitch-class.js';
import { formatSpelling, spellInKey, spellingToPc, type Spelling } from './spelling.js';

export type NotationMode = 'blind' | 'interval' | 'letter' | 'tonal';

export const NOTATION_MODES: readonly NotationMode[] = ['blind', 'interval', 'letter', 'tonal'];

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
export function colorForStep(step: number, palette: Palette, mode: NotationMode): string {
  if (mode === 'blind') return palette.outside;
  const label = degreeLabelForStep(pc(step));
  const direct = palette.degrees[label];
  if (direct) return direct;
  const bySemitone = palette.degrees[String(pc(step))];
  return bySemitone ?? palette.outside;
}

/** Build the marker content for one member of a pattern. */
export function markerForPatternMember(
  pattern: Pattern,
  stepIndex: number,
  options: {
    mode: NotationMode;
    palette?: Palette;
    keyContext?: readonly PitchClass[];
    showNoteNamesUnderIntervals?: boolean;
  },
): MarkerContent {
  const palette = options.palette ?? TONAL_PALETTE;
  const step = pattern.steps[stepIndex] ?? 0;
  const memberPc = pcAdd(pattern.root, step);
  const isRoot = stepIndex === 0 || pcSub(memberPc, pattern.root) === 0;
  const degree = degreeLabelForStep(pc(step));
  const spelling = options.keyContext
    ? spellInKey(memberPc, options.keyContext)
    : (pattern.spellings?.[stepIndex] ?? spellInKey(memberPc, [pattern.root]));

  switch (options.mode) {
    case 'blind':
      return {
        text: '',
        fill: palette.outside,
        stroke: palette.canvas,
        isRoot,
      };
    case 'interval':
      return {
        text: degree,
        sub: options.showNoteNamesUnderIntervals ? formatSpelling(spelling) : undefined,
        fill: palette.degrees[degree] ?? palette.degrees[String(pc(step))] ?? palette.root,
        stroke: palette.canvas,
        isRoot,
        degree,
        spelling,
      };
    case 'letter':
      return {
        text: formatSpelling(spelling),
        fill: palette.degrees[degree] ?? palette.outside,
        stroke: palette.canvas,
        isRoot,
        degree,
        spelling,
      };
    case 'tonal':
      return {
        text: degree,
        sub: formatSpelling(spelling),
        fill: colorForStep(step, palette, 'tonal'),
        stroke: isRoot ? palette.root : palette.canvas,
        isRoot,
        degree,
        spelling,
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
