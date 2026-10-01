// Tests for the progression editor helpers (parse/serialize/sanitize).
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  matchTemplate,
  parseChordProse,
  parseSegments,
  sanitizeSegment,
  serializeSegments,
  type Segment,
} from '../PracticeTab';

function seg(partial: Partial<Segment>): Segment {
  return {
    id: Math.random().toString(36).slice(2),
    time: 0,
    scaleId: null,
    root: 'C',
    chordId: null,
    chordOffset: 0,
    overlays: [],
    ...partial,
  };
}

describe('matchTemplate', () => {
  it('matches scales and chords by name or id', () => {
    expect(matchTemplate('dorian')).toMatchObject({ scaleId: 'dorian', matched: true });
    expect(matchTemplate('minor seventh').chordId).toBeTruthy();
  });
  it('reports no match for free text', () => {
    const r = matchTemplate('some unknown thing');
    expect(r.matched).toBe(false);
    expect(r.scaleId).toBeNull();
    expect(r.chordId).toBeNull();
  });
});

describe('parseSegments', () => {
  it('parses tab-separated "time<TAB>root template" lines', () => {
    const segs = parseSegments('0\tD dorian\n8\tG mixolydian');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ time: 0, root: 'D', scaleId: 'dorian' });
    expect(segs[1]).toMatchObject({ time: 8, root: 'G', scaleId: 'mixolydian' });
  });

  it('keeps unmatched free text as a label instead of silently falling back to dorian (#2)', () => {
    const s = parseSegments('0\tC some unknown thing')[0]!;
    expect(s.scaleId).toBeNull();
    expect(s.chordId).toBeNull();
    expect(s.label).toContain('unknown');
  });

  it('still honours explicit dorian and root-only lines', () => {
    const a = parseSegments('0\tC dorian')[0]!;
    expect(a.scaleId).toBe('dorian');
    const b = parseSegments('0\tC')[0]!;
    expect(b.scaleId).toBe('dorian'); // documented default when only a root is given
  });

  it('skips garbage lines without throwing', () => {
    expect(parseSegments('not\ta valid line at all\n\n0\tA minor')).toHaveLength(1);
  });

  it('parses bar:beat mode when bpm > 0', () => {
    const segs = parseSegments('1:1\tC dorian\n5:1\tG mixolydian', 120);
    expect(segs[0]!.time).toBeCloseTo(0);
    expect(segs[1]!.time).toBeCloseTo((4 * 4 * 60) / 120); // 4 bars at 120bpm 4/4 = 8s
  });
});

describe('parseChordProse', () => {
  it('parses one-chord-per-line blocks with blank-line section repeats', () => {
    const segs = parseChordProse('Am7\nD7\n\nFmaj7', 2, 2);
    // block A (Am7, D7) + block B (Fmaj7) repeated twice → 6 segments
    expect(segs).toHaveLength(6);
    expect(segs.map((s) => s.root)).toEqual(['A', 'D', 'F', 'A', 'D', 'F']);
    expect(segs[0]!.time).toBeCloseTo(0);
    expect(segs[3]!.time).toBeCloseTo(6); // after 3 events × 2s spacing
    expect(segs[0]!.chordId).toBeTruthy();
  });
});

describe('serializeSegments round-trip', () => {
  it('re-parses what it writes for scale segments', () => {
    const original = [
      seg({ time: 0, root: 'D', scaleId: 'dorian' }),
      seg({ time: 8, root: 'G', scaleId: 'mixolydian' }),
    ];
    const text = serializeSegments(original);
    const round = parseSegments(text);
    expect(round.map((s) => s.time)).toEqual([0, 8]);
    expect(round[0]!.scaleId).toBe('dorian');
    expect(round[1]!.root).toBe('G');
  });
});

describe('sanitizeSegment', () => {
  it('accepts well-formed raw objects', () => {
    const s = sanitizeSegment({
      id: 'x',
      time: 3,
      root: 'A',
      scaleId: 'dorian',
      chordId: null,
      chordOffset: 0,
      overlays: [],
    });
    expect(s).toMatchObject({ id: 'x', time: 3, root: 'A', scaleId: 'dorian' });
  });

  it('rejects non-objects and non-finite times', () => {
    expect(sanitizeSegment(null)).toBeNull();
    expect(sanitizeSegment('nope')).toBeNull();
    expect(sanitizeSegment({ time: Number.NaN })).toBeNull();
    expect(sanitizeSegment({ time: 'x' })).toBeNull();
  });

  it('clamps weird fields to safe defaults', () => {
    const s = sanitizeSegment({ time: 1, root: 'H', scaleId: 42, overlays: 'nope' });
    expect(s?.root).toBe('C'); // invalid note token falls back
    expect(s?.scaleId).toBeNull(); // non-string rejected
    expect(Array.isArray(s?.overlays)).toBe(true);
  });

  it('preserves optional endTime and label', () => {
    const s = sanitizeSegment({ time: 0, endTime: 4, root: 'C', scaleId: null, label: 'vamp' });
    expect(s?.endTime).toBe(4);
    expect(s?.label).toBe('vamp');
  });
});
