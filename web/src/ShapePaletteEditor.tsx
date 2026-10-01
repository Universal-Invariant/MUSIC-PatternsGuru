/**
 * Customizable function-shape palette editor (#11).
 *
 * Modal that lets the user build a `FunctionShapePalette` from scratch — one
 * marker shape per tonal degree class (1, b3, #4 …), plus ghost/default shapes
 * — mirroring how colour palettes map degrees to colours. Custom palettes are
 * persisted to localStorage and returned to the app via `onSave`, which feeds
 * them into `buildScene({ functionShapes })` (the object path already supported
 * by the scene builder since the function-shape work landed).
 */

import { useEffect, useState } from 'react';
import {
  MARKER_SHAPES,
  type FunctionShapePalette,
  type MarkerShape,
} from '@mpg/core';

const STORAGE_KEY = 'mpg-custom-shape-palettes-v1';

/** Degree classes offered in the editor, in staff-order. */
export const DEGREE_KEYS = ['1', 'b2', '2', 'b3', '3', '4', '#4', 'b5', '5', 'b6', '6', 'b7', '7'] as const;

const SHAPE_GLYPHS: Record<MarkerShape, string> = {
  disc: '●',
  hexagon: '⬡',
  star: '★',
  octagon: '⯃',
  cloud: '☁',
  diamond: '◆',
  square: '■',
};

export function loadCustomShapePalettes(): FunctionShapePalette[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p): p is FunctionShapePalette =>
        p && typeof p.id === 'string' && typeof p.name === 'string' && p.degrees && typeof p.degrees === 'object',
    );
  } catch {
    return [];
  }
}

function persist(list: FunctionShapePalette[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Small inline preview of a shape (matches FrameSvg's vocabulary loosely). */
function ShapeGlyph({ shape }: { shape: MarkerShape }) {
  return <span className="shape-glyph">{SHAPE_GLYPHS[shape] ?? '?'}</span>;
}

interface EditorProps {
  open: boolean;
  /** Palette being edited (null = create new). */
  initial: FunctionShapePalette | null;
  onClose: () => void;
  onSave: (palette: FunctionShapePalette) => void;
  onDelete?: (id: string) => void;
}

export function ShapePaletteEditor({ open, initial, onClose, onSave, onDelete }: EditorProps) {
  const [name, setName] = useState('My shapes');
  const [degrees, setDegrees] = useState<Record<string, MarkerShape>>({});
  const [ghost, setGhost] = useState<MarkerShape>('disc');
  const [def, setDef] = useState<MarkerShape>('square');

  // Re-seed the form whenever the modal opens or the target changes.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? 'My shapes');
    setDegrees(initial ? { ...initial.degrees } : { '1': 'disc', '3': 'hexagon', '5': 'diamond' });
    setGhost(initial?.ghost ?? 'disc');
    setDef(initial?.default ?? 'square');
  }, [open, initial]);

  if (!open) return null;

  function build(): FunctionShapePalette {
    return {
      id: initial?.id ?? `custom-${Date.now().toString(36)}`,
      name: name.trim() || 'Untitled palette',
      degrees,
      ghost,
      default: def,
    };
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{initial ? `Edit “${initial.name}”` : 'New shape palette'}</h3>
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>

        <p className="muted small">
          Pick a shape for each tonal degree. Degrees you leave out fall back to the default shape.
        </p>
        <div className="shape-grid">
          {DEGREE_KEYS.map((d) => (
            <label key={d} className="shape-cell">
              <span className="degree-key">{d}</span>
              <select
                value={degrees[d] ?? ''}
                onChange={(e) => {
                  const v = e.target.value as MarkerShape | '';
                  setDegrees((cur) => {
                    const next = { ...cur };
                    if (!v) delete next[d];
                    else next[d] = v;
                    return next;
                  });
                }}
              >
                <option value="">— default —</option>
                {MARKER_SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {SHAPE_GLYPHS[s]} {s}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="row">
          <label className="field">
            Default shape
            <select value={def} onChange={(e) => setDef(e.target.value as MarkerShape)}>
              {MARKER_SHAPES.map((s) => (
                <option key={s} value={s}>{SHAPE_GLYPHS[s]} {s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Ghost/background shape
            <select value={ghost} onChange={(e) => setGhost(e.target.value as MarkerShape)}>
              {MARKER_SHAPES.map((s) => (
                <option key={s} value={s}>{SHAPE_GLYPHS[s]} {s}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Live preview strip */}
        <div className="shape-preview">
          {DEGREE_KEYS.map((d) => (
            <span key={d} title={`degree ${d}`}>
              <ShapeGlyph shape={degrees[d] ?? def} />
            </span>
          ))}
          <span className="muted small">&nbsp;+ ghosts: <ShapeGlyph shape={ghost} /></span>
        </div>

        <div className="row end">
          {initial && onDelete && (
            <button
              className="btn danger"
              onClick={() => {
                onDelete(initial.id);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => {
              const p = build();
              const list = loadCustomShapePalettes().filter((x) => x.id !== p.id);
              list.push(p);
              persist(list);
              onSave(p);
              onClose();
            }}
          >
            Save palette
          </button>
        </div>
      </div>
    </div>
  );
}

export function removeCustomShapePalette(id: string) {
  persist(loadCustomShapePalettes().filter((p) => p.id !== id));
}
