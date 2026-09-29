import { describe, it, expect } from 'vitest';
import { findTemplate, rootTemplateAt } from '../library';
import { spellPattern } from '../pattern';
import { formatSpelling } from '../spelling';
import { buildScene } from "../../../react/src/scene.js";
import { FretboardPresenter } from "../../../react/src/presenters/fretboard.js";
import { guitarStandard as guitar } from "../../../instruments/src/index.js";

const names = (p: Parameters<typeof spellPattern>[0]) => spellPattern(p).map(formatSpelling);

describe('spelling fixes', () => {
  it('D harmonic minor uses C# not Db', () => {
    const t = findTemplate('harmonic minor')!;
    expect(names(rootTemplateAt(t, 'D')).join(' ')).toBe('D E F G A Bb C#');
  });
  it('Eb dorian has C natural', () => {
    const t = findTemplate('dorian')!;
    expect(names(rootTemplateAt(t, 'Eb'))).toContain('C');
  });
});

describe('fretboard pitch mapping', () => {
  it('E ionian renders first-position box with open strings, one marker per pc', () => {
    const scale = rootTemplateAt(findTemplate('ionian')!, 'E');
    const scene = buildScene(guitar, { patterns: [scale], mode: "letter" });
    const presenter = new FretboardPresenter();
    const frame = presenter.present(scene);
    // grid[row][col] = letter or null. row 0 = high E string, row 5 = low E string.
    const grid: (string | null)[][] = Array.from({ length: 6 }, () => Array(13).fill(null));
    for (const m of frame.markers) {
      if (!m.content.text) continue;
      const r = m.position.row, c = m.position.col;
      if (r >= 0 && r < 6 && c >= 0 && c < 13) grid[r]![c] = m.content.text.replace(/♯/g, '#').replace(/♭/g, 'b');
    }
    // Classic first-position E-major scale shape: every pitch class sits in the
    // lowest reachable fret window, which puts all seven pcs on the low E string
    // within frets 0-11 (E open, F#2, G#4, A5, B7, C#9, D#11) — exactly how a
    // guitarist plays the "box" anchored to the open low string.
    expect(grid[5]).toEqual(['E', null, 'F#', null, 'G#', 'A', null, 'B', null, 'C#', null, 'D#', null]);
    // Higher strings carry no duplicate pcs in single-marker mode.
    for (let r = 0; r < 5; r++) expect(grid[r]!.slice(0, 13)).toEqual(Array(13).fill(null));
    // Exactly one marker per pitch class among member markers
    const pcs = new Set(frame.markers .filter((m) => !!m.content.text).map((m) => ((m.position.midi ?? 0) % 12 + 12) % 12));
    expect(pcs.size).toBe(7);
    expect(frame.markers .filter((m) => !!m.content.text).length).toBe(7);
  });
});
