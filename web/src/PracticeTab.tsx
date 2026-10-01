/**
 * Practice tab — progression viewer synchronized to audio.
 *
 * The goal: improvise over a track while the fretboard shows the scale/chord
 * changes in time. A "marker" is one segment of the song: a start time plus a
 * full fretboard configuration (scale, chord, root offset, overlays). Playback
 * seeks through the markers; clicking / dragging the timeline moves the play
 * head; the table editor supports add/remove/duplicate, copy/paste, range
 * bulk-copy/bulk-paste and bulk modify so songs with 200+ changes stay easy.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PALETTES,
  pc,
  pcAdd,
  type Instrument,
  type NotationMode,
  type Pattern,
} from '@mpg/core';
import { CHORD_TEMPLATES, SCALE_TEMPLATES, rootTemplateAt } from '@mpg/core/library';
import { FretboardPresenter, FrameSvg, buildScene } from '@mpg/react';

const presenter = new FretboardPresenter();

export interface OverlaySpec {
  readonly chord: string;
  /** Semitones above the segment's own root. */
  readonly offset: number;
  /** Explicit root pitch class; when absent, derived from the scale root. */
  readonly root?: number;
}

/** One marker = one segment of the progression. Serializable (JSON-friendly). */
export interface Segment {
  readonly id: string;
  /** Seconds from the top of the track where this change takes effect. */
  readonly time: number;
  /** Optional explicit end time (s). When absent, the segment ends at the next marker. */
  readonly endTime?: number;
  readonly scaleId: string | null;
  /** Scale root as a note token (`'D'`, `'F#'`, `'Bb'`). */
  readonly root: string;
  readonly chordId: string | null;
  /** Chord root offset in semitones from the scale root (null = explicit `chordRoot`). */
  readonly chordOffset: number | null;
  readonly chordRoot?: string;
  readonly overlays: readonly OverlaySpec[];
  readonly label?: string;
}

