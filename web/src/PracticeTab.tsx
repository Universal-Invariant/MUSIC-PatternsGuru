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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PALETTES,
  pc,
  pcAdd,
  type Instrument,
  type NotationMode,
  type Pattern,
} from '@mpg/core';
import { CHORD_TEMPLATES, SCALE_TEMPLATES, rootTemplateAt, type Template } from '@mpg/core/library';
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
  const lbl = seg.label ? (parts.length ? ` (${seg.label})` : seg.label) : '';
  return parts.join(' · ') + lbl || '—';
}

function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

/* ---- text-grid parsing ---------------------------------------------------- */

const NOTE_RE = '(?:Cb|C#|Db|D#|Eb|E#|Fb|F#|Gb|G#|Ab|A#|Bb|B#|[A-Ga-g][b#]?)';

interface ParsedEvent {
  time: number;
  root: string;
  scaleId: string | null;
  chordId: string | null;
  chordOffset: number | null;
  label?: string;
}

function tokenPcFromName(raw: string): number {
  const name = raw.toLowerCase();
  const table: Record<string, number> = {
    c: 0, 'c#': 1, cb: 11, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, fb: 4, f: 5, 'f#': 6, gb: 6,
    g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
  };
  return table[name] ?? 0;
}

/** Seconds from `bar:beat` plus bpm, or plain seconds if the field isn't bar-based. */
export function parseTimeField(field: string, bpm: number, beatsPerBar = 4): number | null {
  const f = field.trim();
  // Only treat fields containing ':' as bar-based; bare integers are seconds.
  const barBeat = /^(\d+):(\d+)$/.exec(f);
  if (barBeat && bpm > 0) {
    const bar = Math.max(1, Number(barBeat[1]));
    const beat = Math.max(1, Number(barBeat[2]));
    return ((bar - 1) * beatsPerBar + (beat - 1)) * (60 / bpm);
  }
  const n = Number(f.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

interface TemplateMatch {
  scaleId: string | null;
  chordId: string | null;
  /** True when the tail actually named a known scale/chord (not free text). */
  matched: boolean;
}

export function matchTemplate(tail: string): TemplateMatch {
  const t = tail.trim().toLowerCase();
  if (!t) return { scaleId: null, chordId: null, matched: false };
  const st =
    SCALE_TEMPLATES.find((x) => x.id === t || x.name.toLowerCase() === t) ??
    SCALE_TEMPLATES.find(
      (x) => x.name.toLowerCase() !== t && t.startsWith(`${x.name.toLowerCase()} `),
    );
  const ct =
    CHORD_TEMPLATES.find((x) => x.id === t || x.name.toLowerCase() === t) ??
    // Prefer the longest matching chord name: "minor seventh" must win over
    // "minor" so symbols like Am7 don't collapse to a minor triad.
    [...CHORD_TEMPLATES]
      .filter((x) => x.name.toLowerCase() !== t && t.startsWith(`${x.name.toLowerCase()} `))
      .sort((a, b) => b.name.length - a.name.length)[0];
  // When the whole tail names both a scale and a chord ("D dorian minor seventh"),
  // keep both so ∩ intersection semantics survive round-trips.
  if (st && ct) return { scaleId: st.id, chordId: ct.id, matched: true };
  if (st && !ct) return { scaleId: st.id, chordId: null, matched: true };
  if (ct && !st) return { scaleId: null, chordId: ct.id, matched: true };
  return { scaleId: null, chordId: null, matched: false };
}

/**
 * Interpret a suffix after a root note inside an event description. Handles
 * shorthand chord symbols (m7, maj7, dom7, dim, sus4, aug …) as well as full
 * template names ("minor seventh"). Returns null when nothing matches.
 */
function matchChordSymbol(suffix: string): { chordId: string; qualityOffset: number } | null {
  const s = suffix.trim().toLowerCase();
  if (!s) return null;
  // Shorthand symbol grammar → real template ids from the core library.
  const table: Array<[RegExp, string]> = [
    [/^maj(7|or)?$/, 'maj7'],
    [/^(dom7|dominant7?)$/, 'dom7'],
    [/^(min7|m7)$/, 'min7'],
    [/^min(or)?$/, 'min'],
    [/^m$/, 'min'],
    [/^ø7?|^m7b5$/, 'm7b5'],
    [/^dim7$/, 'dim7'],
    [/^dim(7)?$|^o$/, 'dim'],
    [/^(aug|\+)$/, 'aug'],
    [/^sus4$/, 'sus4'],
    [/^sus2$/, 'sus2'],
    [/^7sus4$/, '7sus4'],
    [/^7$/, 'dom7'],
    [/^m6$/, 'm6'],
    [/^6$/, 'maj'], // plain "6" → major triad family fallback
    [/^9$/, 'dom9'],
    [/^maj9$/, 'maj9'],
    [/^(min9|m9)$/, 'min9'],
    [/^add9$/, 'add9'],
    [/^(madd9|m\(add9\))$/, 'madd9'],
    [/^5$/, 'power'],
  ];
  for (const [re, id] of table) {
    if (re.test(s) && CHORD_TEMPLATES.some((x) => x.id === id)) return { chordId: id, qualityOffset: 0 };
  }
  // Full template name/id/alias last ("Minor Seventh", "dom7", …).
  const named = CHORD_TEMPLATES.find(
    (x) => x.id === s || x.name.toLowerCase() === s || x.aliases.includes(s),
  );
  if (named) return { chordId: named.id, qualityOffset: 0 };
  return null;
}

/** Chord root offset (from scale root) implied by a template's third degree. */
export function defaultChordOffset(t: Template): number {
  for (const d of t.degrees) {
    const label = Array.isArray(d) ? d[1] : d;
    const semis = Array.isArray(d) ? d[0] : undefined;
    if (label === '3') return pc(semis ?? 4);
    if (label === 'b3') return pc(semis ?? 3);
  }
  return 0;
}

/**
 * Parse one event description after the time column. Accepts:
 *   "D dorian"          → scale
 *   "G7" / "G dom7"     → chord
 *   "Dm7 | G mixolydian"→ chord + scale in one segment
 *   "Am7 Bm7"           → first is the base chord, rest become overlays
 */
function parseEventDesc(desc: string, fallbackRoot: string): ParsedEvent[] {
  const chunks = desc
    .split(/[|,]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const events: ParsedEvent[] = [];
  for (const chunk of chunks) {
    const m = new RegExp(`^(${NOTE_RE})\\s*(.*)$`, 'i').exec(chunk);
    if (!m) {
      events.push({ time: 0, root: fallbackRoot, scaleId: 'dorian', chordId: null, chordOffset: 0, label: chunk });
      continue;
    }
    const root = NOTE_TOKENS[pc(tokenPcFromName(m[1]!))] ?? 'C';
    const rest = (m[2] ?? '').trim();
    if (!rest) {
      events.push({ time: 0, root, scaleId: 'dorian', chordId: null, chordOffset: 0 });
      continue;
    }
    // 1) Shorthand chord symbol glued to the root: "m7", "maj7", "dim", …
    const sym = matchChordSymbol(rest);
    if (sym) {
      events.push({
        time: 0,
        root,
        scaleId: null,
        chordId: sym.chordId,
        chordOffset: sym.qualityOffset,
      });
      continue;
    }
    // Split trailing tokens: greedy longest template match per space-separated word group.
    const words = rest.split(/\s+/);
    let matched = matchTemplate(words.join(' '));
    let consumed = words.length;
    if (!matched.matched) {
      for (let k = words.length - 1; k >= 1; k--) {
        matched = matchTemplate(words.slice(0, k).join(' '));
        if (matched.matched) {
          consumed = k;
          break;
        }
      }
    }
    // #2: if nothing matched a known template, keep ALL the words as the
    // display label and leave scale/chord unset — no silent dorian fallback.
    if (!matched.matched) {
      matched = { scaleId: null, chordId: null, matched: false };
      consumed = 0; // all words stay in the label
    }
    events.push({
      time: 0,
      root,
      scaleId: matched.scaleId,
      chordId: matched.chordId,
      chordOffset: 0,
      label: words.slice(consumed).join(' ') || undefined,
    });
  }
  return events;
}

/** Parse a pasted block into segments. Tolerant: bad lines are skipped. */
export function parseSegments(text: string, bpm = 0): Segment[] {
  const out: Segment[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^\[/.test(line)) continue; // skip section headers like "[verse]"
    const parts = /\t/.test(line) ? line.split(/\t+/) : line.split(/\s+/);
    const timeStr = parts[0]!.trim();
    const rest = parts.slice(1).join(' ').trim();
    const time = parseTimeField(timeStr, bpm);
    if (time === null) continue;
    const evts = parseEventDesc(rest || 'D dorian', 'D');
    let pendingOverlays: OverlaySpec[] = [];
    for (const e of evts) {
      const seg: Segment = {
        id: uid(),
        time,
        scaleId: e.scaleId,
        root: e.root,
        chordId: e.chordId,
        chordOffset: 0,
        overlays: pendingOverlays,
        label: e.label,
      };
      pendingOverlays = [];
      out.push(seg);
    }
  }
  return out;
}

/**
 * Parse a chord-prose style block where each non-blank line is one change and
 * blank lines separate sections that repeat with `reps` copies at `spacing`
 * seconds apart. Example:
 *   Am7
 *   D7
 *
 *   Gmaj7
 */
export function parseChordProse(text: string, spacing: number, reps: number): Segment[] {
  const blocks: ParsedEvent[][] = [[]];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (blocks[blocks.length - 1]!.length) blocks.push([]);
      continue;
    }
    blocks[blocks.length - 1]!.push(...parseEventDesc(line, 'C'));
  }
  const out: Segment[] = [];
  let t = 0;
  for (let rep = 0; rep < Math.max(1, reps); rep++) {
    for (const block of blocks) {
      for (const e of block) {
        out.push({
          id: uid(),
          time: t,
          scaleId: e.scaleId,
          root: e.root,
          chordId: e.chordId,
          chordOffset: 0,
          overlays: [],
          label: e.label,
        });
        t += spacing;
      }
    }
  }
  return out;
}

export function serializeSegments(segs: readonly Segment[]): string {
  return segs.map((s) => `${s.time.toFixed(2)}\t${segmentName(s)}`).join('\n');
}

/* ---- persistence (#8): localStorage autosave + JSON export/import --------- */

const STORAGE_KEY = 'mpg-practice-v1';

interface PracticeSnapshot {
  segments: Segment[];
  bpm: number;
  loopRegion: { start: number; end: number } | null;
}

export function sanitizeSegment(raw: unknown): Segment | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const time = Number(r.time);
  if (!Number.isFinite(time)) return null;
  const root = typeof r.root === 'string' && NOTE_TOKENS.includes(r.root) ? r.root : 'C';
  const scaleId = typeof r.scaleId === 'string' ? r.scaleId : null;
  const chordId = typeof r.chordId === 'string' ? r.chordId : null;
  const overlays = Array.isArray(r.overlays)
    ? (r.overlays as unknown[])
        .map((o) => {
          if (!o || typeof o !== 'object') return null;
          const x = o as Record<string, unknown>;
          const chord = typeof x.chord === 'string' ? x.chord : null;
          const offset = Number(x.offset);
          if (!chord || !Number.isFinite(offset)) return null;
          const explicitRoot = Number(x.root);
          return Number.isFinite(explicitRoot) ? { chord, offset, root: explicitRoot } : { chord, offset };
        })
        .filter((o): o is OverlaySpec => o !== null)
    : [];
  const endTime = Number(r.endTime);
  // #2: free-text labels survive sanitization; unknown template ids are
  // dropped to null so the UI can flag them instead of rendering nothing.
  const labelOk = typeof r.label === 'string' && r.label.trim() ? r.label.trim() : undefined;
  return {
    id: typeof r.id === 'string' ? r.id : uid(),
    time,
    ...(Number.isFinite(endTime) && endTime > time ? { endTime } : {}),
    scaleId: scaleId && SCALE_TEMPLATES.some((t) => t.id === scaleId) ? scaleId : null,
    root,
    chordId: chordId && CHORD_TEMPLATES.some((t) => t.id === chordId) ? chordId : null,
    chordOffset: Number.isFinite(Number(r.chordOffset)) ? Number(r.chordOffset) : 0,
    overlays,
    ...(labelOk ? { label: labelOk } : {}),
  };
}

