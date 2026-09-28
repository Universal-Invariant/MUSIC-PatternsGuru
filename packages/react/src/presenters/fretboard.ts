/**
 * The fretboard presenter: turns a `VisualizationScene` on any grid-oriented
 * instrument into a concrete `RenderFrame` (markers + connectors with pixel
 * geometry). Pure data in, pure data out — no DOM, fully unit-testable, and the
 * same frame feeds the SVG renderer today and a Canvas/WebGL renderer tomorrow.
 */

import {
  TONAL_PALETTE,
  defaultEffects,
  defaultLayers,
  markerForNonMember,
  markerForPatternMember,
  pc,
  pcAdd,
  pcSub,
  patternPcs,
  type Instrument,
  type MarkerContent,
  type NotationMode,
  type Palette,
  type Pattern,
  type Position,
  type Presenter,
  type RenderConnector,
  type RenderFrame,
  type RenderLayer,
  type RenderMarker,
  type RelationGroup,
  type VisualizationScene,
  type ViewWindow,
} from '@mpg/core';

export interface FretboardGeometry {
  readonly cellW: number;
  readonly cellH: number;
  readonly padX: number;
  readonly padY: number;
  /** Extra room at the bottom for fret-number labels. */
  readonly labelH: number;
}

export const DEFAULT_GEOMETRY: FretboardGeometry = {
  cellW: 46,
  cellH: 40,
  padX: 28,
  padY: 24,
  labelH: 26,
};

export interface ResolvedWindow {
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly colStart: number;
  readonly colEnd: number;
}

/** Centre of a position's cell in pixel space. */
export function cellCenter(
  row: number,
  col: number,
  geo: FretboardGeometry,
  window: ResolvedWindow,
): { x: number; y: number } {
  return {
    x: geo.padX + (col - window.colStart) * geo.cellW + geo.cellW / 2,
    y: geo.padY + (row - window.rowStart) * geo.cellH + geo.cellH / 2,
  };
}

function resolveWindow(layoutRows: number, layoutCols: number, w?: ViewWindow): ResolvedWindow {
  return {
    rowStart: w?.rowStart ?? 0,
    rowEnd: Math.min(layoutRows - 1, w?.rowEnd ?? layoutRows - 1),
    colStart: w?.colStart ?? 0,
    colEnd: Math.min(layoutCols - 1, w?.colEnd ?? layoutCols - 1),
  };
}

interface Assignment {
  readonly position: Position;
  readonly content: MarkerContent;
  readonly patternId: string;
  readonly groups: string[];
  readonly alpha: number;
  readonly scale: number;
}

/**
 * Compute per-position contents for a scene.
 *
 * Mapping strategy (the pitch -> position adjunction, made concrete):
 *   - One marker per *pitch class* by default. The instrument engine ranks all
 *     candidate positions by playability cost; we take the cheapest one, which
 *     produces contiguous "box"-shaped patterns anchored on low strings and
 *     including open strings (E ionian from low to high reads 0-2-3-4-5-7 on
 *     the two lowest strings, exactly like a real first-position scale).
 *   - `includeAllCandidates` lights up *every* position that can sound the note
 *     — the full-fretboard view for shape-transposition study.
 *   - Later patterns never overwrite an existing root marker (roots always win),
 *     giving overlaid patterns a sensible priority without configuration.
 */
/** True when an assignment's marker is that pattern's root/anchor. */
function contentIsRoot(a: Assignment): boolean {
  return a.content.isRoot;
}

