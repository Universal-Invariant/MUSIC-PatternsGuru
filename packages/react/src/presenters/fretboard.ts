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
  rootLabel,
  shapeForStep,
  type Instrument,
  type MarkerContent,
  type MarkerShape,
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
  keyboard = false,
): { x: number; y: number } {
  // On a keyboard layout the black-key lane sits *between* white keys, so its
  // markers are drawn half a column to the right of their semitone column.
  const laneOffset = keyboard && row === 1 ? 0.5 : 0;
  return {
    x: geo.padX + (col - window.colStart + laneOffset) * geo.cellW + geo.cellW / 2,
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
  /** Semitone step above the owning pattern's root (drives function shapes). */
  readonly step: number;
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
  window: ResolvedWindow,
  /** Box-pattern view: fill every in-window occurrence on every string. */
  fretWindow?: { colStart: number; colEnd: number },
): Map<string, Assignment> {
  const out = new Map<string, Assignment>();
  const takenPcs = new Set<number>(); // pc -> already has a primary marker (shape mode)

  patterns.forEach((pattern, idx) => {
    const mode = modes[idx] ?? modes[0] ?? 'tonal';
    const weight = emphasis[idx] ?? emphasis[0] ?? 1;
    const memberSteps = new Set(pattern.steps.map((s) => pcAdd(pattern.root, s)));

    function place(p: Position, step: number): void {
      let stepIndex = pattern.steps.indexOf(step);
      if (stepIndex < 0) stepIndex = pattern.steps.indexOf(pc(step));
      // Concrete linear pitch numbers for the label-rule engine (labels.ts):
      // the sounding note at this position, and the root anchored to the same
      // octave region (rootOfRegion below keeps every degree's label identical
      // across octaves — pc distance from root is what tonal/interval/number
      // modes display).
      const midi = p.midi;
      const rootOfRegion =
        midi === undefined
          ? undefined
          : (() => {
              const raw = midi - pc(step);
              return ((raw % 12) + 12) % 12 === pc(pattern.root)
                ? raw
                : raw + ((((pc(pattern.root) - ((raw % 12) + 12) % 12) + 18) % 12) - 6);
            })();
      let content = markerForPatternMember(pattern, stepIndex < 0 ? 0 : stepIndex, {
        mode,
        palette,
        keyContext: patternPcs(pattern),
        pitchLinear: midi,
        rootLinear: rootOfRegion,
      });
      // Root markers always carry the root's *note name* ("E", "Bb") as a
      // sub-label so the anchor is unambiguous in every notation mode. In
      // letter mode the main text already is the note name, so we only add
      // the sub label elsewhere. (MarkerContent is readonly → replace.)
      if (content.isRoot && mode !== 'letter') {
        content = {
          ...content,
          sub: rootLabel(pattern.root, pattern.rootSpelling?.alteration === -1),
        };
      }
      const existing = out.get(p.id);
      if (existing && existing.content.isRoot && !content.isRoot) return;
      out.set(p.id, {
        position: p,
        content,
        patternId: pattern.id,
        groups: [`pattern:${pattern.id}`],
        alpha: weight,
        scale: content.isRoot ? 1.15 : 1,
        step: pc(step),
      });
    }

    // Box-pattern ("position") view: show the scale/chord clipped to a fixed
    // fret window — every string contributes its in-window occurrences of each
    // member pitch class, so the classic CAGED-style shape appears across all
    // six strings between frets N and M. Positions outside the window are
    // skipped entirely (pure clipping), unlike the dimmed global view.
    if (fretWindow) {
      const seen = new Set<string>();
      const inBox: { pos: Position; step: number }[] = [];
      for (const step of pattern.steps) {
        const targetPc = pcAdd(pattern.root, step);
        for (const cand of instrument.pitchClassToPositions(targetPc)) {
          const col = cand.position.col;
          if (col < fretWindow.colStart || col > fretWindow.colEnd) continue;
          const key = `${cand.position.id}:${targetPc}`;
          if (seen.has(key)) continue;
          seen.add(key);
          inBox.push({ pos: cand.position, step });
        }
      }
      // Anchor: the lowest occurrence of the pattern root inside the box (the
      // note a player reads the shape from). It must always be placed as the
      // root marker, even when it shares a fret with another degree.
      let anchorPos: Position | undefined;
      for (const cand of instrument.pitchClassToPositions(pc(pattern.root))) {
        const col = cand.position.col;
        if (col < fretWindow.colStart || col > fretWindow.colEnd) continue;
        const midi = cand.position.midi ?? 0;
        if (!anchorPos || midi < (anchorPos.midi ?? 0)) anchorPos = cand.position;
      }
      // One marker per fret/string cell. Within a cell, priority is:
      //   pattern root > earlier pattern's root > lower sounding MIDI.
      // This keeps shared frets (e.g. B and E on the two high strings, which
      // sit at the same fret everywhere) from silently dropping notes — with
      // one marker per *cell* instead of per *pitch class*, every string still
      // shows all of its in-window notes, covering every octave in the box.
      type Cell = { pos: Position; step: number; midi: number; rank: number };
      const byCell = new Map<string, Cell>();
      const rank = (pos: Position, step: number): number => {
        const isPatRoot = pc(step) === pc(pattern.root) ? 0 : 1;
        return isPatRoot * 1_000_000 + (pos.midi ?? 0);
      };
      for (const item of inBox) {
        const cellKey = item.pos.id;
        const prev = byCell.get(cellKey);
        const mine = rank(item.pos, item.step);
        if (!prev || mine < prev.rank) {
          byCell.set(cellKey, { pos: item.pos, step: item.step, midi: item.pos.midi ?? 0, rank: mine });
        }
      }
      const cells = [...byCell.values()].sort(
        (a, b) => a.midi - b.midi || a.pos.row - b.pos.row,
      );
      for (const c of cells) place(c.pos, c.step);
      // Guarantee the anchor cell carries the root marker (cells claimed by an
      // overlapping degree of this pattern get re-placed as the root).
      if (anchorPos && !out.get(anchorPos.id)?.content.isRoot) {
        place(anchorPos, 0);
      }
      return;
    }

    // The entire fretboard is ALWAYS populated with one marker per pitch class.
    // `includeAllCandidates` ("All positions") lights up *every* position that
    // can sound a member pitch (multi-octave view, no dimming). Otherwise we
    // pick exactly one position per pitch class, chosen for best playability
    // relative to the current window; markers that fall outside the window are
    // dimmed at render time (see present()).
    if (includeAllCandidates) {
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
      return;
    }

    type Pick = { pos: Position; step: number; midi: number };
    const picks: Pick[] = [];
    const windowCentre = (window.colStart + window.colEnd) / 2;

    // One marker per *pitch class*, placed like a real first-position scale:
    // the lowest playable occurrence of each member pitch (ascending MIDI,
    // low → high) claims its pc slot. Because guitar tunings stack fourths,
    // this naturally spreads the scale diagonally across strings — E ionian
    // reads 0-2-4-5-7 on the low E string, then A/B/C# on the A string, and so
    // on, exactly the classic box shape including open strings. Later octaves
    // of an already-taken pc are skipped; "All positions" (above) shows them.
    interface Occurrence {
      readonly step: number;
      readonly targetPc: number;
      readonly pos: Position;
      readonly midi: number;
    }
    const occurrences: Occurrence[] = [];
    for (const step of pattern.steps) {
      const targetPc = pcAdd(pattern.root, step);
      for (const cand of instrument.pitchClassToPositions(targetPc)) {
        occurrences.push({
          step,
          targetPc,
          pos: cand.position,
          midi: cand.position.midi ?? 0,
        });
      }
    }
    occurrences.sort(
      (a, b) =>
        a.midi - b.midi ||
        Math.abs(a.pos.col - windowCentre) - Math.abs(b.pos.col - windowCentre) ||
        a.pos.row - b.pos.row,
    );

    for (const occ of occurrences) {
      if (takenPcs.has(occ.targetPc)) continue;
      takenPcs.add(occ.targetPc);
      picks.push({ pos: occ.pos, step: occ.step, midi: occ.midi });
    }

    // Place in ascending-MIDI order so earlier patterns' roots claim shared
    // slots first and the shape reads low-to-high across strings.
    picks.sort((a, b) => a.midi - b.midi || a.pos.row - b.pos.row);
    for (const p of picks) {
      place(p.pos, p.step);
    }
  });
  return out;
}

/** Resolve relation groups into connector point sets using layout geometry. */
function buildConnectors(
  groups: readonly RelationGroup[],
  instrument: Instrument,
  geo: FretboardGeometry,
  window: ResolvedWindow,
  keyboard = false,
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
      points.push(cellCenter(p.row, p.col, geo, window, keyboard));
    }
    if (points.length === 0) continue;
    let anchor: { x: number; y: number } | undefined;
    if (group.anchor) {
      const a = byId.get(group.anchor);
      if (a) anchor = cellCenter(a.row, a.col, geo, window, keyboard);
    }
    out.push({ group, points, anchor });
  }
  return out;
}

