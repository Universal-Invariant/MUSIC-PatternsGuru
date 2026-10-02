/**
 * MUSIC-PatternsGuru playground — working prototype for the guitar fretboard.
 *
 * Composition of the three layers:
 *   @mpg/core          pattern algebra + notation (pure theory)
 *   @mpg/instruments   the guitar instrument plugin (pitch ⇄ position adjunction)
 *   @mpg/react         scene builder → FretboardPresenter → FrameSvg renderer
 *
 * Everything here is UI state wiring; no music logic lives in this file.
 */

import { useMemo, useState } from 'react';
import {
  PALETTES,
  FUNCTION_SHAPE_PALETTES,
  NOTATION_MODES,
  pcAdd,
  type FunctionShapePalette,
  type NotationMode,
  type Pattern,
} from '@mpg/core';
import { ShapePaletteEditor, loadCustomShapePalettes, removeCustomShapePalette } from './ShapePaletteEditor.js';
import { PracticeTab } from './PracticeTab.js';
import {
  CHORD_TEMPLATES,
  SCALE_TEMPLATES,
  rootTemplateAt,
  parsePatternQuery,
  savedFromTemplate,
  templateFromSaved,
  newSavedId,
  parseSavedLibrary,
  exportSavedLibrary,
  type SavedPattern,
  type Template,
} from '@mpg/core/library';
import { INSTRUMENTS, listInstruments } from '@mpg/instruments';
import { FretboardPresenter, FrameSvg, buildScene } from '@mpg/react';