function assignMarkers(
  instrument: Instrument,
  patterns: readonly Pattern[],
  modes: readonly NotationMode[],
  palette: Palette,
  includeAllCandidates: boolean,
  emphasis: readonly number[],
): Map<string, Assignment> {
  const out = new Map<string, Assignment>();
  const takenPcs = new Set<number>(); // pc -> already has a primary marker (single-pos mode)

  patterns.forEach((pattern, idx) => {
    const mode = modes[idx] ?? modes[0] ?? 'tonal';
    const weight = emphasis[idx] ?? emphasis[0] ?? 1;
    const memberSteps = new Set(pattern.steps.map((s) => pcAdd(pattern.root, s)));

    function place(p: Position, step: number): void {
      let stepIndex = pattern.steps.indexOf(step);
      if (stepIndex < 0) stepIndex = pattern.steps.indexOf(pc(step));
      const content = markerForPatternMember(pattern, stepIndex < 0 ? 0 : stepIndex, {
        mode,
        palette,
        keyContext: patternPcs(pattern),
      });
      const existing = out.get(p.id);
      if (existing && existing.content.isRoot && !content.isRoot) return;
      out.set(p.id, {
        position: p,
        content,
        patternId: pattern.id,
        groups: [`pattern:${pattern.id}`],
        alpha: weight,
        scale: content.isRoot ? 1.15 : 1,
      });
    }

    if (!includeAllCandidates) {
      // Single-position ("shape") view: for every pitch class in the pattern,
      // take the engine's preferred candidate — the playability-ranked position
      // (fewest frets, mid-neck, lower strings). This yields contiguous box
      // shapes anchored where a real player would put their hand, including
      // open strings: E ionian on guitar reads 0-2-4-5-7-9-11 on the low E
      // string, 0-2 on A, 0-2 on D, 1-4 on G, 0-2 on B, and 0-2-4-5 on the
      // high E string.
      for (const step of pattern.steps) {
        const targetPc = pcAdd(pattern.root, step);
        if (takenPcs.has(targetPc)) continue;
        const candidates = instrument.pitchClassToPositions(targetPc);
        if (candidates.length === 0) continue;
        const chosen = candidates.find((c) => c.preferred) ?? candidates[0]!;
        // A position can already be owned by an earlier pattern (e.g. a chord
        // overlay sharing tones with the scale). Roots win over non-members; if
        // the slot is held by another pattern's root we keep it and place this
        // pc at its next-best candidate so no note silently disappears.
        let pos = chosen.position;
        if (out.has(pos.id) && out.get(pos.id)!.patternId !== pattern.id) {
          // Slot is owned by another pattern (e.g. chord overlay sharing tones
          // with the scale). Prefer this pattern's next-best *free* candidate so
          // every note of every stacked pattern stays visible.
          const alt = candidates.find(
            (c) => c.position.id !== pos.id && (!out.has(c.position.id) || out.get(c.position.id)!.patternId === pattern.id),
          );
          if (alt) pos = alt.position;
        }
        place(pos, step);
        takenPcs.add(targetPc);
      }
      return;
    }

    // Full-fretboard view: iterate positions in performance order (low -> high)
    // and light up every position that can sound a member pitch.
    const allPositions = [...instrument.positions()]
      .filter((p) => p.midi !== undefined && instrument.positionToPitch(p).kind === 'exact')
      .sort((a, b) => (a.midi ?? 0) - (b.midi ?? 0));

    for (const p of allPositions) {
      const binding = instrument.positionToPitch(p);
      if (binding.kind !== 'exact') continue;
      const step = pcSub(binding.midi, pattern.root);
      if (!memberSteps.has(pcAdd(pattern.root, step))) continue;

      place(p, step);
    }
  });
  return out;

  // `place` is defined inside the per-pattern callback below via closure.
}

/** Resolve relation groups into connector point sets using layout geometry. */
function buildConnectors(
  groups: readonly RelationGroup[],
  instrument: Instrument,
  geo: FretboardGeometry,
  window: ResolvedWindow,
): RenderConnector[] {
  const byId = new Map(instrument.positions().map((p) => [p.id, p]));
  const out: RenderConnector[] = [];
  for (const group of groups) {
    const points: { x: number; y: number }[] = [];
    for (const memberId of group.members) {
      const p = byId.get(memberId);
      if (!p) continue;
      if (p.row < window.rowStart || p.row > window.rowEnd) continue;
      if (p.col < window.colStart || p.col > window.colEnd) continue;
      points.push(cellCenter(p.row, p.col, geo, window));
    }
    if (points.length === 0) continue;
    let anchor: { x: number; y: number } | undefined;
    if (group.anchor) {
      const a = byId.get(group.anchor);
      if (a) anchor = cellCenter(a.row, a.col, geo, window);
    }
    out.push({ group, points, anchor });
  }
  return out;
}

