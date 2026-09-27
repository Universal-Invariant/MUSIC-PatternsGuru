/**
 * The instrument abstraction — the heart of the plugin architecture.
 *
 * An instrument is *only* a coordinate system plus a mapping into and out of
 * pitch space. Nothing about drawing, colour, or notation lives here. That is
 * deliberate: it means adding a new instrument is a small, pure, testable module
 * with no rendering code at all, and it means the same visualization logic works
 * on a fretboard, a keyboard, a flute's key chart, or a trumpet's valve table.
 *
 * ## The adjunction
 *
 * `pitchToPosition` and `positionToPitch` are not required to be inverses. On a
 * guitar, `pitchToPosition(67)` returns several candidates (5th string 2nd fret,
 * 4th string 10th fret, ...) while `positionToPitch` returns exactly one. Formally
 * we have an adjunction between the preorder of pitches (by register) and the
 * preorder of positions (by playability):
 *
 *     positions(pitch) ⊣ pitch(position)
 *
 * The "lossiness" of each direction is first-class data:
 *   - `many-to-one`  → enharmonic collapse (piano: D# = Eb)
 *   - `one-to-many`  → octave/string ambiguity (fretboard, harp)
 *   - `partial`      → notes outside range, or impossible fingerings
 *
 * Presenters ask for *all* candidates and decide how to display the multiplicity
 * (ghost markers, badges, "also available at…" hints).
 */

import type { PitchClass } from './pitch-class.js';

/** Stable identifier for a registered instrument (`guitar-standard`, ...). */
export type InstrumentId = string;

/** One physical playing location, in instrument-native terms. */
export interface Position {
  /** Canonical key used for React keys, sets, and relation groups. */
  readonly id: string;
  /** Human label rendered on the layout (`3fr · A`, `F#`, `open G`). */
  readonly label: string;
  /** Grid/axis coordinates for the presenter. Semantics are instrument-defined
   *  but always ordered so that larger values mean higher pitch or later string. */
  readonly row: number;
  readonly col: number;
  /** Absolute MIDI number when the position produces a definite pitch. */
  readonly midi?: number;
  /** Optional secondary grouping axis (e.g. hand position, octave band). */
  readonly group?: string;
}

/** How a position relates to pitch space. */
export type PitchBinding =
  | { readonly kind: 'exact'; readonly midi: number }
  | { readonly kind: 'class'; readonly pc: PitchClass }
  | { readonly kind: 'none' };

/** Candidate result when mapping a pitch onto the instrument. */
export interface PositionCandidate {
  readonly position: Position;
  /** True when this candidate is the "canonical" place to show the note. */
  readonly preferred: boolean;
  /** Distance penalty used for preference ordering (0 = ideal). */
  readonly cost: number;
}

/** Range descriptor surfaced in the UI and used to clip layouts. */
export interface Range {
  readonly lowMidi: number;
  readonly highMidi: number;
  /** Whether every chromatic pitch inside the range is actually playable. */
  readonly contiguous: boolean;
}

/**
 * The instrument contract. Implementations must be pure and side-effect free so
 * they can run in workers, be memoized safely, and be compared structurally.
 */
export interface Instrument {
  readonly id: InstrumentId;
  readonly name: string;
  readonly family: InstrumentFamily;
  readonly summary: string;

  /** Full extent of the instrument. */
  readonly range: Range;

  /** Every position the instrument exposes, in reading order. */
  positions(): readonly Position[];

  /** Direct lookup by canonical position id. */
  positionAt(id: string): Position | undefined;

  /** Pitch → positions. Must return every candidate, cheapest first. */
  pitchToPositions(midi: number): readonly PositionCandidate[];

  /** Pitch class → positions across the whole instrument (for pattern views). */
  pitchClassToPositions(pc: PitchClass): readonly PositionCandidate[];

  /** Position → pitch (the left adjoint; single-valued or partial). */
  positionToPitch(position: Position): PitchBinding;

  /** Layout metadata the presenter needs to draw the geometry. */
  layout(): InstrumentLayout;