const ROOT_NAMES = ['C', 'C♯/D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

// Curated defaults so the app opens on something interesting.
const DEFAULT_SCALE = 'dorian';
const DEFAULT_CHORD = 'min7';
const DEFAULT_SECOND_SCALE = 'aeolian';

const presenter = new FretboardPresenter();

/** #2: user library persistence — generic JSON envelope, versioned (see core/library/saved.ts). */
const USER_LIBRARY_KEY = 'mpg-user-library-v1';
function loadUserLibrary(): SavedPattern[] {
  try {
    const raw = localStorage.getItem(USER_LIBRARY_KEY);
    return raw ? parseSavedLibrary(raw) : [];
  } catch {
    return [];
  }
}
function persistUserLibrary(items: SavedPattern[]): void {
  try {
    localStorage.setItem(USER_LIBRARY_KEY, exportSavedLibrary(items));
  } catch {
    /* storage full/blocked — in-memory list still works this session */
  }
}

interface SelectedInfo {
  readonly patterns: Pattern[];
  readonly error?: string;
}

export function App() {
  const [instrumentId, setInstrumentId] = useState<string>('guitar-standard');
  const [rootIdx, setRootIdx] = useState(2); // D
  const [scaleId, setScaleId] = useState(DEFAULT_SCALE);
  const [chordId, setChordId] = useState<string | null>(DEFAULT_CHORD);
  /** Stacked chord overlays (item 5): each entry is a chord template id plus an
   * optional degree offset for the root relative to the scale root (e.g. +1 =>
   * C#dim over D phrygian dominant). Add/remove freely; order = draw order. */
  const [overlayList, setOverlayList] = useState<{ chord: string; offset: number }[]>([]);
  /** Pending "add chord" controls (select a type + root offset, then click Add). */
  const [pendingChord, setPendingChord] = useState('');
  const [pendingOffset, setPendingOffset] = useState(0);
  const [secondScaleId, setSecondScaleId] = useState<string | null>(DEFAULT_SECOND_SCALE);
  const [mode, setMode] = useState<NotationMode>('tonal');
  const [markerScale, setMarkerScale] = useState(1);
  /** #1: independent label font size + halo (border) thickness multipliers. */
  const [fontSizeScale, setFontSizeScale] = useState(1);
  const [haloWidthScale, setHaloWidthScale] = useState(1);
  /** #2: user-saved scale/chord library (localStorage-backed, JSON-shareable). */
  const [userLibrary, setUserLibrary] = useState<SavedPattern[]>(() => loadUserLibrary());
  const [importMsg, setImportMsg] = useState<string | null>(null);
  /** Merge imported patterns into the library (re-id on id clash), then persist. */
  function mergeLibrary(items: SavedPattern[]) {
    if (items.length === 0) {
      setImportMsg('no valid patterns found in import');
      return;
    }
    setUserLibrary((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const add = items.map((it) =>
        existing.has(it.id) ? { ...it, id: newSavedId(it.kind) } : it,
      );
      const next = [...prev, ...add];
      persistUserLibrary(next);
      return next;
    });
    setImportMsg(`imported ${items.length} pattern${items.length === 1 ? '' : 's'} ✓`);
  }
  const [paletteId, setPaletteId] = useState('tonal-default');
  const [tab, setTab] = useState<'playground' | 'practice'>('playground');
  /** Function-based shape palette id (circles for chord tones, squares for the rest…). */
  const [functionShapeId, setFunctionShapeId] = useState('uniform-disc');
  /** #11: user-defined shape palettes + editor modal state. Selecting a custom
   * palette stores its id here with a `custom:` prefix; the resolved object is
   * passed to buildScene via `functionShapes`. */
  const [customShapePalettes, setCustomShapePalettes] = useState<FunctionShapePalette[]>(() => loadCustomShapePalettes());
  const [shapeEditorOpen, setShapeEditorOpen] = useState(false);
  const [shapeEditorTarget, setShapeEditorTarget] = useState<FunctionShapePalette | null>(null);
  const [fretWindow, setFretWindow] = useState<'0-12' | '0-15' | '0-24'>('0-12');
  /** Board view mode: global one-per-pitch-class vs box-pattern clipping. */
  const [viewMode, setViewMode] = useState<'global' | 'box'>('global');
  /** Box-pattern window: first visible fret and the number of frets it spans. */
  const [boxStart, setBoxStart] = useState(0);
  const [boxWidth, setBoxWidth] = useState(5);
  const [showChordsInScale, setShowChordsInScale] = useState(false);
  const [chordSize, setChordSize] = useState<3 | 4>(4);
  const [connectors, setConnectors] = useState(true);
  const [background, setBackground] = useState(true);
  const [effectsOn, setEffectsOn] = useState(true);
  const [allPositions, setAllPositions] = useState(false);
  const [query, setQuery] = useState('');

  const instrument = INSTRUMENTS[instrumentId] ?? listInstruments()[0]!;
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]!;

  /** #2: built-in + user-library templates merged so saved scales/chords appear
   * everywhere a template list is used (selectors, search, progressions). */
  const scaleTemplates: Template[] = useMemo(
    () => [...SCALE_TEMPLATES, ...userLibrary.filter((s) => s.kind === 'scale').map(templateFromSaved)],
    [userLibrary],
  );
  const chordTemplates: Template[] = useMemo(
    () => [...CHORD_TEMPLATES, ...userLibrary.filter((s) => s.kind === 'chord').map(templateFromSaved)],
    [userLibrary],
  );

  const selection: SelectedInfo = useMemo(() => {
    const patterns: Pattern[] = [];
    const scaleT = scaleTemplates.find((t) => t.id === scaleId);
    if (scaleT) patterns.push(rootTemplateAt(scaleT, rootIdx));
    const chordT = chordId ? chordTemplates.find((t) => t.id === chordId) : undefined;
    if (chordT) patterns.push(rootTemplateAt(chordT, rootIdx));
    const secondT = secondScaleId ? scaleTemplates.find((t) => t.id === secondScaleId) : undefined;
    if (secondT && patterns.length > 0) {
      // Second scale rooted a perfect 4th up to make overlap analysis interesting.
      patterns.push(rootTemplateAt(secondT, pcAdd(rootIdx, 5)));
    }
    return { patterns };
  }, [rootIdx, scaleId, chordId, secondScaleId, scaleTemplates, chordTemplates]);

  const searched: Pattern | undefined = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return undefined;
    // Full free-text form first: "Gb maj7#11", "A harmonic minor"...
    const parsed = parsePatternQuery(trimmed);
    if (parsed) return parsed;
    const q = trimmed.toLowerCase().replace(/\s+/g, '');
    const t =
      scaleTemplates.find((x) => x.id === q || x.name.toLowerCase().replace(/\s+/g, '') === q) ??
      chordTemplates.find((x) => x.id === q || x.name.toLowerCase().replace(/\s+/g, '') === q);
    return t ? rootTemplateAt(t, rootIdx) : undefined;
  }, [query, rootIdx, scaleTemplates, chordTemplates]);

  const overlays: Pattern[] = useMemo(() => {
    return overlayList.flatMap((o) => {
      const t = chordTemplates.find((x) => x.id === o.chord);
      if (!t) return [];
      const rooted = rootTemplateAt(t, pcAdd(rootIdx, o.offset));
      return [{ ...rooted, id: `${rooted.id}+${o.offset}` }];
    });
  }, [overlayList, rootIdx, chordTemplates]);

  const isKeyboard = instrument.layout().metric === 'semitone';
  /** Keyboard: show ~2 octaves by default (cols are semitones); guitar: chosen fret window. */
  const windowCols = isKeyboard
    ? Math.min(instrument.layout().cols - 1, 24)
    : fretWindow === '0-12'
      ? 12
      : fretWindow === '0-15'
        ? 15
        : 24;

  /** Box-pattern view: clip the board to [boxStart, boxStart + width - 1]. */
  const box = useMemo(() => {
    if (viewMode !== 'box') return undefined;
    const maxCol = Math.max(1, instrument.layout().cols - 1);
    const colStart = Math.min(Math.max(0, boxStart), maxCol);
    const colEnd = Math.min(colStart + Math.max(2, boxWidth) - 1, maxCol);
    return { colStart, colEnd };
  }, [viewMode, boxStart, boxWidth, instrument]);

  /** Selected custom palette object (undefined when a built-in id is chosen). */
  const customShapes = useMemo(
    () => (functionShapeId.startsWith('custom:') ? customShapePalettes.find((p) => p.id === functionShapeId.slice(7)) : undefined),
    [functionShapeId, customShapePalettes],
  );

  const scene = useMemo(() => {
    const patterns = searched ? [...selection.patterns, searched] : selection.patterns;
    return buildScene(instrument, {
      patterns,
      mode,
      markerScale,
      fontSizeScale,
      haloWidthScale,
      palette,
      functionShapes: customShapes,
      functionShapeId: customShapes ? undefined : functionShapeId,
      window: { colStart: 0, colEnd: windowCols },
      fretWindow: box,
      toggles: { connectors, labels: true, background, effects: effectsOn },
      showChordsInScale,
      chordSize,
      showOverlap: patterns.length >= 2,
      includeAllCandidates: allPositions,
      overlayChords: overlays,
    });
  }, [
    instrument,
    selection,
    searched,
    mode,
    palette,
    functionShapeId,
    customShapes,
    markerScale,
    fontSizeScale,
    haloWidthScale,
    windowCols,
    box,
    connectors,
    background,
    effectsOn,
    showChordsInScale,
    chordSize,
    allPositions,
    overlays,
  ]);

  const frame = useMemo(() => presenter.present(scene), [scene]);

  const primary = selection.patterns[0];
  const chordMembers = useMemo(() => {
    if (!primary || primary.kind !== 'scale') return [];
    // Diatonic 7th chords per degree come from core harmony via relation groups;
    // for the panel we just list the scale members with interval labels.
    return primary.steps.map((s, i) => ({
      label: String.fromCharCode(97 + i),
      step: s,
    }));
  }, [primary]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          MUSIC·Patterns<span className="guru">Guru</span>
        </h1>
        <span className="tagline">
          visualize scales · chords · modes · tonal relations on any instrument
        </span>
      </header>

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'playground'}
          className={tab === 'playground' ? 'tab on' : 'tab'}
          onClick={() => setTab('playground')}
        >
          Playground
        </button>
        <button
          role="tab"
          aria-selected={tab === 'practice'}
          className={tab === 'practice' ? 'tab on' : 'tab'}
          onClick={() => setTab('practice')}
        >
          Practice · Progression
        </button>
      </nav>

      {tab === 'practice' ? (
        <div className="app-main">
          <PracticeTab
            instrument={instrument}
            mode={mode}
            paletteId={paletteId}
            functionShapeId={functionShapeId}
            markerScale={markerScale}
            fontSizeScale={fontSizeScale}
            haloWidthScale={haloWidthScale}
            lists={{ scales: scaleTemplates, chords: chordTemplates }}
            connectors={connectors}
            background={background}
            effectsOn={effectsOn}
            windowCols={windowCols}
            fretWindow={box}
          />
        </div>
      ) : (
      <div className="layout">
        <aside className="controls">
          <section className="panel">
            <h2>Instrument</h2>
            <label className="field">
              Layout
              <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
                {listInstruments().map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="field">
                Root
                <select value={rootIdx} onChange={(e) => setRootIdx(Number(e.target.value))}>
                  {ROOT_NAMES.map((n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Frets
                <select
                  value={fretWindow}
                  onChange={(e) => setFretWindow(e.target.value as typeof fretWindow)}
                >
                  <option value="0-12">0 – 12</option>
                  <option value="0-15">0 – 15</option>
                  <option value="0-24">0 – 24</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>Patterns</h2>
            <label className="field">
              Primary scale / mode
              <select value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
                {scaleTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="field">
                Root chord (shares scale root)
                <select
                  value={chordId ?? ''}
                  onChange={(e) => setChordId(e.target.value || null)}
                >
                  <option value="">none</option>
                  {chordTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Compare scale
                <select
                  value={secondScaleId ?? ''}
                  onChange={(e) => setSecondScaleId(e.target.value || null)}
                >
                  <option value="">none</option>
                  {scaleTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              Quick search (template id or name, e.g. “harmonic minor”, “dorian”)
              <input
                type="text"
                placeholder="type a scale/chord name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {query && !searched && (
              <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>
                no template matches “{query}”
              </div>
            )}
            <div className="field" style={{ marginTop: 10 }}>
              <span style={{ display: 'block', marginBottom: 4 }}>Chord overlays (stack)</span>
              {/* Request #4: per-item list with individual remove + inline reconfigure. */}
              {overlayList.length === 0 && (
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>none yet</div>
              )}
              {overlayList.map((o, i) => {
                const t = chordTemplates.find((x) => x.id === o.chord);
                return (
                  <div key={i} className="overlay-row">
                    <select
                      aria-label={`overlay ${i + 1} chord`}
                      value={o.chord}
                      onChange={(e) =>
                        setOverlayList((list) =>
                          list.map((x, j) => (j === i ? { ...x, chord: e.target.value } : x)),
                        )
                      }
                    >
                      {chordTemplates.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label={`overlay ${i + 1} root offset`}
                      value={o.offset}
                      onChange={(e) =>
                        setOverlayList((list) =>
                          list.map((x, j) => (j === i ? { ...x, offset: Number(e.target.value) } : x)),
                        )
                      }
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                        <option key={n} value={n}>{n === 0 ? 'same root' : `+${n} st`}</option>
                      ))}
                    </select>
                    <span className="overlay-name">{t ? `${ROOT_NAMES[(rootIdx + o.offset) % 12]} ${t.name}` : ''}</span>
                    <button
                      className="overlay-remove"
                      onClick={() => setOverlayList((list) => list.filter((_, j) => j !== i))}
                      aria-label={`remove overlay ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <div className="overlay-add">
                <select
                  id="overlay-chord-select"
                  value={pendingChord}
                  onChange={(e) => setPendingChord(e.target.value)}
                >
                  <option value="">add chord…</option>
                  {chordTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select
                  id="overlay-offset-select"
                  value={pendingOffset}
                  onChange={(e) => setPendingOffset(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                    <option key={n} value={n}>{n === 0 ? 'same root' : `+${n} st`}</option>
                  ))}
                </select>
                <button
                  className="overlay-clear"
                  disabled={!pendingChord}
                  onClick={() => {
                    if (!pendingChord) return;
                    setOverlayList((list) => [...list, { chord: pendingChord, offset: pendingOffset }]);
                    setPendingChord('');
                  }}
                >
                  add
                </button>
              </div>
              {overlayList.length > 0 && (
                <button className="overlay-clear" onClick={() => setOverlayList([])}>clear all</button>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>Notation</h2>
            {/* Request #1: too many modes for buttons — use a dropdown. */}
            <label className="field">
              Notation mode
              <select value={mode} onChange={(e) => setMode(e.target.value as NotationMode)}>
                {NOTATION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field grow">
                Marker size <span className="mono">{markerScale.toFixed(2)}×</span>
                <input
                  id="marker-scale"
                  type="range"
                  min={0.5}
                  max={1.6}
                  step={0.01}
                  value={markerScale}
                  onInput={(e) => setMarkerScale(Number(e.currentTarget.value))}
                  onChange={(e) => setMarkerScale(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field grow">
                Label font size <span className="mono">{fontSizeScale.toFixed(2)}×</span>
                <input
                  id="font-scale"
                  type="range"
                  min={0.6}
                  max={2}
                  step={0.01}
                  value={fontSizeScale}
                  onInput={(e) => setFontSizeScale(Number(e.currentTarget.value))}
                  onChange={(e) => setFontSizeScale(Number(e.target.value))}
                />
              </label>
              <label className="field grow">
                Halo thickness <span className="mono">{haloWidthScale.toFixed(2)}×</span>
                <input
                  id="halo-scale"
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.01}
                  value={haloWidthScale}
                  onInput={(e) => setHaloWidthScale(Number(e.currentTarget.value))}
                  onChange={(e) => setHaloWidthScale(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field">
                Palette
                <select value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
                  {PALETTES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Note shape (by function)
                <select value={functionShapeId} onChange={(e) => setFunctionShapeId(e.target.value)}>
                  {FUNCTION_SHAPE_PALETTES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {customShapePalettes.length > 0 && (
                    <optgroup label="Custom">
                      {customShapePalettes.map((s) => (
                        <option key={s.id} value={`custom:${s.id}`}>{s.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="row" style={{ marginTop: 4 }}>
                  <button
                    className="btn small"
                    onClick={() => {
                      setShapeEditorTarget(customShapes ?? null);
                      setShapeEditorOpen(true);
                    }}
                    title={customShapes ? `Edit “${customShapes.name}”` : 'Create a custom degree→shape palette'}
                  >
                    {customShapes ? 'Edit selected' : 'New palette…'}
                  </button>
                  {customShapes && (
                    <button
                      className="btn small danger"
                      onClick={() => {
                        removeCustomShapePalette(customShapes.id);
                        setCustomShapePalettes(loadCustomShapePalettes());
                        setFunctionShapeId('uniform-disc');
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>My Library</h2>
            {/* #2: save/share scale+chord definitions. Generic record format — new
                fields ride along in `extra` without touching the save routine. */}
            <div className="row" style={{ marginBottom: 8 }}>
              <button
                className="btn small"
                onClick={() => {
                  const t = scaleTemplates.find((x) => x.id === scaleId);
                  if (!t) return;
                  const base = prompt('Save scale as…', `${ROOT_NAMES[rootIdx] ?? ''} ${t.name}`.trim());
                  if (!base) return;
                  const item = { ...savedFromTemplate(t, rootIdx),  id: newSavedId(t.kind), name: base };
                  const next = [...userLibrary, item];
                  setUserLibrary(next);
                  persistUserLibrary(next);
                }}
              >
                Save current scale
              </button>
              <button
                className="btn small"
                disabled={!chordId}
                onClick={() => {
                  const t = chordTemplates.find((x) => x.id === chordId);
                  if (!t) return;
                  const base = prompt('Save chord as…', `${ROOT_NAMES[rootIdx] ?? ''} ${t.name}`.trim());
                  if (!base) return;
                  const item = { ...savedFromTemplate(t, rootIdx),  id: newSavedId(t.kind), name: base };
                  const next = [...userLibrary, item];
                  setUserLibrary(next);
                  persistUserLibrary(next);
                }}
              >
                Save current chord
              </button>
            </div>
            {userLibrary.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>
                no saved scales/chords yet — save the current ones above, or import a file from a friend
              </div>
            ) : (
              <ul className="library-list">
                {userLibrary.map((s) => (
                  <li key={s.id}>
                    <span className={`kind-badge ${s.kind === 'chord' ? 'chord' : 'scale'}`}>{s.kind}</span>
                    <span className="mono">{s.steps.join(' · ')}</span>
                    <span className="grow" />
                    <button
                      className="btn small danger"
                      onClick={() => {
                        const next = userLibrary.filter((x) => x.id !== s.id);
                        setUserLibrary(next);
                        persistUserLibrary(next);
                        if (scaleId === s.id) setScaleId(DEFAULT_SCALE);
                        if (chordId === s.id) setChordId(null);
                        setSecondScaleId((v) => (v === s.id ? null : v));
                        setOverlayList((list) => list.filter((o) => o.chord !== s.id));
                      }}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button
                className="btn small"
                disabled={userLibrary.length === 0}
                onClick={() => {
                  navigator.clipboard?.writeText(exportSavedLibrary(userLibrary)).then(
                    () => setImportMsg('Library copied to clipboard ✓'),
                    () => setImportMsg('clipboard unavailable — use “Export file” instead'),
                  );
                }}
              >
                copy JSON
              </button>
              <button
                className="btn small"
                disabled={userLibrary.length === 0}
                onClick={() => {
                  const blob = new Blob([exportSavedLibrary(userLibrary)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'mpg-library.json';
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
              >
                Export file
              </button>
              <label className="btn small" style={{ cursor: 'pointer' }}>
                Import file
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const items = parseSavedLibrary(await f.text());
                      mergeLibrary(items);
                    } catch (err) {
                      setImportMsg(`import failed: ${err instanceof Error ? err.message : String(err)}`);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <details style={{ marginTop: 8 }}>
              <summary className="muted" style={{ fontSize: 12 }}>paste JSON to import</summary>
              <textarea
                rows={4}
                style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: 11 }}
                placeholder='{"format":"mpg-library","version":1,"patterns":[…]}'
                onBlur={(e) => {
                  const txt = e.target.value.trim();
                  if (!txt) return;
                  try {
                    mergeLibrary(parseSavedLibrary(txt));
                    e.target.value = '';
                  } catch (err) {
                    setImportMsg(`import failed: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}
              />
            </details>
            {importMsg && (
              <div style={{ fontSize: 12, marginTop: 6, color: '#9fd3a4' }}>{importMsg}</div>
            )}
          </section>

          <section className="panel">
            <h2>Layers &amp; Analysis</h2>
            <div className="field" style={{ marginBottom: 8 }}>
              Board view
              <div className="seg">
                <button
                  className={viewMode === 'global' ? 'on' : ''}
                  onClick={() => setViewMode('global')}
                  title="One marker per pitch class across the whole neck"
                >
                  Global
                </button>
                <button
                  className={viewMode === 'box' ? 'on' : ''}
                  onClick={() => setViewMode('box')}
                  title="Box pattern: every note on every string within a fret window"
                >
                  Box pattern
                </button>
              </div>
            </div>
            {viewMode === 'box' && (
              <div className="row" style={{ marginBottom: 8 }}>
                <label className="field">
                  From fret
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={boxStart}
                    onChange={(e) => setBoxStart(Number(e.target.value))}
                    style={{ width: 70 }}
                  />
                </label>
                <label className="field">
                  Width (frets)
                  <select value={boxWidth} onChange={(e) => setBoxWidth(Number(e.target.value))}>
                    {[4, 5, 6, 7, 8, 12].map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <div className="checks">
              <label>
                <input
                  type="checkbox"
                  checked={connectors}
                  onChange={(e) => setConnectors(e.target.checked)}
                />
                Relation connectors (blobs / hulls)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showChordsInScale}
                  onChange={(e) => setShowChordsInScale(e.target.checked)}
                />
                Diatonic chords inside scale
              </label>
              {showChordsInScale && (
                <div className="seg" style={{ marginLeft: 22 }}>
                  <button
                    className={chordSize === 3 ? 'on' : ''}
                    onClick={() => setChordSize(3)}
                  >
                    triads
                  </button>
                  <button
                    className={chordSize === 4 ? 'on' : ''}
                    onClick={() => setChordSize(4)}
                  >
                    sevenths
                  </button>
                </div>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={background}
                  onChange={(e) => setBackground(e.target.checked)}
                />
                Background positions
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={effectsOn}
                  onChange={(e) => setEffectsOn(e.target.checked)}
                />
                Root glow effect
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={allPositions}
                  onChange={(e) => setAllPositions(e.target.checked)}
                />
                Show every fingering position
              </label>
            </div>
          </section>
        </aside>

        <main className="board">
          <section className="board-card">
            <div className="caption">
              <strong>
                {instrument.name} — {frame.mode} notation
              </strong>
              <span>
                {selection.patterns.map((p) => p.name).join('  ·  ') || 'no pattern selected'}
                {searched ? `  ·  ${searched.name}` : ''}
              </span>
            </div>
            {selection.patterns.length === 0 && !searched ? (
              <div className="empty">Pick a scale to begin.</div>
            ) : (
              <FrameSvg frame={frame} />
            )}
            <div className="legend" style={{ marginTop: 10 }}>
              {Object.entries(palette.degrees)
                .slice(0, 13)
                .map(([deg, color]) => (
                  <span key={deg}>
                    <i className="swatch" style={{ background: color }} />
                    {deg}
                  </span>
                ))}
            </div>
          </section>

          {primary && (
            <section className="board-card analysis">
              <div className="caption">
                <strong>{primary.name}</strong>
                <span>{primary.comment ?? primary.tags?.join(', ') ?? ''}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>step</th>
                    <th>pc</th>
                  </tr>
                </thead>
                <tbody>
                  {chordMembers.map((m, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{m.step} st</td>
                      <td>{ROOT_NAMES[pcAdd(primary.root, m.step)]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </main>
      </div>
      )}

      <footer className="statusbar">
        <span>{frame.markers.length} markers</span>
        <span>{frame.connectors.length} relation groups</span>
        <span>layers: {frame.layers.filter((l) => l.visible).length}/{frame.layers.length}</span>
        <span>@mpg/core · @mpg/instruments · @mpg/react — prototype</span>
      </footer>

      {/* #11: custom function-shape palette editor modal */}
      <ShapePaletteEditor
        open={shapeEditorOpen}
        initial={shapeEditorTarget}
        onClose={() => setShapeEditorOpen(false)}
        onSave={(p) => {
          setCustomShapePalettes(loadCustomShapePalettes());
          setFunctionShapeId(`custom:${p.id}`);
          setShapeEditorTarget(p);
        }}
        onDelete={(id) => {
          removeCustomShapePalette(id);
          setCustomShapePalettes(loadCustomShapePalettes());
          if (functionShapeId === `custom:${id}`) setFunctionShapeId('uniform-disc');
        }}
      />
    </div>
  );
}
