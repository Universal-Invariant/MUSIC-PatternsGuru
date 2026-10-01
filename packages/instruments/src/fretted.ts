/**
 * Generic fretted-instrument engine.
 *
 * One implementation covers 6-string guitar, bass, mandolin, ukulele, 7-string
 * extended-range guitars, and (with a `fretsPerString` cap) even bowed strings if
 * we ever want a fingerboard grid model. The engine is pure: it knows about
 * tunings, fret counts, and offsets — nothing about drawing.
 *
 * Coordinate convention (matches `@mpg/core` `Position`):
 *   row : string index, 0 = highest pitch (1st string / thinnest). Larger row ⇒
 *         lower-pitched string, so rows increase *downwards* on screen.
 *   col : fret number, 0 = open string. Larger col ⇒ higher pitch, rightwards.
 *
 * Preference ordering for `pitchToPositions` implements a simple, honest notion
 * of playability: prefer positions reachable with the fewest frets, break ties by
 * preferring lower-pitched strings (room to bend above), then by distance from a
 * reference centre position. This is what makes "one marker per note" views look
 * like a sane fingering rather than noise.
 */

import {
  posId,
  DEFAULT_CAPABILITIES,
  type Instrument,
  type InstrumentLayout,
  type Position,
  type PositionCandidate,
  type Range,
} from '@mpg/core';
import { pc, type PitchClass } from '@mpg/core';

export interface StringSpec {
  /** MIDI number of the open string. */
  readonly openMidi: number;
  /** Short label used in position ids/labels (`E`, `A`, `D`, ...). */
  readonly name: string;
}

export interface FrettedConfig {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  /** Ordered high → low (e.g. standard guitar: [E4, B3, G3, D3, A2, E2]). */
  readonly strings: readonly StringSpec[];
  readonly numFrets: number;
  /** Nut offset in semitones (0 normally; capos/banjo 5th-string can use it). */
  readonly nutOffset?: number;
  readonly layout?: Partial<InstrumentLayout>;
  /** Reference centre used for preference ordering, as `[row, col]`. */
  readonly centre?: readonly [number, number];
}

/** A horizontal fret window (inclusive columns) used for box-pattern views. */
export interface FretWindow {
  readonly colStart: number;
  readonly colEnd: number;
}

/**
 * Return a shallow clone of `base` whose preferred/candidate flags are
 * recomputed for the given fret window: every in-window occurrence of each
 * pitch class becomes preferred (classic CAGED-style box patterns light up on
 * all six strings), while out-of-window candidates keep their original global
 * ranking. The original instrument is never mutated.
 */
export function withFretWindow(base: Instrument, win: FretWindow): Instrument {
  const src = base.pitchClassToPositions.bind(base);
  const cache = new Map<number, ReturnType<typeof src>>();
  return {
    ...base,
    pitchClassToPositions(pc: number) {
      let list = cache.get(pc);
      if (!list) {
        list = src(pc).map((c) =>
          c.position.col >= win.colStart && c.position.col <= win.colEnd
            ? { ...c, preferred: true }
            : c,
        );
        cache.set(pc, list);
      }
      return list;
    },
  };
}

/** Standard 6-string guitar tuning, high → low. */
export const STANDARD_TUNING: readonly StringSpec[] = [
  { openMidi: 64, name: 'E' }, // E4
  { openMidi: 59, name: 'B' }, // B3
  { openMidi: 55, name: 'G' }, // G3
  { openMidi: 50, name: 'D' }, // D3
  { openMidi: 45, name: 'A' }, // A2
  { openMidi: 40, name: 'E' }, // E2
];

/** Common alternate tunings, exposed for the UI's tuning picker. */
export const GUITAR_TUNINGS: Record<string, readonly StringSpec[]> = {
  standard: STANDARD_TUNING,
  dropD: [
    { openMidi: 64, name: 'E' },
    { openMidi: 59, name: 'B' },
    { openMidi: 55, name: 'G' },
    { openMidi: 50, name: 'D' },
    { openMidi: 45, name: 'A' },
    { openMidi: 38, name: 'D' },
  ],
  openG: [
    { openMidi: 67, name: 'G' },
    { openMidi: 59, name: 'B' },
    { openMidi: 55, name: 'G' },
    { openMidi: 50, name: 'D' },
    { openMidi: 43, name: 'G' },
    { openMidi: 38, name: 'D' },
  ],
  dadgad: [
    { openMidi: 62, name: 'D' },
    { openMidi: 57, name: 'A' },
    { openMidi: 55, name: 'G' },
    { openMidi: 50, name: 'D' },
    { openMidi: 45, name: 'A' },
    { openMidi: 40, name: 'D' },
  ],
  halfStepDown: STANDARD_TUNING.map((s) => ({ ...s, openMidi: s.openMidi - 1 })),
};

export const BASS_TUNING: readonly StringSpec[] = [
  { openMidi: 43, name: 'G' },
  { openMidi: 38, name: 'D' },
  { openMidi: 33, name: 'A' },
  { openMidi: 28, name: 'E' },
];

