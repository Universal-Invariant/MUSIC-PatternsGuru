/**
 * The presenter contract.
 *
 * A presenter is the layer between "what to show" and "how to draw it". It takes
 * a {@link VisualizationScene} (pure data: instrument + patterns + notation +
 * effects + layers) and produces a {@link RenderFrame} (also pure data: markers,
 * shapes, connectors). A *renderer* then turns a frame into SVG/Canvas/DOM/WebGL.
 *
 * Why three layers instead of two?
 *   - Presenters are testable without a browser and reusable across renderers
 *     (the same fretboard presenter feeds both the SVG view and the WebGL view).
 *   - Renderers can be swapped for platform targets (web, Canvas, native via
 *     Skia, terminal) without touching music logic.
 *   - Frames are serializable, which gives us PNG/SVG export, snapshot testing,
 *     and server-side rendering for free.
 */

import type { Instrument, Position } from './instrument.js';
import type { Pattern } from './pattern.js';
import type { MarkerContent, NotationMode, Palette } from './notation.js';

export type EffectKind = 'none' | 'glow' | 'fire' | 'throb' | 'blink' | 'pulse' | 'sweep';

/** Visual effect applied to a marker or group. Time-parameterized by renderer. */
export interface Effect {
  readonly kind: EffectKind;
  /** Cycles per second (0 = static). */
  readonly rate?: number;
  /** 0..1 strength. */
  readonly intensity?: number;
  /** Phase offset in seconds, used to stagger neighbouring markers. */
  readonly phase?: number;
  /** Optional hue shift for fire/sweep effects. */
  readonly hueShift?: number;
}

/** Shape connector kinds: geometric containers that signal relatedness. */
export type ConnectorKind =
  | 'blob' // closed organic container around a set of markers
  | 'hull' // convex hull, more mechanical look
  | 'arrow-fan' // arrows from one shared tail to each member
  | 'bracket' // under/over brace spanning a range
  | 'path' // polyline following pattern order (melodic shapes)
  | 'ring' // circle/ellipse centred on a pivot (symmetry views)
  | 'lattice'; // grid cells shaded (keyboard block views)

/** A semantic group: "these positions mean the same thing". */
export interface RelationGroup {
  readonly id: string;
  /** Human label drawn with the group (`III`, `b7 → V of IV`, ...). */
  readonly label: string;
  /** Legend colour / palette key. */
  readonly color: string;
  readonly kind: ConnectorKind;
  /** Positions belonging to the group — *semantic ids*, not pixel coordinates. */
  readonly members: readonly string[];
  /** Optional anchor position for arrow tails / ring centres. */
  readonly anchor?: string;
  /** Layer this group lives on (z ordering + visibility toggles). */
  readonly layer: string;
  /** Free-form metadata for tooltips and analysis panels. */
  readonly meta?: Record<string, string | number | boolean>;
}

/** One drawable marker at a position. */
export interface RenderMarker {
  readonly position: Position;
  readonly content: MarkerContent;
  /** Which pattern produced this marker (undefined for background dots). */
  readonly patternId?: string;
  /** Group ids this marker participates in (drives connectors). */
  readonly groups: readonly string[];
  readonly effect?: Effect;
  /** 0..1 opacity multiplier (used for ghost/duplicate positions). */
  readonly alpha?: number;
  /** Scale multiplier for emphasis. */
  readonly scale?: number;
}

/** A resolved connector ready for drawing. */
export interface RenderConnector {
  readonly group: RelationGroup;
  /** Concrete points, computed by the presenter from the layout geometry. */
  readonly points: readonly { x: number; y: number }[];
  readonly anchor?: { x: number; y: number };
}

/** A named stacking plane with independent visibility/opacity. */
export interface RenderLayer {
  readonly id: string;
  readonly name: string;
  /** Higher draws later (on top). */
  readonly z: number;
  readonly visible: boolean;
  readonly opacity: number;
  /** `'underlay'` layers sit behind the instrument body itself. */
  readonly role: 'underlay' | 'overlay' | 'surface';
}

/** Complete picture of what should be on screen. Serializable. */
export interface RenderFrame {
  readonly instrumentId: string;
  readonly width: number;
  readonly height: number;
  readonly layers: readonly RenderLayer[];
  readonly markers: readonly RenderMarker[];
  readonly connectors: readonly RenderConnector[];
  readonly palette: Palette;
  readonly mode: NotationMode;
  /** Presenter-specific hints for the renderer (grid metrics, labels). */
  readonly hints: Record<string, string | number | boolean>;
}

/** Input scene: everything a presenter needs, all declarative. */
export interface VisualizationScene {
  readonly instrument: Instrument;
  /** Patterns to display. Multiple entries produce multiple/overlaid views. */
  readonly patterns: readonly Pattern[];
  /** How each pattern should be labelled/coloured. */
  readonly modes?: readonly NotationMode[];
  /** Per-pattern opacity/emphasis. */
  readonly emphasis?: readonly number[];
  readonly palette?: Palette;
  readonly layers?: readonly RenderLayer[];
  /** Semantic relations to draw as connectors. Computed by core, authored by UI. */
  readonly groups?: readonly RelationGroup[];
  /** Default effect applied to root markers, etc. */
  readonly effects?: Partial<Record<'root' | 'member' | 'outside', Effect>>;
  /** Restrict the drawn window (frets 0-12, keys C3-C5, ...). */
  readonly window?: ViewWindow;
  /** Show positions that are not in any pattern. */
  readonly showBackground?: boolean;
  /** Include every candidate position for a pitch, or only the preferred one. */
  readonly includeAllCandidates?: boolean;
  /** Global size multiplier for pattern markers (dots AND their text). 1 = default. */
  readonly markerScale?: number;
}

export interface ViewWindow {
  readonly rowStart?: number;
  readonly rowEnd?: number;
  readonly colStart?: number;
  readonly colEnd?: number;
}

/** The presenter plug-in interface. */
export interface Presenter {
  readonly id: string;
  readonly name: string;
  /** Instruments this presenter knows how to lay out. */
  readonly accepts: readonly string[];
  /** Compute a frame. Must be pure and deterministic. */
  present(scene: VisualizationScene): RenderFrame;
}

/** Renderer plug-in interface (lives in the react package normally). */
export interface FrameRenderer {
  readonly id: string;
  readonly medium: 'svg' | 'canvas' | 'dom' | 'text';
  render(frame: RenderFrame): unknown;
}

/** Resolve the default layers when a scene doesn't specify them. */
export function defaultLayers(): RenderLayer[] {
  return [
    { id: 'underlay', name: 'Underlay', z: 0, visible: true, opacity: 1, role: 'underlay' },
    { id: 'body', name: 'Instrument', z: 10, visible: true, opacity: 1, role: 'surface' },
    { id: 'patterns', name: 'Patterns', z: 20, visible: true, opacity: 1, role: 'surface' },
    { id: 'connectors', name: 'Relations', z: 30, visible: true, opacity: 1, role: 'overlay' },
    { id: 'labels', name: 'Labels', z: 40, visible: true, opacity: 1, role: 'overlay' },
    { id: 'effects', name: 'Effects', z: 50, visible: true, opacity: 1, role: 'overlay' },
  ];
}

/** Pick a sensible default effect set for a scene. */
export function defaultEffects(): NonNullable<VisualizationScene['effects']> {
  return {
    root: { kind: 'glow', rate: 0.6, intensity: 0.8 },
    member: { kind: 'none' },
    outside: { kind: 'none' },
  };
}