function layerVisible(layers: readonly RenderLayer[], id: string): boolean {
  const l = layers.find((x) => x.id === id);
  return l ? l.visible : true;
}

export class FretboardPresenter implements Presenter {
  readonly id = 'fretboard';
  readonly name = 'Fretboard Presenter';
  readonly accepts = ['fretted-string', 'bowed-string', 'plucked-string'];

  constructor(private readonly geo: FretboardGeometry = DEFAULT_GEOMETRY) {}

  present(scene: VisualizationScene): RenderFrame {
    const { instrument } = scene;
    const layout = instrument.layout();
    const window = resolveWindow(layout.rows, layout.cols, scene.window);
    const palette = scene.palette ?? TONAL_PALETTE;
    const modes = scene.modes ?? ['tonal'];
    const layers = scene.layers ?? defaultLayers();
    const effects = scene.effects ?? defaultEffects();

    const cols = window.colEnd - window.colStart + 1;
    const rows = window.rowEnd - window.rowStart + 1;
    const width = this.geo.padX * 2 + cols * this.geo.cellW;
    const height = this.geo.padY * 2 + rows * this.geo.cellH + this.geo.labelH;

    const assignments = assignMarkers(
      instrument,
      scene.patterns,
      modes,
      palette,
      scene.includeAllCandidates ?? false,
      scene.emphasis ?? [1],
    );

    const markers: RenderMarker[] = [];

    // Background (non-member) dots first so pattern markers draw over them.
    if (scene.showBackground && layerVisible(layers, 'body')) {
      for (const p of instrument.positions()) {
        if (assignments.has(p.id)) continue;
        if (p.row < window.rowStart || p.row > window.rowEnd) continue;
        if (p.col < window.colStart || p.col > window.colEnd) continue;
        markers.push({
          position: p,
          content: markerForNonMember(palette, modes[0] ?? 'tonal'),
          groups: [],
          alpha: 0.35,
          scale: 0.45,
        });
      }
    }

    const connectorGroups = layerVisible(layers, 'connectors') ? (scene.groups ?? []) : [];
    const groupIdsByPosition = new Map<string, string[]>();
    for (const g of connectorGroups) {
      for (const m of g.members) {
        const list = groupIdsByPosition.get(m) ?? [];
        list.push(g.id);
        groupIdsByPosition.set(m, list);
      }
    }

    for (const a of assignments.values()) {
      const extra = groupIdsByPosition.get(a.position.id) ?? [];
      const effect = a.content.isRoot ? effects.root : effects.member;
      markers.push({
        position: a.position,
        content: a.content,
        patternId: a.patternId,
        groups: [...a.groups, ...extra],
        effect,
        alpha: a.alpha,
        scale: a.scale,
      });
    }

    const connectors = buildConnectors(connectorGroups, instrument, this.geo, window);

    return {
      instrumentId: instrument.id,
      width,
      height,
      layers,
      markers,
      connectors,
      palette,
      mode: modes[0] ?? 'tonal',
      hints: {
        cellW: this.geo.cellW,
        cellH: this.geo.cellH,
        padX: this.geo.padX,
        padY: this.geo.padY,
        labelH: this.geo.labelH,
        rowStart: window.rowStart,
        rowEnd: window.rowEnd,
        colStart: window.colStart,
        colEnd: window.colEnd,
        orientation: layout.orientation,
        axisRow: layout.axisLabels[0],
        axisCol: layout.axisLabels[1],
      },
    };
  }
}

/** Default singleton presenter used by the React bindings. */
export const fretboardPresenter = new FretboardPresenter();