function sanitizeSnapshot(raw: unknown): PracticeSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.segments)) return null;
  const segments = r.segments.map(sanitizeSegment).filter((s): s is Segment => s !== null);
  if (segments.length === 0) return null;
  const bpm = Number(r.bpm);
  const loop = r.loopRegion as Record<string, unknown> | null | undefined;
  const loopRegion =
    loop && typeof loop === 'object' && Number.isFinite(Number(loop.start)) && Number.isFinite(Number(loop.end)) && Number(loop.end) > Number(loop.start)
      ? { start: Number(loop.start), end: Number(loop.end) }
      : null;
  return { segments, bpm: Number.isFinite(bpm) && bpm >= 0 ? bpm : 0, loopRegion };
}

function loadSnapshot(): PracticeSnapshot | null {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (!txt) return null;
    return sanitizeSnapshot(JSON.parse(txt));
  } catch {
    return null;
  }
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
  /** Box-pattern view (Playground "Box pattern" mode); undefined = global view. */
  fretWindow?: { colStart: number; colEnd: number };
}

export function PracticeTab(props: PracticeSharedProps) {
  const saved = useMemo(loadSnapshot, []);
  const [segments, setSegments] = useState<Segment[]>(
    () => saved?.segments ?? [
      { ...defaultSegment(0) },
      { ...defaultSegment(8), root: 'G', scaleId: 'mixolydian', chordId: 'dom7' },
      { ...defaultSegment(16), root: 'A', scaleId: 'minor', chordId: 'min7' },
      { ...defaultSegment(24), scaleId: 'dorian', root: 'D', chordId: 'min7' },
    ],
  );
  const [bpm, setBpm] = useState(() => saved?.bpm ?? 0);
  const [proseSpacing, setProseSpacing] = useState(2);
  const [proseReps, setProseReps] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set([0]));
  const [audioName, setAudioName] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopRegion, setLoopRegion] = useState<{ start: number; end: number } | null>(saved?.loopRegion ?? null);
  const [clip, setClip] = useState<readonly Segment[]>([]);
  const [pasteCount, setPasteCount] = useState(1);
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkTranspose, setBulkTranspose] = useState(0);
  const [patternLen, setPatternLen] = useState(1);

  /* ---- horizontal timeline zoom ------------------------------------------ */
  /** Zoom factor: 1 = whole track fits the panel; >1 widens the content and
   * activates horizontal scrolling so thin/adjacent clips stay editable. */
  const [zoom, setZoomRaw] = useState(1);
  const setZoom = (z: number) => setZoomRaw(Math.min(64, Math.max(1, z)));
  const [followPlayhead, setFollowPlayhead] = useState(false);
  const zoomRef = useRef<HTMLDivElement | null>(null);
  const fitSpanRef = useRef<HTMLDivElement | null>(null);

  /** Undo / redo history stacks (#10). */
  const undoStack = useRef<Segment[][]>([]);
  const redoStack = useRef<Segment[][]>([]);
  const [, setHistTick] = useState(0); // re-render so button disabled states refresh
  const lastSegsRef = useRef<Segment[]>(segments);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  /** Latest loop region, readable from the rAF callback without re-subscribing. */
  const loopRef = useRef<{ start: number; end: number } | null>(null);
  loopRef.current = loopRegion;

  /** Timeline clip-drag state (move / resize start / resize end). */
  const tlDrag = useRef<{ mode: 'move' | 'start' | 'end'; idx: number; grabTime: number; orig: Segment } | null>(null);
  const tlMoved = useRef(false);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  /**
   * Undo/redo-aware segment setter (#10). All mutation paths go through this:
   * the previous list is pushed onto the undo stack (coalesced within 700 ms so
   * typing/dragging doesn't flood history), and the redo stack is cleared.
   */
  function commitSegs(updater: Segment[] | ((list: Segment[]) => Segment[])) {
    const prev = lastSegsRef.current;
    setSegments((list) => {
      const next = typeof updater === 'function' ? updater(list) : updater;
      if (next === list) return list;
      // Coalesce consecutive edits that only touch the same segment (dragging,
      // typing in a cell) into one undo step by comparing ids, not timestamps.
      const sameShape =
        prev.length === list.length &&
        prev.every((s, i) => s.id === list[i]!.id);
      if (!(sameShape && lastCoalesced.current)) undoStack.current.push(prev);
      lastCoalesced.current = sameShape;
      if (undoStack.current.length > 200) undoStack.current.shift();
      redoStack.current = [];
      lastSegsRef.current = next;
      setHistTick((t) => t + 1);
      return next;
    });
  }
  /** True while a run of same-row edits is being coalesced into one undo step. */
  const lastCoalesced = useRef(false);

  function undo() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    lastCoalesced.current = false;
    redoStack.current.push(lastSegsRef.current);
    lastSegsRef.current = prev;
    setSegments(prev);
    setSelected(new Set());
    setHistTick((t) => t + 1);
  }

  function redo() {
    const nxt = redoStack.current.pop();
    if (!nxt) return;
    lastCoalesced.current = false;
    undoStack.current.push(lastSegsRef.current);
    lastSegsRef.current = nxt;
    setSegments(nxt);
    setSelected(new Set());
    setHistTick((t) => t + 1);
  }

  // Keyboard shortcuts (#14): space = play/pause, arrows nudge selection/time, ctrl+z/y = undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.size) {
          e.preventDefault();
          removeSelected();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (segments.length) {
          e.preventDefault();
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          setSelected((sel) => {
            const cur = sel.size ? Math.max(...Array.from(sel)) : -dir;
            const i = Math.min(segments.length - 1, Math.max(0, cur + dir));
            return new Set([i]);
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, segments, playing]);

  /** Autosave progression to localStorage (debounced) — survives reloads (#8). */
  useEffect(() => {
    const h = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ segments, bpm, loopRegion }));
      } catch {
        /* storage full / unavailable — ignore */
      }
    }, 400);
    return () => window.clearTimeout(h);
  }, [segments, bpm, loopRegion]);

  /**
   * Smooth play-head clock. `timeupdate` only fires ~4×/s which makes the
   * playhead, active-change detection and viewer switches stutter; instead we
   * poll `audio.currentTime` with requestAnimationFrame while playing (#5).
   */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) {
        const loop = loopRef.current;
        if (loop && el.currentTime > loop.end) el.currentTime = loop.start;
        setCurrentTime(el.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

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
      captureDuration(el); // #4: duration may still be NaN for blob URLs — retry on loadedmetadata
    }
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el || !el.src) return;
    if (el.paused) {
      void el
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  /** Duration can be NaN/0 until metadata has loaded — retry on 'loadedmetadata'. */
  const captureDuration = useCallback((el: HTMLAudioElement) => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
      return;
    }
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    };
    el.addEventListener('loadedmetadata', onMeta, { once: true });
  }, []);

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
      // The fretboard itself always shows the full display range (never cropped
      // by the box); `fretWindow` only clips which *notes* are drawn.
      window: { colStart: 0, colEnd: props.windowCols },
      fretWindow: props.fretWindow,
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

  /** Visible (un-zoomed) width of the timeline — used for "fit" zoom. */
  function visibleSpan(): number {
    return fitSpanRef.current?.clientWidth || barRef.current?.clientWidth || 1;
  }

  /** Seconds per CSS pixel at the current zoom (the inverse of px-per-second). */
  const secPerPx = span / (visibleSpan() * zoom);

  /** Map a pointer event to track time. Uses the *visible* (scroll container)
   * rect plus the current scrollLeft — the content rect alone would be wrong
   * while zoomed because its left edge can be scrolled off-screen. */
  function timeFromEvent(e: { clientX: number }): number {
    const host = fitSpanRef.current ?? barRef.current;
    if (!host) return 0;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    // The scroll container's `scrollWidth` equals the full zoomed content
    // width in CSS pixels, so px-per-second is exact at any zoom level:
    // fraction across the visible viewport × visible seconds + scrolled-past
    // seconds (derived from scrollLeft measured against the same widths).
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const visibleSeconds = span / zoom;
    const scrolledRatio = host.scrollWidth > 0 ? host.scrollLeft / host.scrollWidth : 0;
    const scrolledSeconds = scrolledRatio * span;
    return clampSpan(frac * visibleSeconds + scrolledSeconds);
  }

  function clampSpan(t: number): number {
    return Math.min(span, Math.max(0, t));
  }

  /** Keep the playhead in view while playing/seeking when zoomed in. */
  useEffect(() => {
    if (!followPlayhead || !playing) return;
    const el = zoomRef.current;
    if (!el) return;
    const x = currentTime * (zoom / secPerPx);
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 48) {
      el.scrollLeft = Math.max(0, x - el.clientWidth / 3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, playing, followPlayhead, zoom, secPerPx]);

  /** Wheel over the timeline: ctrl/⌘+wheel or shift+wheel zooms horizontally,
   * keeping the time under the cursor fixed; plain wheel scrolls normally. */
  function onTimelineWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
    e.preventDefault();
    const el = zoomRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchorT = Math.min(span, Math.max(0, ((e.clientX - rect.left + el.scrollLeft) / zoom) * secPerPx));
    const factor = Math.exp(-e.deltaY * 0.0015);
    const nextZoom = Math.min(64, Math.max(1, zoom * factor));
    setZoomRaw(nextZoom);
    // Restore scroll so the anchor time stays under the cursor after re-render.
    requestAnimationFrame(() => {
      const el2 = zoomRef.current;
      if (el2) el2.scrollLeft = (anchorT / secPerPx) * nextZoom - (e.clientX - rect.left);
    });
  }

  /** Fit the whole track into the panel (zoom = 1×). */
  function fitTimeline() {
    setZoomRaw(1);
    if (zoomRef.current) zoomRef.current.scrollLeft = 0;
  }

  /** Follow the playhead while playing (only meaningful when zoomed in). */
  function toggleFollow() {
    const el = zoomRef.current;
    if (!el) return;
    if (followPlayhead) {
      setFollowPlayhead(false);
      return;
    }
    setFollowPlayhead(true);
    el.scrollLeft = Math.max(0, currentTime * (zoom / secPerPx) - el.clientWidth / 3);
  }

  function patch(i: number, up: Partial<Segment>) {
    commitSegs((list) => list.map((s, j) => (j === i ? { ...s, ...up } : s)));
    setSelected((sel) => (sel.has(i) ? sel : new Set([i])));
  }

  function addMarkerAt(time: number) {
    lastCoalesced.current = false;
    commitSegs((list) => {
      const src = list.length ? list[list.length - 1] : undefined;
      const seg: Segment = src
        ? { ...src, id: uid(), time, overlays: src.overlays.map((o) => ({ ...o })) }
        : defaultSegment(time);
      return [...list, seg];
    });
  }

  /** Remove by stable id (never positional) so stale index sets can't delete the wrong row (#6). */
  function removeById(id: string) {
    lastCoalesced.current = false;
    commitSegs((list) => list.filter((s) => s.id !== id));
  }

  function removeSelected() {
    lastCoalesced.current = false;
    const ids = new Set(segments.filter((_, i) => selected.has(i)).map((s) => s.id));
    commitSegs((list) => list.filter((s) => !ids.has(s.id)));
    setSelected(new Set());
  }

  function duplicateSelected() {
    lastCoalesced.current = false;
    commitSegs((list) => {
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
    lastCoalesced.current = false;
    if (clip.length === 0) return;
    commitSegs((list) => {
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
    lastCoalesced.current = false;
    commitSegs((list) => {
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
    commitSegs((list) => {
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
    commitSegs((list) =>
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
    commitSegs((list) => {
      const out = [...list];
      // All math derives from d.orig (the pre-drag snapshot) so repeated move
      // events can't compound/drift against the already-updated live row.
      if (d.mode === 'move') {
        out[d.idx] = { ...d.orig, time: clampT(d.orig.time + dt) };
      } else if (d.mode === 'start') {
        // Dragging the left edge changes the start; keep the right edge fixed.
        const fixedEnd = d.orig.endTime ?? nextStartByIndex.get(d.idx) ?? span;
        const newStart = Math.min(clampT(t), fixedEnd - 0.05);
        out[d.idx] = { ...d.orig, time: Math.max(0, newStart) };
      } else {
        // Right-edge resize sets an explicit end time.
        out[d.idx] = { ...d.orig, endTime: Math.max(d.orig.time + 0.05, clampT(t)) };
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
      const d = tlDrag.current;
      // A plain click on a clip seeks to its start (only if it wasn't a drag).
      if (!tlMoved.current && d.mode === 'move') seek(segments[d.idx]!.time);
      // Snap the final position/end to the editor's step grid (#1).
      const step = bulkStep > 0 ? bulkStep : 0;
      if (step > 0) {
        commitSegs((list) => {
          const cur = list[d.idx];
          if (!cur) return list;
          const snapped = Math.round(cur.time / step) * step;
          let next = { ...cur, time: clampT(snapped) };
          if (d.mode === 'end' && cur.endTime !== undefined) {
            next = { ...next, endTime: Math.max(next.time + 0.05, clampT(Math.round(cur.endTime / step) * step)) };
          } else if (d.mode === 'start') {
            const fixedEnd = cur.endTime ?? nextStartByIndex.get(d.idx) ?? span;
            if (next.time > fixedEnd - 0.05) next = { ...next, time: Math.max(0, fixedEnd - 0.05) };
          }
          return list.map((s, j) => (j === d.idx ? next : s));
        });
      }
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

  /* ---- JSON export / import (#8) ------------------------------------------ */

  function exportJson() {
    const payload = JSON.stringify({ app: 'mpg-practice', version: 1, bpm, loopRegion, segments }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(audioName || 'progression').replace(/\.[^.]+$/, '')}.mpg.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function importJsonFile(f: File | undefined) {
    if (!f) return;
    void f.text().then((txt) => {
      try {
        const snap = sanitizeSnapshot(JSON.parse(txt));
        if (!snap) {
          alert('Not a valid MPG progression file.');
          return;
        }
        commitSegs(snap.segments);
        setBpm(snap.bpm);
        setLoopRegion(snap.loopRegion);
        setSelected(new Set([0]));
      } catch {
        alert('Could not parse JSON file.');
      }
    });
  }

  /** Short chord symbol for timeline clips, e.g. "Dm7", "Gmix". */
  function clipLabel(seg: Segment): string {
    const r = SHARP_NAMES[tokenPc(seg.root)] ?? seg.root;
    if (seg.chordId) {
      const t = CHORD_TEMPLATES.find((x) => x.id === seg.chordId);
      if (t) return `${r}${t.id}`; // id is already a compact symbol-ish token (min7, dom7…)
    }
    if (seg.scaleId) {
      const t = SCALE_TEMPLATES.find((x) => x.id === seg.scaleId);
      if (t) return `${r} ${t.name.slice(0, 4)}`;
    }
    return seg.label ?? r;
  }

  /** Next marker's start time in sorted order (implicit end for clips without endTime). */
  const nextStartByIndex = useMemo(() => {
    const map = new Map<number, number>();
    for (let k = 0; k < sorted.length - 1; k++) map.set(sorted[k]!.i, sorted[k + 1]!.s.time);
    return map;
  }, [sorted]);

  /** Seconds → 'bar:beat' at the current bpm (for editor tooltips / bar mode). */
  function toBarBeat(sec: number): string | null {
    if (bpm <= 0) return null;
    const beats = sec * (bpm / 60);
    const bar = Math.floor(beats) + 1;
    const beat = Math.floor((beats - Math.floor(beats)) * 4) + 1;
    return `${bar}:${beat}`;
  }

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

  /* Dynamic tick spacing that stays readable at any zoom level. */
  const tickStep = useMemo(() => {
    const pxPerSec = (visibleSpan() * zoom) / span;
    const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    return candidates.find((c) => c * pxPerSec >= 70) ?? 900;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, span]);
  const tickCount = Math.min(400, Math.floor(span / tickStep) + 1);

  const timelineSection = (
    <section className="panel">
      <h2>Timeline — click to seek · double-click to add a marker · drag clips to move / resize edges</h2>
      <div className="timeline-zoombar">
        <button onClick={() => setZoom(zoom / 1.5)} disabled={zoom <= 1} title="Zoom out (or Ctrl+wheel over the timeline)">−</button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round((Math.log(zoom) / Math.log(64)) * 100)}
          onInput={(e) => setZoom(Math.exp((Number((e.target as HTMLInputElement).value) / 100) * Math.log(64)))}
          aria-label="Timeline zoom"
          style={{ width: 140 }}
        />
        <button onClick={() => setZoom(zoom * 1.5)} title="Zoom in (or Ctrl+wheel over the timeline)">+</button>
        <span className="muted" style={{ fontSize: 12, minWidth: 44 }}>{zoom.toFixed(zoom < 10 ? 1 : 0)}×</span>
        <button onClick={fitTimeline} disabled={zoom <= 1} title="Fit whole track">fit</button>
        <label className="muted" style={{ fontSize: 12 }}>
          <input type="checkbox" checked={followPlayhead} onChange={(e) => setFollowPlayhead(e.target.checked)} /> follow
        </label>
        <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>ctrl/⌘ + wheel to zoom</span>
      </div>
          <div className="timeline-track">
            <div ref={fitSpanRef} className="timeline-scroll" onWheel={onTimelineWheel}>
            <div className="timeline-content" ref={barRef} style={{ width: `${zoom * 100}%` }}>
            <div className="timeline-timeaxis" aria-hidden="true">
              {Array.from({ length: tickCount }, (_, k) => {
                const t = tickStep * k;
                return (
                  <span key={k} className="tick" style={{ left: `${(t / span) * 100}%` }}>
                    {fmtTime(t)}
                  </span>
                );
              })}
            </div>
            <div
              className="timeline"
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
                    <span className="tl-clip-label">{clipLabel(s)}</span>
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
            </div>{/* .timeline-content */}
            </div>{/* .timeline-scroll */}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Active: {activeIdx >= 0 ? `${segmentName(segments[activeIdx]!)} (${fmtTime(segments[activeIdx]!.time)})` : 'none yet'}
            {nextSeg ? ` → next @ ${fmtTime(nextSeg.time)}: ${segmentName(nextSeg)}` : ''}
      </div>
    </section>
  );

  const transportBar = (
    <section className="panel practice-transport">
      <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input type="file" accept="audio/*" onChange={(e) => onFile(e.target.files?.[0])} />
        <button onClick={togglePlay} disabled={!audioName}>
          {playing ? '⏸ pause' : '▶ play'}
        </button>
        <span className="mono">
          {fmtTime(currentTime)} / {duration ? fmtTime(duration) : '--:--'}
          {bpm > 0 && <span className="barbeat" title={`bpm ${bpm}`}> · {toBarBeat(currentTime)}</span>}
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
    <section className="panel practice-editor">
      <h2>Progression editor ({segments.length} changes)</h2>
        <div className="row prog-toolbar" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button onClick={() => addMarkerAt(currentTime)}>+ marker @ play head</button>
          <button onClick={undo} disabled={undoStack.current.length === 0} title="Undo (Ctrl+Z)">↶ undo</button>
          <button onClick={redo} disabled={redoStack.current.length === 0} title="Redo (Ctrl+Y)">↷ redo</button>
          <button onClick={duplicateSelected} disabled={!selected.size}>duplicate</button>
          <button onClick={removeSelected} disabled={!selected.size}>remove selected</button>
          <button onClick={copySelection} disabled={!selected.size}>copy</button>
          <button onClick={pasteAfterSelection} disabled={!clip.length}>
            paste ×{pasteCount} after selection
          </button>
          <label className="mini-field">
            reps
            <input type="number" min={1} max={64} value={pasteCount} onChange={(e) => setPasteCount(Number(e.target.value) || 1)} />
          </label>
          <button onClick={applyBulk} disabled={!selected.size}>
            bulk: transpose {bulkStep > 0 ? '+ respace' : ''}
          </button>
          <label className="mini-field">
            st
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
          <label className="mini-field" title="Beats per minute — enables bar:beat time entry (e.g. 5:3 = bar 5, beat 3)">
            bpm
            <input type="number" min={0} max={300} value={bpm || ''} placeholder="0" onChange={(e) => setBpm(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <button
            onClick={() => {
              const n = Number(prompt('Repeat the whole progression N more times?', '1'));
              if (!Number.isFinite(n) || n <= 0) return;
              lastCoalesced.current = false;
              commitSegs((list) => {
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
            placeholder={`paste lines like:\n0\tD dorian\n8\tG mixolydian\n${bpm > 0 ? 'or bar:beat @ ' + bpm + ' bpm →\n1:1 Am7\n2:1 D7' : '(set bpm to allow bar:beat times)'}\n…or export the grid here`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) return;
              const parsed = parseSegments(v, bpm);
              if (parsed.length) {
                commitSegs(parsed);
                setSelected(new Set(parsed.map((_, i) => i).slice(0, 1)));
              }
            }}
            onFocus={(e) => {
              e.target.value = serializeSegments(segments);
            }}
          />
          <span className="muted" style={{ fontSize: 12 }}>import chord-prose (one change per line, blank line = section break):</span>
          <textarea
            className="prog-io"
            rows={3}
            placeholder={'Am7\nD7\n\nGmaj7\nCmaj7'}
            onBlur={(e) => {
              const v = e.target.value;
              if (!v.trim()) return;
              const parsed = parseChordProse(v, proseSpacing || 2, proseReps || 1);
              if (parsed.length) {
                commitSegs(parsed);
                setSelected(new Set([0]));
                e.target.value = '';
              }
            }}
          />
          <label className="mini-field">
            spacing (s)
            <input type="number" min={0.25} max={64} step={0.25} value={proseSpacing} onChange={(e) => setProseSpacing(Number(e.target.value) || 2)} />
          </label>
          <label className="mini-field">
            reps
            <input type="number" min={1} max={64} value={proseReps} onChange={(e) => setProseReps(Number(e.target.value) || 1)} />
          </label>
          <button onClick={exportJson}>export JSON</button>
          <label className="file-btn">
            import JSON
            <input type="file" accept=".json,application/json" onChange={(e) => importJsonFile(e.target.files?.[0])} />
          </label>
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
                  <td title={toBarBeat(s.time) ? `bar:beat ${toBarBeat(s.time)}` : undefined}>
                    <input
                      type="number"
                      step={0.1}
                      value={s.time}
                      onChange={(e) => patch(i, { time: Number(e.target.value) || 0 })}
                    />
                    {bpm > 0 && <span className="barbeat">{toBarBeat(s.time)}</span>}
                  </td>
                  <td>
                    <select value={s.root} onChange={(e) => patch(i, { root: e.target.value })}>
                      {NOTE_TOKENS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={s.scaleId ?? ''}
                      className={s.scaleId == null && s.label ? 'no-match' : undefined}
                      title={s.scaleId == null && s.label ? `free text: "${s.label}" (no matching template)` : undefined}
                      onChange={(e) => patch(i, { scaleId: e.target.value || null })}
                    >
                      <option value="">{s.label ? `— ${s.label} —` : 'none'}</option>
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
                    <button className="overlay-remove" aria-label={`remove row ${i + 1}`} onClick={() => removeById(s.id)}>
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

  const leftColumn = (
    <aside className="controls practice-controls">
      {transportBar}
      {editorSection}
    </aside>
  );

  const rightColumn = (
    <div className="practice-right">
      {viewerStack}
      <div className="practice-timeline-row">{timelineSection}</div>
    </div>
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

      {/* Two-column body: controls + progression editor (left), viewers with the
          arrange-style timeline pinned at the bottom of the right pane. */}
      {leftColumn}
      {rightColumn}
    </div>
  );
}
