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
  type Effect,
  type Instrument,
  type NotationMode,
  type Palette,
  type Pattern,
  type RelationGroup,
  type RenderLayer,
  type VisualizationScene,
  type ViewWindow,
} from '@mpg/core';
import { rootTemplateAt, findTemplate } from '@mpg/core/library';

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

  const groups: RelationGroup[] = [];
  if (toggles.connectors) {
    groups.push(...patternGroups(instrument, options.patterns, { layer: 'patterns' }));
    if (options.showOverlap && options.patterns.length >= 2) {
      groups.push(...overlapGroups(instrument, options.patterns[0]!, options.patterns[1]!));
    }
    for (let i = 0; i < (options.overlayChords?.length ?? 0); i++) {
      const chord = options.overlayChords![i]!;
      const members = positionsForPatternSafe(instrument, chord);
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
          ...chordInScaleGroups(instrument, scale, {
            size: options.chordSize ?? 4,
            minMembers: 3,
            kind: 'hull',
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

  return {
    instrument,
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
    showBackground: toggles.background,
    includeAllCandidates: options.includeAllCandidates ?? false,
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