let uidCounter = 0;
function uid(): string {
  return `seg${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;
}

const NOTE_TOKENS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

function tokenPc(token: string): number {
  const i = NOTE_TOKENS.indexOf(token);
  return i < 0 ? 0 : i;
}

function defaultSegment(time: number): Segment {
  return { id: uid(), time, scaleId: 'dorian', root: 'D', chordId: 'min7', chordOffset: 0, overlays: [] };
}

/** Build the concrete patterns for one segment (scale + base chord + overlays). */
function segmentPatterns(seg: Segment): Pattern[] {
  const rootPc = tokenPc(seg.root);
  const out: Pattern[] = [];
  if (seg.scaleId) {
    const t = SCALE_TEMPLATES.find((x) => x.id === seg.scaleId);
    if (t) out.push(rootTemplateAt(t, rootPc));
  }
  if (seg.chordId) {
    const t = CHORD_TEMPLATES.find((x) => x.id === seg.chordId);
    if (t) {
      const chordRoot = seg.chordRoot ? tokenPc(seg.chordRoot) : pcAdd(rootPc, seg.chordOffset ?? 0);
      out.push(rootTemplateAt(t, chordRoot));
    }
  }
  for (const o of seg.overlays) {
    const t = CHORD_TEMPLATES.find((x) => x.id === o.chord);
    if (!t) continue;
    const r = o.root !== undefined ? pc(o.root) : pcAdd(rootPc, o.offset);
    out.push({ ...rootTemplateAt(t, r), id: `${t.id}@${r}:ov:${seg.id}` });
  }
  return out;
}

function segmentName(seg: Segment): string {
  const parts: string[] = [];
  if (seg.scaleId) {
    const t = SCALE_TEMPLATES.find((x) => x.id === seg.scaleId);
    if (t) parts.push(`${seg.root} ${t.name}`);
  }
  if (seg.chordId) {
    const t = CHORD_TEMPLATES.find((x) => x.id === seg.chordId);
    if (t) {
      const r = seg.chordRoot ? seg.chordRoot : SHARP_NAMES[pcAdd(tokenPc(seg.root), seg.chordOffset ?? 0)];
      parts.push(`${r} ${t.name}`);
    }
  }
  return parts.join(' · ') || seg.label || '—';
}

function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

/** Parse a pasted block into segments. Tolerant: bad lines are skipped. */
function parseSegments(text: string): Segment[] {
  const out: Segment[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const sp = line.search(/\s/);
    const timeStr = sp < 0 ? line : line.slice(0, sp);
    const rest = sp < 0 ? '' : line.slice(sp + 1).trim();
    const time = Number(timeStr.replace(/,/g, ''));
    if (!Number.isFinite(time)) continue;
    // Normalize note names: accept C Db D Eb E F Gb G Ab A Bb B (+ # forms).
    let scaleId: string | null = null;
    let chordId: string | null = null;
    let root = 'C';
    const m = /^(C|C#|Db|D|D#|Eb|E|F|F#|Gb|G|G#|Ab|A|A#|Bb|B)(b|#)?(m|maj|dim|aug|sus)?\b\s*(.*)$/i.exec(rest);
    if (m) {
      const flatAlt = (m[2] ?? '').toLowerCase();
      const quality = (m[3] ?? '').toLowerCase();
      const tail = (m[4] ?? '').trim().toLowerCase();
      const pIdx = tokenPcFromName(((m[1] ?? 'C') + flatAlt).toLowerCase());
      root = NOTE_TOKENS[pc(pIdx)] ?? 'C';
      const combined = (quality + ' ' + tail).trim();
      const st =
        SCALE_TEMPLATES.find((x) => x.id === combined || x.name.toLowerCase() === combined) ??
        SCALE_TEMPLATES.find((x) => tail.startsWith(x.name.toLowerCase()) || tail === x.id);
      const ct =
        CHORD_TEMPLATES.find((x) => x.id === combined || x.name.toLowerCase() === combined) ??
        CHORD_TEMPLATES.find((x) => tail.startsWith(x.name.toLowerCase()) || tail === x.id);
      if (st && (!ct || combined.includes(st.name.toLowerCase()))) scaleId = st.id;
      else if (ct) chordId = ct.id;
      else scaleId = 'dorian';
    } else if (rest) {
      scaleId = 'dorian';
    } else {
      scaleId = 'dorian';
    }
    if (!scaleId && !chordId) scaleId = 'dorian';
    out.push({ id: uid(), time, scaleId, root, chordId, chordOffset: 0, overlays: [] });
  }
  return out;
}

function tokenPcFromName(raw: string): number {
  const name = raw.toLowerCase();
  const table: Record<string, number> = {
    c: 0, 'c#': 1, cb: 11, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, fb: 4, f: 5, 'f#': 6, gb: 6,
    g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
  };
  return table[name] ?? 0;
}

function serializeSegments(segs: readonly Segment[]): string {
  return segs.map((s) => `${s.time.toFixed(2)}\t${segmentName(s)}`).join('\n');
}

export interface PracticeSharedProps {
  instrument: Instrument;
  mode: NotationMode;
  paletteId: string;
  functionShapeId: string;
  markerScale: number;
  connectors: boolean;
  background: boolean;
  effectsOn: boolean;
  windowCols: number;
}

export function PracticeTab(props: PracticeSharedProps) {
  const [segments, setSegments] = useState<Segment[]>(() => [
    { ...defaultSegment(0) },
    { ...defaultSegment(8), root: 'G', scaleId: 'mixolydian', chordId: 'dom7' },
    { ...defaultSegment(16), root: 'A', scaleId: 'minor', chordId: 'min7' },
    { ...defaultSegment(24), scaleId: 'dorian', root: 'D', chordId: 'min7' },
  ]);
  const [selected, setSelected] = useState<Set<number>>(new Set([0]));
  const [audioName, setAudioName] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopRegion, setLoopRegion] = useState<{ start: number; end: number } | null>(null);
  const [clip, setClip] = useState<readonly Segment[]>([]);
  const [pasteCount, setPasteCount] = useState(1);
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkTranspose, setBulkTranspose] = useState(0);
  const [patternLen, setPatternLen] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  /** Timeline clip-drag state (move / resize start / resize end). */
  const tlDrag = useRef<{ mode: 'move' | 'start' | 'end'; idx: number; grabTime: number; orig: Segment } | null>(null);
  const tlMoved = useRef(false);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function onFile(f: File | undefined) {
    if (!f) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(f);
    urlRef.current = url;
    setAudioName(f.name);
    const el = audioRef.current;
    if (el) {
      el.src = url;
      el.load();
    }
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (el.paused) void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else {
      el.pause();
      setPlaying(false);
    }
  }

  function seek(t: number) {
    const el = audioRef.current;
    if (!el) return;
    const clamped = Math.max(0, duration > 0 ? Math.min(t, duration) : t);
    el.currentTime = clamped;
    setCurrentTime(clamped);
  }

  const sorted = useMemo(
    () => segments.map((s, i) => ({ s, i })).sort((a, b) => a.s.time - b.s.time),
    [segments],
  );

  const activeIdx = useMemo(() => {
    let best = -1;
    for (const { s, i } of sorted) if (s.time <= currentTime + 1e-6) best = i;
    return best;
  }, [sorted, currentTime]);

  const nextSeg = useMemo(() => {
    for (const { s } of sorted) if (s.time > currentTime + 1e-6) return s;
    return undefined;
  }, [sorted, currentTime]);

  const frameOf = (seg: Segment | undefined) => {
    const patterns = seg ? segmentPatterns(seg) : [];
    const scene = buildScene(props.instrument, {
      patterns,
      mode: props.mode,
      palette: PALETTES.find((p) => p.id === props.paletteId) ?? PALETTES[0]!,
      functionShapeId: props.functionShapeId,
      markerScale: props.markerScale,
      window: { colStart: 0, colEnd: props.windowCols },
      toggles: { connectors: props.connectors, labels: true, background: props.background, effects: props.effectsOn },
      showOverlap: patterns.length >= 2,
    });
    return presenter.present(scene);
  };

  const frame = useMemo(
    () => frameOf(activeIdx >= 0 ? segments[activeIdx] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, segments, activeIdx],
  );

  const nextFrame = useMemo(
    () => frameOf(nextSeg),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, nextSeg],
  );

  const span =
    Math.max(duration, ...segments.map((s) => s.time), ...segments.map((s) => s.endTime ?? 0), 30) * 1.05 || 30;

  function timeFromEvent(e: { clientX: number }): number {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return frac * span;
  }

  function patch(i: number, up: Partial<Segment>) {
    setSegments((list) => list.map((s, j) => (j === i ? { ...s, ...up } : s)));
  }

  function addMarkerAt(time: number) {
    setSegments((list) => {
      const src = list.length ? list[list.length - 1] : undefined;
      const seg: Segment = src
        ? { ...src, id: uid(), time, overlays: src.overlays.map((o) => ({ ...o })) }
        : defaultSegment(time);
      return [...list, seg];
    });
  }

  function removeSelected() {
    setSegments((list) => list.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  }

  function duplicateSelected() {
    setSegments((list) => {
      const copies = list
        .filter((_, i) => selected.has(i))
        .map((s) => ({ ...s, id: uid(), time: s.time + bulkStep, overlays: s.overlays.map((o) => ({ ...o })) }));
      return [...list, ...copies];
    });
  }

  function selectRow(i: number, e: React.MouseEvent) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelected((sel) => {
        const next = new Set(sel);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    } else {
      setSelected(new Set([i]));
    }
  }

  function copySelection() {
    const rows = segments.filter((_, i) => selected.has(i));
    setClip(rows.map((s) => ({ ...s, overlays: s.overlays.map((o) => ({ ...o })) })));
  }

  function pasteAfterSelection() {
    if (clip.length === 0) return;
    setSegments((list) => {
      const anchor = Math.max(-1, ...Array.from(selected.values()));
      const baseTime = anchor >= 0 ? list[anchor]!.time : 0;
      const inserted: Segment[] = [];
      for (let rep = 0; rep < pasteCount; rep++) {
        for (const c of clip) {
          inserted.push({
            ...c,
            id: uid(),
            time: baseTime + (rep * clip.length + clip.indexOf(c) + 1) * (bulkStep || 1),
            overlays: c.overlays.map((o) => ({ ...o })),
          });
        }
      }
      const out = [...list];
      out.splice(anchor + 1, 0, ...inserted);
      return out;
    });
  }

  /** Bulk modify: transpose roots and/or re-space times of the selection. */
  function applyBulk() {
    setSegments((list) => {
      const sel = Array.from(selected).sort((a, b) => a - b);
      if (sel.length === 0) return list;
      const out = [...list];
      sel.forEach((idx, k) => {
        const s = list[idx]!;
        let root = s.root;
        if (bulkTranspose !== 0) {
          const pcNew = pcAdd(tokenPc(s.root), bulkTranspose);
          root = NOTE_TOKENS[pcNew] ?? s.root;
        }
        // Re-space: uniform spacing starting at the first selected marker.
        let time = s.time;
        if (bulkStep > 0 && k > 0) {
          const first = list[sel[0]!]!;
          time = first.time + k * bulkStep;
        }
        out[idx] = { ...s, root, time };
      });
      return out;
    });
  }

  /** Repeat the last N segments across the selection ("apply pattern"). */
  function applyPatternToSelection() {
    const sel = Array.from(selected).sort((a, b) => a - b);
    if (sel.length === 0 || patternLen <= 0) return;
    setSegments((list) => {
      const out = [...list];
      const pattern = list.slice(Math.max(0, sel[0]! - patternLen), sel[0]!);
      if (pattern.length === 0) return list;
      sel.forEach((idx, k) => {
        const src = pattern[k % pattern.length]!;
        const old = list[idx]!;
        out[idx] = {
          ...src,
          id: old.id,
          time: old.time,
          overlays: src.overlays.map((o) => ({ ...o })),
        };
      });
      return out;
    });
  }

  /** Fill gaps by extending the previous segment (quick "hold until" edits). */
  function snapTimesToGrid() {
    setSegments((list) =>
      list.map((s) => ({ ...s, time: Math.round(s.time / (bulkStep || 1)) * (bulkStep || 1) })),
    );
  }

  const selectedSeg = selected.size === 1 ? segments[[...selected][0]!] : undefined;

  /* ---- timeline clip dragging ------------------------------------------- */

  function clampT(t: number): number {
    return Math.min(span, Math.max(0, t));
  }

  function beginClipDrag(e: React.PointerEvent, idx: number, mode: 'move' | 'start' | 'end') {
    e.stopPropagation();
    e.preventDefault();
    const bar = barRef.current;
    if (bar) {
      try {
        bar.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture unsupported — fine */
      }
    }
    tlDrag.current = { mode, idx, grabTime: timeFromEvent(e), orig: segments[idx]! };
    tlMoved.current = false;
    selectRow(idx, { shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey } as React.MouseEvent);
  }

  function onTimelinePointerMove(e: React.PointerEvent) {
    const d = tlDrag.current;
    if (!d) return;
    const t = clampT(timeFromEvent(e));
    const dt = t - d.grabTime;
    if (Math.abs(dt) > 0.02) tlMoved.current = true;
    setSegments((list) => {
      const out = [...list];
      const cur = list[d.idx]!;
      if (d.mode === 'move') {
        out[d.idx] = { ...cur, time: clampT(d.orig.time + dt) };
      } else if (d.mode === 'start') {
        // Dragging the left edge changes the start; keep the right edge fixed.
        const fixedEnd = cur.endTime ?? nextStartByIndex.get(d.idx) ?? span;
        const newStart = Math.min(clampT(t), fixedEnd - 0.05);
        out[d.idx] = { ...cur, time: Math.max(0, newStart) };
      } else {
        // Right-edge resize sets an explicit end time.
        out[d.idx] = { ...cur, endTime: Math.max(cur.time + 0.05, clampT(t)) };
      }
      return out;
    });
  }

  function onTimelinePointerUp(e: React.PointerEvent) {
    if (tlDrag.current) {
      const bar = barRef.current;
      if (bar) {
        try {
          bar.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      // A plain click on a clip seeks to its start (only if it wasn't a drag).
      if (!tlMoved.current && tlDrag.current.mode === 'move') seek(segments[tlDrag.current.idx]!.time);
      tlDrag.current = null;
    }
  }

  /** Effective end of a segment: explicit endTime if valid, else next marker's start. */
  function segEnd(seg: Segment, nextTime: number | undefined): number {
    const e = seg.endTime;
    if (e !== undefined && Number.isFinite(e) && e > seg.time) return e;
    if (nextTime !== undefined && nextTime > seg.time) return nextTime;
    return span;
  }

  /** Next marker's start time in sorted order (implicit end for clips without endTime). */
  const nextStartByIndex = useMemo(() => {
    const map = new Map<number, number>();
    for (let k = 0; k < sorted.length - 1; k++) map.set(sorted[k]!.i, sorted[k + 1]!.s.time);
    return map;
  }, [sorted]);

  // Shared content pieces (rendered into the stacked or side-by-side layout).
  const viewerStack = (
    <section className="panel practice-viewer">
      <div className="practice-pane pane-current">
        <div className="board-card">
          <div className="caption">
            <strong>
              {props.instrument.name} — now ({activeIdx >= 0 ? segmentName(segments[activeIdx]!) : 'no active change yet'})
            </strong>
            {nextSeg && <span>changes @ {fmtTime(nextSeg.time)}</span>}
          </div>
          <FrameSvg frame={frame} className="frame-fit" />
        </div>
      </div>
      <div className="practice-pane pane-next">
        <div className="board-card upcoming">
          <div className="caption">
            <strong>up next — prepare this shape</strong>
            <span>{nextSeg ? `${segmentName(nextSeg)} @ ${fmtTime(nextSeg.time)}` : 'nothing queued'}</span>
          </div>
          {nextSeg ? (
            <FrameSvg frame={nextFrame} className="frame-fit" />
          ) : (
            <div className="pane-empty muted">end of progression reached</div>
          )}
        </div>
      </div>
    </section>
  );

  const timelineSection = (
    <section className="panel">
      <h2>Timeline — click to seek · double-click to add a marker · drag clips to move / resize edges</h2>
          <div className="timeline-track">
            <div className="timeline-timeaxis" aria-hidden="true">
              {Array.from({ length: 7 }, (_, k) => {
                const t = (span / 6) * k;
                return (
                  <span key={k} className="tick" style={{ left: `${(t / span) * 100}%` }}>
                    {fmtTime(t)}
                  </span>
                );
              })}
            </div>
            <div
              className="timeline"
              ref={barRef}
              onPointerDown={(e) => {
                if (tlDrag.current) return;
                seek(timeFromEvent(e));
              }}
              onDoubleClick={(e) => addMarkerAt(timeFromEvent(e))}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={onTimelinePointerUp}
              onPointerCancel={onTimelinePointerUp}
            >
              {loopRegion && (
                <div
                  className="timeline-loop"
                  style={{ left: `${(loopRegion.start / span) * 100}%`, width: `${((loopRegion.end - loopRegion.start) / span) * 100}%` }}
                />
              )}
              {segments.map((s, i) => {
                const end = segEnd(s, nextStartByIndex.get(i));
                const left = Math.min(100, (s.time / span) * 100);
                const width = Math.max(0.75, ((end - s.time) / span) * 100);
                const cls = ['tl-clip', i === activeIdx ? 'active' : '', selected.has(i) ? 'sel' : ''].filter(Boolean).join(' ');
                return (
                  <div
                    key={s.id}
                    className={cls}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${fmtTime(s.time)} – ${fmtTime(end)} · ${segmentName(s)} (drag: move · edges: resize)`}
                    onPointerDown={(e) => beginClipDrag(e, i, 'move')}
                  >
                    <span
                      className="tl-handle tl-handle-start"
                      title="drag: change start time"
                      onPointerDown={(e) => beginClipDrag(e, i, 'start')}
                    />
                    <span className="tl-clip-label">{SHARP_NAMES[tokenPc(s.root)] ?? s.root}</span>
                    <span
                      className="tl-handle tl-handle-end"
                      title={s.endTime !== undefined ? 'drag: change end time · dbl-click clears explicit end' : 'drag: set end time'}
                      onPointerDown={(e) => beginClipDrag(e, i, 'end')}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        patch(i, { endTime: undefined });
                      }}
                    />
                  </div>
                );
              })}
              <div className="timeline-playhead" style={{ left: `${Math.min(100, (currentTime / span) * 100)}%` }} />
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Active: {activeIdx >= 0 ? `${segmentName(segments[activeIdx]!)} (${fmtTime(segments[activeIdx]!.time)})` : 'none yet'}
            {nextSeg ? ` → next @ ${fmtTime(nextSeg.time)}: ${segmentName(nextSeg)}` : ''}
      </div>
    </section>
  );

  const trackPanel = (
    <section className="panel">
      <h2>Track</h2>
      <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input type="file" accept="audio/*" onChange={(e) => onFile(e.target.files?.[0])} />
        <button onClick={togglePlay} disabled={!audioName}>
          {playing ? '⏸ pause' : '▶ play'}
        </button>
        <span className="mono">
          {fmtTime(currentTime)} / {duration ? fmtTime(duration) : '--:--'}
        </span>
        {nextSeg && (
          <span className="muted">next @ {fmtTime(nextSeg.time)}: {segmentName(nextSeg)}</span>
        )}
        <button
          onClick={() =>
            setLoopRegion(loopRegion ? null : { start: currentTime, end: currentTime + 8 })
          }
          disabled={!audioName}
          title="Toggle looping around the play head"
        >
          {loopRegion ? 'loop: on' : 'loop: off'}
        </button>
      </div>
      {audioName && <div className="muted" style={{ fontSize: 12 }}>{audioName}</div>}
    </section>
  );

  const editorSection = (
    <section className="panel">
      <h2>Progression editor ({segments.length} changes)</h2>
        <div className="row prog-toolbar" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button onClick={() => addMarkerAt(currentTime)}>+ marker @ play head</button>
          <button onClick={duplicateSelected} disabled={!selected.size}>duplicate</button>
          <button onClick={removeSelected} disabled={!selected.size}>remove selected</button>
          <button onClick={copySelection} disabled={!selected.size}>copy</button>
          <button onClick={pasteAfterSelection} disabled={!clip.length}>
            paste ×{pasteCount} after selection
          </button>
          <label className="mini-field">
            paste reps
            <input type="number" min={1} max={64} value={pasteCount} onChange={(e) => setPasteCount(Number(e.target.value) || 1)} />
          </label>
          <button onClick={applyBulk} disabled={!selected.size}>
            bulk: transpose {bulkStep > 0 ? '+ respace' : ''}
          </button>
          <label className="mini-field">
            transpose (st)
            <input type="number" min={-11} max={11} value={bulkTranspose} onChange={(e) => setBulkTranspose(Number(e.target.value) || 0)} />
          </label>
          <label className="mini-field">
            step (s)
            <input type="number" min={0} max={64} step={0.5} value={bulkStep} onChange={(e) => setBulkStep(Number(e.target.value) || 0)} />
          </label>
          <button onClick={applyPatternToSelection} disabled={!selected.size}>
            apply pattern of last {patternLen}
          </button>
          <label className="mini-field">
            pattern len
            <input type="number" min={1} max={32} value={patternLen} onChange={(e) => setPatternLen(Number(e.target.value) || 1)} />
          </label>
          <button onClick={snapTimesToGrid} disabled={!bulkStep}>snap times</button>
          <button
            onClick={() => {
              const n = Number(prompt('Repeat the whole progression N more times?', '1'));
              if (!Number.isFinite(n) || n <= 0) return;
              setSegments((list) => {
                const out = [...list];
                const maxT = Math.max(...list.map((s) => s.time), 1);
                for (let r = 0; r < n; r++) {
                  for (const s of list) {
                    out.push({ ...s, id: uid(), time: s.time + (r + 1) * (maxT + (bulkStep || 1)), overlays: s.overlays.map((o) => ({ ...o })) });
                  }
                }
                return out;
              });
            }}
          >
            repeat all ×N
          </button>
          <textarea
            className="prog-io"
            rows={3}
            placeholder={'paste lines like:\n0\tD dorian\n8\tG mixolydian\n…or export the grid here'}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) return;
              const parsed = parseSegments(v);
              if (parsed.length) {
                setSegments(parsed);
                setSelected(new Set(parsed.map((_, i) => i).slice(0, 1)));
              }
            }}
            onFocus={(e) => {
              e.target.value = serializeSegments(segments);
            }}
          />
        </div>

        <div className="prog-grid-wrap">
          <table className="prog-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>time (s)</th>
                <th>root</th>
                <th>scale</th>
                <th>chord</th>
                <th>off</th>
                <th>overlays</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s, i) => (
                <tr
                  key={s.id}
                  className={`${i === activeIdx ? 'is-active' : ''} ${selected.has(i) ? 'is-sel' : ''}`}
                  onMouseDown={(e) => selectRow(i, e)}
                >
                  <td>{i + 1}</td>
                  <td>
                    <input
                      type="number"
                      step={0.1}
                      value={s.time}
                      onChange={(e) => patch(i, { time: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <select value={s.root} onChange={(e) => patch(i, { root: e.target.value })}>
                      {NOTE_TOKENS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={s.scaleId ?? ''} onChange={(e) => patch(i, { scaleId: e.target.value || null })}>
                      <option value="">none</option>
                      {SCALE_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={s.chordId ?? ''} onChange={(e) => patch(i, { chordId: e.target.value || null })}>
                      <option value="">none</option>
                      {CHORD_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={s.chordOffset ?? 0}
                      onChange={(e) => patch(i, { chordOffset: Number(e.target.value) })}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                        <option key={n} value={n}>{n === 0 ? '=' : `+${n}`}</option>
                      ))}
                    </select>
                  </td>
                  <td className="mono">{s.overlays.map((o) => SHARP_NAMES[pcAdd(tokenPc(s.root), o.offset)] ?? '?').join(' ')}</td>
                  <td>
                    <button className="overlay-remove" aria-label={`remove row ${i + 1}`} onClick={() => setSegments((l) => l.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedSeg && (
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
            <span className="muted">Overlays for #{[...selected][0]! + 1}:</span>
            {selectedSeg.overlays.map((o, oi) => (
              <span key={oi} className="chip">
                <select
                  value={o.chord}
                  onChange={(e) =>
                    patch([...selected][0]!, {
                      overlays: selectedSeg.overlays.map((x, j) => (j === oi ? { ...x, chord: e.target.value } : x)),
                    })
                  }
                >
                  {CHORD_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select
                  value={o.offset}
                  onChange={(e) =>
                    patch([...selected][0]!, {
                      overlays: selectedSeg.overlays.map((x, j) => (j === oi ? { ...x, offset: Number(e.target.value) } : x)),
                    })
                  }
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                    <option key={n} value={n}>{n === 0 ? 'same root' : `+${n} st`}</option>
                  ))}
                </select>
                <button
                  className="overlay-remove"
                  aria-label="remove overlay"
                  onClick={() =>
                    patch([...selected][0]!, { overlays: selectedSeg.overlays.filter((_, j) => j !== oi) })
                  }
                >
                  ×
                </button>
              </span>
            ))}
            <button
              onClick={() => {
                const first = CHORD_TEMPLATES[0]!;
                patch([...selected][0]!, { overlays: [...selectedSeg.overlays, { chord: first.id, offset: 0 }] });
              }}
            >
              + overlay
            </button>
          </div>
        )}
    </section>
  );

  return (
    <div className="practice practice-layout">
      <audio
        ref={audioRef}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (loopRegion && el.currentTime > loopRegion.end) el.currentTime = loopRegion.start;
          setCurrentTime(el.currentTime);
        }}
        onEnded={() => setPlaying(false)}
      />

      {/* Top row: track controls (left, narrow) + now/up-next viewers (right, full width). */}
      <aside className="controls practice-controls">{trackPanel}</aside>
      <div className="practice-right">{viewerStack}</div>

      {/* Bottom row: arrange-view timeline spanning the full width. */}
      <div className="practice-timeline-row">{timelineSection}</div>

      {/* Progression editor spans the full width below the timeline. */}
      <div className="practice-editor-row">{editorSection}</div>
    </div>
  );
}