export const MANDOLIN_TUNING: readonly StringSpec[] = [
  { openMidi: 79, name: 'E' },
  { openMidi: 72, name: 'A' },
  { openMidi: 67, name: 'D' },
  { openMidi: 60, name: 'G' },
];

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Build an {@link Instrument} from a fretted configuration. Pure + memoized. */
export function createFrettedInstrument(config: FrettedConfig): Instrument {
  const nut = config.nutOffset ?? 0;
  const stringCount = config.strings.length;
  const numFrets = config.numFrets;
  const centre: readonly [number, number] = config.centre ?? [Math.floor(stringCount / 2), 5];

  const positions: Position[] = [];
  const byId = new Map<string, Position>();
  const byPc = new Map<PitchClass, PositionCandidate[]>();

  for (let row = 0; row < stringCount; row++) {
    const spec = config.strings[row]!;
    for (let col = 0; col <= numFrets; col++) {
      const midi = spec.openMidi + col + nut;
      const label = col === 0 ? `open ${spec.name}` : `${col}fr · ${spec.name}`;
      const p: Position = {
        id: posId(row, col, `${config.id}:`),
        label,
        row,
        col,
        midi,
        group: `string-${row}`,
      };
      positions.push(p);
      byId.set(p.id, p);

      const target = pc(midi);
      const list = byPc.get(target) ?? [];
      list.push({ position: p, preferred: false, cost: costOf(row, col, centre) });
      byPc.set(target, list);
    }
  }

  // Mark exactly one preferred candidate per pitch class using a playability
  // score that mirrors how players actually learn fretboard shapes:
  //   score = maxFret + span + 2 * totalFrets
  // - `maxFret` keeps shapes near the nut (window-anchored),
  // - `span` (highMidi - lowMidi across chosen positions) penalises patterns
  //   that scatter across the neck,
  // - `totalFrets` favours open-string-heavy, compact boxes over stretched ones.
  // Box-pattern ("fret window") views are handled separately by
  // `withFretWindow`, which re-flags candidates without mutating this data.
  const preferredByPc = new Map<PitchClass, PositionCandidate>();

  function scoreOf(chosen: readonly PositionCandidate[]): number {
    let minMidi = Infinity;
    let maxMidi = -Infinity;
    let maxFret = 0;
    let totalFrets = 0;
    for (const c of chosen) {
      const midi = c.position.midi ?? 0;
      if (midi < minMidi) minMidi = midi;
      if (midi > maxMidi) maxMidi = midi;
      if (c.position.col > maxFret) maxFret = c.position.col;
      totalFrets += c.position.col;
    }
    return maxFret + (maxMidi - minMidi) + 2 * totalFrets;
  }

  // Greedy selection in ascending MIDI order within each pitch-class candidate
  // list, so lower-octave anchors are considered first.
  const pcLists = [...byPc.entries()].sort((a, b) => a[0] - b[0]);
  for (const [targetPc, candidates] of pcLists) {
    const sorted = [...candidates].sort(
      (a, b) =>
        (a.position.midi ?? 0) - (b.position.midi ?? 0) ||
        a.position.col - b.position.col ||
        b.position.row - a.position.row,
    );
    let best: PositionCandidate | undefined;
    let bestScore = Infinity;
    for (const cand of sorted) {
      const chosen: PositionCandidate[] = [];
      // Add already-preferred lower pitch classes.
      for (const [, p] of preferredByPc) chosen.push(p);
      chosen.push(cand);
      const s = scoreOf(chosen);
      if (s < bestScore) {
        bestScore = s;
        best = cand;
      }
    }
    if (best) preferredByPc.set(targetPc, { ...best, preferred: true });
  }

  // Apply the preferred flag back into the candidate lists.
  for (const list of byPc.values()) {
    for (let i = 0; i < list.length; i++) {
      const cand = list[i]!;
      const pref = preferredByPc.get(pc(cand.position.midi ?? 0));
      if (pref && pref.position.id === cand.position.id) {
        list[i] = { ...cand, preferred: true };
      }
    }
  }

  const lowMidi = Math.min(...positions.map((p) => p.midi ?? 0));
  const highMidi = Math.max(...positions.map((p) => p.midi ?? 0));

  const range: Range = { lowMidi, highMidi, contiguous: true };

  const layout: InstrumentLayout = {
    rows: stringCount,
    cols: numFrets + 1,
    axisLabels: ['string', 'fret'],
    orientation: 'horizontal',
    metric: 'uniform',
    ...config.layout,
  };

  return {
    id: config.id,
    name: config.name,
    family: 'fretted-string',
    summary: config.summary,
    range,
    positions: () => positions,
    positionAt: (id: string) => byId.get(id),
    pitchToPositions: (midi: number) => byPc.get(pc(midi)) ?? [],
    pitchClassToPositions: (target: PitchClass) => byPc.get(pc(target)) ?? [],
    positionToPitch: (p: Position) =>
      p.midi !== undefined ? { kind: 'exact', midi: p.midi } : { kind: 'none' },
    layout: () => layout,
    capabilities: () => ({
      ...DEFAULT_CAPABILITIES,
      polyphonicPositions: true,
      enharmonicEquivalent: true,
      continuousPitch: true,
      timbralVariation: true,
      voicingConstrained: true,
    }),
  };
}

function costOf(row: number, col: number, centre: readonly [number, number]): number {
  const fretPenalty = col === 0 ? 0 : col; // open strings are cheap but...
  const rowDist = Math.abs(row - centre[0]);
  const colDist = Math.abs(col - centre[1]);
  // Prefer mid-fret-region, low strings, compact hand shapes.
  return fretPenalty * 1.0 + colDist * 0.35 + rowDist * 0.5;
}

/** Convenience: human-readable note name for a MIDI number (sharps). */
export function midiLabel(midi: number): string {
  const n = Math.round(midi);
  return `${PC_NAMES[pc(n)]}${Math.floor(n / 12) - 1}`;
}