function layerVisible(layers: readonly RenderLayer[], id: string): boolean {
  const l = layers.find((x) => x.id === id);
  return l ? l.visible : true;
}

/**
 * Resolve the geometry of one pattern marker. Function-based palettes win over
 * legacy role palettes: shape is looked up by tonal degree class (the same key
 * space the colour palettes use), so chord tones vs tensions read at a glance.
 */
function resolveMarkerShape(scene: VisualizationScene, a: Assignment): MarkerShape | undefined {
  if (scene.functionShapes) {
    if (a.content.isRoot && scene.functionShapes.degrees['1'] === undefined) {
      return 'disc';
    }
    return shapeForStep(scene.functionShapes, a.content.degree ?? '', a.step);
  }
  if (scene.shapes) return a.content.isRoot ? scene.shapes.root : scene.shapes.member;
  return undefined;
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
    const effects = layerVisible(layers, 'effects') ? (scene.effects ?? defaultEffects()) : undefined;

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
      window,
      scene.fretWindow,
    );
    // User-controlled global dot/text size (the "marker size" slider in the UI).
    const markerScale = scene.markerScale ?? 1;
    // Independent label font + halo controls (request: font size and border
    // thickness for scale labels, separate from the dot size).
    const fontSizeScale = scene.fontSizeScale ?? 1;
    const haloWidthScale = scene.haloWidthScale ?? 1;

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
          shape: scene.functionShapes?.ghost ?? scene.shapes?.ghost,
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
      const effect = effects ? (a.content.isRoot ? effects.root : effects.member) : undefined;
      // Window dimming: the whole fretboard is always shown, but pattern
      // markers outside the movable window become semi-transparent so the
      // in-window shape pops. "All positions" disables this entirely.
      const outsideWindow =
        !scene.fretWindow &&
        !scene.includeAllCandidates &&
        (a.position.col < window.colStart || a.position.col > window.colEnd);
      markers.push({
        position: a.position,
        content: a.content,
        patternId: a.patternId,
        groups: [...a.groups, ...extra],
        effect,
        alpha: outsideWindow ? Math.min(a.alpha, 0.28) : a.alpha,
        scale: a.scale * markerScale,
        fontSizeScale,
        haloWidthScale,
        shape: resolveMarkerShape(scene, a),
      });
    }

    const keyboard = layout.metric === 'semitone';
    const connectors = buildConnectors(connectorGroups, instrument, this.geo, window, keyboard);

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
        keyboard,
        lowMidi: instrument.positions()[0]?.midi ?? '',
      },
    };
  }
}

/** Default singleton presenter used by the React bindings. */
export const fretboardPresenter = new FretboardPresenter();