  /** Instrument-specific capability flags (see {@link InstrumentCapabilities}). */
  capabilities(): Partial<InstrumentCapabilities>;
}

export type InstrumentFamily =
  | 'fretted-string'
  | 'bowed-string'
  | 'plucked-string'
  | 'keyboard'
  | 'woodwind'
  | 'brass'
  | 'percussion-tuned'
  | 'virtual';

/**
 * Geometry description. Presenters consume this instead of switching on
 * instrument ids, which is what keeps the renderer generic: a fretboard-style
 * presenter can draw any instrument whose layout says `axes: ['string','fret']`.
 */
export interface InstrumentLayout {
  /** Number of rows (strings / manual / key-chains). */
  readonly rows: number;
  /** Number of columns (frets / keys / holes). */
  readonly cols: number;
  /** Labels for the axes, e.g. `['string', 'fret']`. */
  readonly axisLabels: readonly [string, string];
  /** Visual arrangement hint chosen by the instrument author. */
  readonly orientation: 'horizontal' | 'vertical' | 'grid' | 'linear';
  /** Row/column spacing semantics: `'log'` for equal-tempered grids. */
  readonly metric: 'uniform' | 'semitone' | 'log';
  /** Positions that are physically unreachable / muted (rendered dimmed). */
  readonly blocked?: readonly string[];
}

/** Capability flags let presenters enable/disable affordances generically. */
export interface InstrumentCapabilities {
  /** Multiple positions per pitch (fretboard, harp). Drives ghost-marker UI. */
  polyphonicPositions: boolean;
  /** Enharmonic collapse is audible (fixed-pitch instruments). */
  enharmonicEquivalent: boolean;
  /** Continuous pitch control (bends, slides, vibrato, glissando). */
  continuousPitch: boolean;
  /** Timbral variation per position (different strings sound different). */
  timbralVariation: boolean;
  /** Chords require specific voicings rather than arbitrary stacks. */
  voicingConstrained: boolean;
  /** Transposing instrument: written pitch differs from sounding pitch. */
  transposing: boolean;
  /** Microtonal / extended just intonation capable. */
  microtonal: boolean;
}

export const DEFAULT_CAPABILITIES: InstrumentCapabilities = {
  polyphonicPositions: false,
  enharmonicEquivalent: true,
  continuousPitch: false,
  timbralVariation: false,
  voicingConstrained: false,
  transposing: false,
  microtonal: false,
};

/** Convenience: build a position id from two axis indices. */
export function posId(row: number, col: number, prefix = ''): string {
  return `${prefix}${row}:${col}`;
}

/** Parse a `row:col` id back into coordinates (presenter hit-testing helper). */
export function parsePosId(id: string): { row: number; col: number } | undefined {
  const m = /^(\d+):(\d+)$/.exec(id);
  if (!m) return undefined;
  return { row: Number(m[1]), col: Number(m[2]) };
}

/** MIDI number of a position, respecting optional transposition offset. */
export function soundingMidi(binding: PitchBinding, transposeBy = 0): number | undefined {
  if (binding.kind === 'exact') return binding.midi + transposeBy;
  if (binding.kind === 'class') return undefined;
  return undefined;
}

/**
 * Map a set of pitch classes onto an instrument, returning the position ids that
 * should light up. This is the single most-called function in the app: every
 * pattern view, every overlay, every relation group goes through it.
 */
export function highlightPositions(
  instrument: Instrument,
  pcs: Iterable<PitchClass>,
  options: { includeNonPreferred?: boolean } = {},
): Set<string> {
  const out = new Set<string>();
  for (const p of pcs) {
    for (const cand of instrument.pitchClassToPositions(p)) {
      if (!options.includeNonPreferred && !cand.preferred) continue;
      out.add(cand.position.id);
    }
  }
  return out;
}

/** Base MIDI for a tuning/open-string note, so instruments share one helper. */
export function openStringMidi(letterPc: PitchClass, octave: number): number {
  return 12 * (octave + 1) + ((letterPc % 12) + 12) % 12;
}
