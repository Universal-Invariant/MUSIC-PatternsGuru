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
  NOTATION_MODES,
  pcAdd,
  type NotationMode,
  type Pattern,
} from '@mpg/core';
import { CHORD_TEMPLATES, SCALE_TEMPLATES, rootTemplateAt } from '@mpg/core/library';
import { INSTRUMENTS, listInstruments } from '@mpg/instruments';
import { FretboardPresenter, FrameSvg, buildScene } from '@mpg/react';

const ROOT_NAMES = ['C', 'C♯/D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

// Curated defaults so the app opens on something interesting.
const DEFAULT_SCALE = 'dorian';
const DEFAULT_CHORD = 'min7';
const DEFAULT_SECOND_SCALE = 'aeolian';

const presenter = new FretboardPresenter();

interface SelectedInfo {
  readonly patterns: Pattern[];
  readonly error?: string;
}

export function App() {
  const [instrumentId, setInstrumentId] = useState<string>('guitar-standard');
  const [rootIdx, setRootIdx] = useState(2); // D
  const [scaleId, setScaleId] = useState(DEFAULT_SCALE);
  const [chordId, setChordId] = useState<string | null>(DEFAULT_CHORD);
  const [secondScaleId, setSecondScaleId] = useState<string | null>(DEFAULT_SECOND_SCALE);
  const [mode, setMode] = useState<NotationMode>('tonal');
  const [paletteId, setPaletteId] = useState('tonal-default');
  const [fretWindow, setFretWindow] = useState<'0-12' | '0-15' | '0-24'>('0-12');
  const [showChordsInScale, setShowChordsInScale] = useState(false);
  const [chordSize, setChordSize] = useState<3 | 4>(4);
  const [connectors, setConnectors] = useState(true);
  const [background, setBackground] = useState(true);
  const [effectsOn, setEffectsOn] = useState(true);
  const [allPositions, setAllPositions] = useState(false);
  const [query, setQuery] = useState('');

  const instrument = INSTRUMENTS[instrumentId] ?? listInstruments()[0]!;
  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]!;

  const selection: SelectedInfo = useMemo(() => {
    const patterns: Pattern[] = [];
    const scaleT = SCALE_TEMPLATES.find((t) => t.id === scaleId);
    if (scaleT) patterns.push(rootTemplateAt(scaleT, rootIdx));
    const chordT = chordId ? CHORD_TEMPLATES.find((t) => t.id === chordId) : undefined;
    if (chordT) patterns.push(rootTemplateAt(chordT, rootIdx));
    const secondT = secondScaleId ? SCALE_TEMPLATES.find((t) => t.id === secondScaleId) : undefined;
    if (secondT && patterns.length > 0) {
      // Second scale rooted a perfect 4th up to make overlap analysis interesting.
      patterns.push(rootTemplateAt(secondT, pcAdd(rootIdx, 5)));
    }
    return { patterns };
  }, [rootIdx, scaleId, chordId, secondScaleId]);

  const searched: Pattern | undefined = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    if (!q) return undefined;
    const t =
      SCALE_TEMPLATES.find((x) => x.id === q || x.name.toLowerCase().replace(/\s+/g, '') === q) ??
      CHORD_TEMPLATES.find((x) => x.id === q || x.name.toLowerCase().replace(/\s+/g, '') === q);
    return t ? rootTemplateAt(t, rootIdx) : undefined;
  }, [query, rootIdx]);

  const windowCols = fretWindow === '0-12' ? 12 : fretWindow === '0-15' ? 15 : 24;

  const scene = useMemo(() => {
    const patterns = searched ? [...selection.patterns, searched] : selection.patterns;
    return buildScene(instrument, {
      patterns,
      mode,
      palette,
      window: { colStart: 0, colEnd: windowCols },
      toggles: { connectors, labels: true, background, effects: effectsOn },
      showChordsInScale,
      chordSize,
      showOverlap: patterns.length >= 2,
      includeAllCandidates: allPositions,
    });
  }, [
    instrument,
    selection,
    searched,
    mode,
    palette,
    windowCols,
    connectors,
    background,
    effectsOn,
    showChordsInScale,
    chordSize,
    allPositions,
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
                {SCALE_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="field">
                Chord overlay
                <select
                  value={chordId ?? ''}
                  onChange={(e) => setChordId(e.target.value || null)}
                >
                  <option value="">none</option>
                  {CHORD_TEMPLATES.map((t) => (
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
                  {SCALE_TEMPLATES.map((t) => (
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
          </section>

          <section className="panel">
            <h2>Notation</h2>
            <div className="seg" role="radiogroup" aria-label="notation mode">
              {NOTATION_MODES.map((m) => (
                <button
                  key={m}
                  className={m === mode ? 'on' : ''}
                  onClick={() => setMode(m)}
                  title={`${m} notation`}
                >
                  {m}
                </button>
              ))}
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
            </div>
          </section>

          <section className="panel">
            <h2>Layers &amp; Analysis</h2>
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

      <footer className="statusbar">
        <span>{frame.markers.length} markers</span>
        <span>{frame.connectors.length} relation groups</span>
        <span>layers: {frame.layers.filter((l) => l.visible).length}/{frame.layers.length}</span>
        <span>@mpg/core · @mpg/instruments · @mpg/react — prototype</span>
      </footer>
    </div>
  );
}
