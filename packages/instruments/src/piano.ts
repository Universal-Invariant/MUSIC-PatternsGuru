/**
 * Piano / keyboard instrument plugin.
 *
 * Models a fixed-pitch chromatic grid as rows × columns so it flows through the
 * generic scene pipeline with zero special-casing in core:
 *   row 0 = white-key lane, row 1 = black-key lane
 *   col   = semitone index from `lowMidi` (every column is a real key)
 * Black keys sit between whites; their column centre is offset by +0.5 in the
 * presenter's geometry. Enharmonic collapse (D# == Eb) is inherent: one physical
 * key per pitch class per octave — exactly what "many-to-one" means here.
 */

import {
  type Instrument,
  type InstrumentLayout,
  type PitchBinding,
  type Position,
  type PositionCandidate,
} from '@mpg/core';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

/** Pitch class (non-negative modulo 12). */
const pc = (n: number): number => ((n % 12) + 12) % 12;
const BLACK_OFFSET: Record<number, number> = { 1: 0, 3: -1, 6: 0, 8: -1, 10: -1 };
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export interface PianoOptions {
  id?: string;
  name?: string;
  /** Lowest MIDI note rendered (default 36 = C2). */
  lowMidi?: number;
  /** Highest MIDI note rendered (default 96 = C7). */
  highMidi?: number;
}

export function createPianoInstrument(options: PianoOptions = {}): Instrument {
  const id = options.id ?? 'piano';
  const name = options.name ?? 'Piano';
  const low = options.lowMidi ?? 36;
  const high = options.highMidi ?? 96;
  const cols = high - low + 1;

  const positions: Position[] = [];
  const byId = new Map<string, Position>();
  for (let midi = low; midi <= high; midi++) {
    const p = pc(midi);
    const isBlack = !WHITE_PCS.includes(p);
    const col = midi - low;
    const pos: Position = {
      id: `k${midi}`,
      label: `${NOTE_NAMES[p]}${Math.floor(midi / 12) - 1}`,
      row: isBlack ? 1 : 0,
      col,
      midi,
    };
    positions.push(pos);
    byId.set(pos.id, pos);
  }

  const layout: InstrumentLayout = {
    rows: 2,
    cols,
    axisLabels: ['key', 'pitch'],
    orientation: 'horizontal',
    metric: 'semitone',
  };

  return {
    id,
    name,
    family: 'keyboard',
    summary: `${name}, MIDI ${low}–${high}.`,
    range: { lowMidi: low, highMidi: high, contiguous: true },
    positions: () => positions,
    positionAt: (pid: string) => byId.get(pid),
    pitchToPositions(midi: number): readonly PositionCandidate[] {
      const pos = byId.get(`k${midi}`);
      if (!pos) return [];
      return [{ position: pos, preferred: true, cost: 0 }];
    },
    pitchClassToPositions(p: number): readonly PositionCandidate[] {
      const target = pc(p);
      const out: PositionCandidate[] = [];
      for (let midi = low; midi <= high; midi++) {
        if (pc(midi) !== target) continue;
        const pos = byId.get(`k${midi}`)!;
        out.push({ position: pos, preferred: true, cost: Math.abs(midi - (low + high) / 2) });
      }
      return out;
    },
    positionToPitch(position: Position): PitchBinding {
      return typeof position.midi === 'number'
        ? { kind: 'exact', midi: position.midi }
        : { kind: 'none' };
    },
    layout: () => layout,
    capabilities: () => ({ polyphonicPositions: false }),
  };
}

/** Whether a MIDI note is a black key. Exported for the keyboard renderer. */
export function isBlackKey(midi: number): boolean {
  return !WHITE_PCS.includes(pc(midi));
}

/** Horizontal centre offset (in column units) for black keys: 0 or -0.5…+1. */
export function blackKeyOffset(midi: number): number {
  return BLACK_OFFSET[pc(midi)] ?? 0;
}
