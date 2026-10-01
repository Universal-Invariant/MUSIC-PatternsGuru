import { describe, expect, it } from 'vitest';
import {
  FUNCTION_SHAPE_PALETTES,
  MARKER_SHAPES,
  shapeForStep,
} from '../presenter.js';

describe('function shape palettes', () => {
  it('exposes unique ids and valid shapes', () => {
    const ids = FUNCTION_SHAPE_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of FUNCTION_SHAPE_PALETTES) {
      expect(MARKER_SHAPES).toContain(p.ghost);
      for (const shape of Object.values(p.degrees)) {
        expect(MARKER_SHAPES).toContain(shape);
      }
    }
  });

  it('chord-tones palette maps triad tones to discs and the rest to squares', () => {
    const p = FUNCTION_SHAPE_PALETTES.find((x) => x.id === 'chord-circle-rest-square');
    expect(p).toBeDefined();
    // triad members are discs; tensions/6/7 become squares
    expect(shapeForStep(p!, '1', 0)).toBe('disc');
    expect(shapeForStep(p!, '3', 4)).toBe('disc');
    expect(shapeForStep(p!, 'b3', 3)).toBe('disc');
    expect(shapeForStep(p!, '5', 7)).toBe('disc');
    expect(shapeForStep(p!, '2', 2)).toBe('square');
    expect(shapeForStep(p!, '4', 5)).toBe('square');
    expect(shapeForStep(p!, '6', 9)).toBe('square');
    expect(shapeForStep(p!, '7', 11)).toBe('square');
  });

  it('falls back to degree-label keys (not raw pitch classes) when the label is missing', () => {
    const p = FUNCTION_SHAPE_PALETTES.find((x) => x.id === 'chord-circle-rest-square')!;
    // degrees are keyed relative to the pattern root, so raw pcs without a
    // degree label resolve via the numeric fallback and default to square.
    expect(shapeForStep(p, undefined, 0)).toBe('square');
    expect(shapeForStep(p, undefined, 5)).toBe('square');
    // with labels, the triad/non-triad split applies:
    expect(shapeForStep(p, '1', 0)).toBe('disc');
    expect(shapeForStep(p, 'b7', 10)).toBe('square');
  });

  it('unknown degree/step defaults to square', () => {
    const custom = { id: 'x', name: 'X', degrees: {}, ghost: 'disc' as const };
    expect(shapeForStep(custom, '#9', 1)).toBe('square');
    expect(shapeForStep(custom, undefined, 1)).toBe('square');
  });

  it('uniform palettes give every degree the same shape', () => {
    const p = FUNCTION_SHAPE_PALETTES.find((x) => x.id === 'uniform-disc');
    expect(p).toBeDefined();
    const shapes = new Set(Object.values(p!.degrees));
    expect(shapes.size).toBe(1);
    expect(shapes.has('disc')).toBe(true);
  });
});
