/**
 * Scene builder: the ergonomic front door of @mpg/react.
 *
 * UI code should never hand-assemble `VisualizationScene` objects — this module
 * turns high-level intent ("show D dorian with its diatonic 7th chords, tonal
 * notation, frets 0–12") into a fully-resolved scene: patterns, relation groups,
 * layers, effects, and window clipping. It is the seam where "what the user asked
 * for" becomes "what the presenter receives".
 */

import {
  TONAL_PALETTE,
  patternPcs as patternPcsList,
  defaultLayers,
  patternGroups,
  chordInScaleGroups,
  overlapGroups,
  mergeGroups,
  transpose,
  FUNCTION_SHAPE_PALETTES,
  type Effect,
  type FunctionShapePalette,
  type Instrument,
  type NotationMode,
  type Palette,
  type Pattern,
  type RelationGroup,
  type RenderLayer,
  type ShapePalette,
  type VisualizationScene,
  type ViewWindow,
} from '@mpg/core';
import { rootTemplateAt, findTemplate } from '@mpg/core/library';

/**
 * Box-pattern view: returns a lightweight clone of `base` whose preferred
 * flags mark every in-window occurrence of each pitch class, so CAGED-style
 * boxes light up on all strings. Pure — the original instrument is untouched.
 */
export function withFretWindow(
  base: Instrument,
  win: { colStart: number; colEnd: number },
): Instrument {
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

export interface LayerToggle {
  readonly connectors: boolean;
  readonly labels: boolean;
  readonly background: boolean;
  readonly effects: boolean;
}

export const DEFAULT_TOGGLES: LayerToggle = {
  connectors: true,
  labels: true,
  background: true,
  effects: true,
};

export interface BuildSceneOptions {
  /** One pattern = single view; several = overlaid on the same instrument. */
  patterns: readonly Pattern[];
  mode?: NotationMode;
  /** Per-pattern modes (overrides `mode`). */
  modes?: readonly NotationMode[];
  palette?: Palette;
  window?: ViewWindow;
  /**
   * Box-pattern ("position") view: when set, pattern markers are clipped to
   * this fret window AND every in-window occurrence is shown on all strings
   * (CAGED-style boxes), instead of one canonical position per pitch class.
   * Relation groups (chords-in-scale, overlaps) are restricted to the same
   * window so the underlay always agrees with what is visible.
   */
  fretWindow?: { colStart: number; colEnd: number };
  toggles?: Partial<LayerToggle>;
  /** Draw diatonic chord blobs inside the first scale-typed pattern. */
  showChordsInScale?: boolean;
  /** Chord stack size for {@link showChordsInScale}: 3 = triads, 4 = sevenths. */
  chordSize?: 3 | 4;
  /** Overlap/difference analysis between the first two patterns. */
  showOverlap?: boolean;
  /**
   * Chords stacked *on top of* the first (scale) pattern, e.g. C#dim under a
   * D phrygian-dominant and Bmaj7#5 above it. Each chord gets its own colour
   * ring, reduced opacity so the scale underneath stays readable, and a blob
   * connector labelled with the chord name.
   */
  overlayChords?: readonly Pattern[];
  /** Extra semantic groups merged in after the computed ones. */
  extraGroups?: readonly RelationGroup[];
  includeAllCandidates?: boolean;
  /** Global dot/text size multiplier (UI slider). */
  markerScale?: number;
  /** Marker shape palette (UI dropdown). Undefined = discs. */
  shapes?: ShapePalette;
  /**
   * Function-based shape palette: one shape per tonal degree class, analogous
   * to the colour palettes (e.g. circles for chord tones, squares for the
   * rest). Takes precedence over {@link shapes}. Custom objects (the future
   * palette editor's output) may be passed directly; built-ins are looked up
   * by {@link functionShapeId} from core's FUNCTION_SHAPE_PALETTES.
   */
  functionShapes?: FunctionShapePalette;
  /** Built-in function-shape palette id (see FUNCTION_SHAPE_PALETTES in core). */
  functionShapeId?: string;
  /** Per-pattern opacity/emphasis for the base patterns (overlay alpha is fixed). */
  emphasis?: readonly number[];
  rootEffect?: Effect;
}

const EFFECT_ROOT_GLOW: Effect = { kind: 'glow', rate: 0.6, intensity: 0.9 };

/** Distinct ring colours for stacked chord overlays. */
const OVERLAY_COLORS = ['#ff5d8f', '#4dd0e1', '#aed581', '#ffb74d', '#b39ddb', '#f06292'];

function positionsForPatternSafe(instrument: Instrument, pattern: Pattern): string[] {
  const ids: string[] = [];
  for (const p of patternPcsList(pattern)) {
    for (const c of instrument.pitchClassToPositions(p)) if (c.preferred) ids.push(c.position.id);
  }
  return ids;
}
const EFFECT_NONE: Effect = { kind: 'none' };

function layersFor(toggles: LayerToggle): RenderLayer[] {
  return defaultLayers().map((l) => {
    switch (l.id) {
      case 'connectors':
        return { ...l, visible: toggles.connectors };
      case 'labels':
        return { ...l, visible: toggles.labels };
      case 'effects':
        return { ...l, visible: toggles.effects };
      default:
        return l;
    }
  });
}

/** Build a complete visualization scene. Pure; safe to call every render. */
export function buildScene(instrument: Instrument, options: BuildSceneOptions): VisualizationScene {
  const toggles: LayerToggle = { ...DEFAULT_TOGGLES, ...options.toggles };
  const mode = options.mode ?? 'tonal';
  const modes = options.modes ?? options.patterns.map(() => mode);

  // Box-pattern view: swap in a window-aware instrument whose preferred flags
  // mark *every* in-window occurrence, so patterns light up all six strings
  // inside the box. The presenter still clips markers to `scene.window`, and we
  // pass the same window to relation grouping so connectors match what's shown.
  const win = options.fretWindow;
  let viewInstrument = win ? withFretWindow(instrument, win) : instrument;
  // Keyboard instruments: the generic one-per-pitch-class assignment would show
  // only a single octave. Box mode instead lights up every key inside the
  // window (fixed-pitch layout → "box" == visible keyboard range).
  if (win && instrument.layout().metric === 'semitone') {
    viewInstrument = withFretWindow(viewInstrument, { colStart: 0, colEnd: instrument.layout().cols - 1 });
  }

  const groups: RelationGroup[] = [];
  if (toggles.connectors) {
    groups.push(...patternGroups(viewInstrument, options.patterns, { layer: 'patterns' }));
    if (options.showOverlap && options.patterns.length >= 2) {
      groups.push(...overlapGroups(viewInstrument, options.patterns[0]!, options.patterns[1]!, { window: win }));
    }
    for (let i = 0; i < (options.overlayChords?.length ?? 0); i++) {
      const chord = options.overlayChords![i]!;
      const members = positionsForPatternSafe(viewInstrument, chord);
      if (members.length === 0) continue;
      groups.push({
        id: `overlay:${chord.id}:${i}`,
        label: chord.name,
        color: OVERLAY_COLORS[i % OVERLAY_COLORS.length]!,
        kind: 'hull',
        members,
        layer: 'connectors',
        meta: { overlay: true, root: chord.root },
      });
    }
    if (options.showChordsInScale) {
      const scale = options.patterns.find((p) => p.kind === 'scale' || p.kind === 'mode');
      if (scale) {
        groups.push(
          ...chordInScaleGroups(viewInstrument, scale, {
            size: options.chordSize ?? 4,
            minMembers: 3,
            kind: 'hull',
            window: win,
          }),
        );
      }
    }
  }
  const merged = mergeGroups(groups, [...(options.extraGroups ?? [])]);

  // Overlay chords join the scene with reduced alpha so markers blend and the
  // underlying scale shows through (item 6: transparency on overlays).
  const overlays = options.overlayChords ?? [];
  const allPatterns = [...options.patterns, ...overlays];
  const allModes = [...modes, ...overlays.map(() => mode)];
  const emphasis = [
    ...options.patterns.map((_, i) => options.emphasis?.[i] ?? 1),
    ...overlays.map(() => 0.82),
  ];

  // Box-pattern view is *exclusive for markers*: inside the fret window every
  // occurrence on every string is shown (the classic CAGED "position" picture).
  // It must NOT crop the fretboard itself — the full neck stays visible so the
  // box reads in context. So we keep the caller's scroll/viewport window (or
  // the whole neck by default) and only pass `fretWindow` for marker clipping.
  const includeAll = win ? false : (options.includeAllCandidates ?? false);

  return {
    instrument: viewInstrument,
    patterns: allPatterns,
    modes: allModes.slice(0, allPatterns.length),
    emphasis,
    palette: options.palette ?? TONAL_PALETTE,
    layers: layersFor(toggles),
    groups: merged,
    effects: toggles.effects
      ? { root: options.rootEffect ?? EFFECT_ROOT_GLOW, member: EFFECT_NONE, outside: EFFECT_NONE }
      : undefined,
    window: options.window,
    fretWindow: win,
    showBackground: toggles.background,
    includeAllCandidates: includeAll,
    markerScale: options.markerScale ?? 1,
    shapes: options.shapes,
    functionShapes:
      options.functionShapes ??
      (options.functionShapeId
        ? FUNCTION_SHAPE_PALETTES.find((p) => p.id === options.functionShapeId)
        : undefined),
  };
}

/** Shorthand: root a library template (`rootPattern('D', 'dorian')`). */
export function rootPattern(rootName: string, templateId: string): Pattern | undefined {
  const t = findTemplate(templateId);
  return t ? rootTemplateAt(t, rootName) : undefined;
}

/** All 12 transpositions of a pattern's shape (for orbit browsers). */
export function transpositionFamily(pattern: Pattern): Pattern[] {
  const out: Pattern[] = [];
  for (let n = 0; n < 12; n++) out.push(transpose(pattern, n));
  return out;
}
