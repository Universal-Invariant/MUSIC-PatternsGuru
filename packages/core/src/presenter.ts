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
import { pc } from './pitch-class.js';
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
  /** Marker geometry (from the shape palette). Undefined = disc. */
  readonly shape?: MarkerShape;
}

/** Configurable note shapes (shape palette). */
export type MarkerShape = 'disc' | 'hexagon' | 'star' | 'octagon' | 'cloud' | 'diamond' | 'square';

export const MARKER_SHAPES: readonly MarkerShape[] = [
  'disc',
  'hexagon',
  'star',
  'octagon',
  'cloud',
  'diamond',
  'square',
] as const;

/**
 * Function-based shape assignment: instead of one uniform shape for every note,
 * shapes vary by tonal function — e.g. discs/circles for chord tones (1, 3, 5)
 * and squares for everything else. Keyed exactly like {@link Palette.degrees}
 * colour palettes: look up by canonical degree label (`b3`, `#4`…), falling
 * back to the semitone string (`0`…`11`), then disc. This same data model is
 * what the future customizable palette editor will read/write.
 */
export interface FunctionShapePalette {
  readonly id: string;
  readonly name: string;
  /** Degree-class → shape. */
  readonly degrees: Record<string, MarkerShape>;
  /** Duplicate/ghost positions (background dots). */
  readonly ghost: MarkerShape;
  /** Shape for notes whose degree class isn't listed (default: 'square'). */
  readonly default?: MarkerShape;
}

/** Resolve the shape for a degree label / step inside a function shape palette. */
export function shapeForStep(
  palette: FunctionShapePalette,
  degreeLabel: string | undefined,
  step: number,
): MarkerShape {
  if (degreeLabel) {
    const byDegree = palette.degrees[degreeLabel];
    if (byDegree) return byDegree;
  }
  // No usable degree label (blind/interval notations, or an unknown label):
  // try absolute pitch-class keys ('0'…'11') that a palette may explicitly
  // define — but only when the palette is actually keyed by pitch classes, so
  // numeric degree keys ('1', '5', …) are never mistaken for pcs. Degree keys
  // are relative to the pattern root; a raw step must not be coerced into one.
  const key = pc(step);
  const hasPcKeys = Object.keys(palette.degrees).some((k) => /^\d+$/.test(k) && Number(k) >= 8);
  if (hasPcKeys) {
    const byPc = palette.degrees[String(key)];
    if (byPc) return byPc;
  }
  return palette.default ?? 'square';
}

const ALL_DEGREE_KEYS = ['1', '2', 'b2', '3', 'b3', '4', '#4', '5', 'b5', '6', 'b6', '7', 'b7'];

function uniformShapes(shape: MarkerShape): Record<string, MarkerShape> {
  return Object.fromEntries(ALL_DEGREE_KEYS.map((d) => [d, shape]));
}

/** Built-in function-based shape palettes (the "shape palette" UI dropdown). */
export const FUNCTION_SHAPE_PALETTES: readonly FunctionShapePalette[] = [
  {
    id: 'uniform-disc',
    name: 'Uniform discs',
    degrees: uniformShapes('disc'),
    ghost: 'disc',
  },
  {
    id: 'chord-circle-rest-square',
    name: 'Chord tones = circles, rest = squares',
    // Classic triad members (1 3 b3 5 b5) stay round; tensions and altered
    // tones become squares so the eye separates "home" notes from "colour"
    // notes without reading any text.
    degrees: {
      '1': 'disc',
      '3': 'disc',
      'b3': 'disc',
      '5': 'disc',
      'b5': 'disc',
      '2': 'square',
      'b2': 'square',
      '4': 'square',
      '#4': 'square',
      '6': 'square',
      'b6': 'square',
      '7': 'square',
      'b7': 'square',
    },
    ghost: 'square',
  },
  {
    id: 'triad-hex-tension',
    name: 'Triad = discs, tensions = hexagons',
    degrees: {
      '1': 'disc',
      '3': 'disc',
      'b3': 'disc',
      '5': 'disc',
      'b5': 'disc',
      '2': 'hexagon',
      'b2': 'hexagon',
      '4': 'hexagon',
      '#4': 'hexagon',
      '6': 'hexagon',
      'b6': 'hexagon',
      '7': 'hexagon',
      'b7': 'hexagon',
    },
    ghost: 'disc',
  },
  {
    id: 'stability-star',
    name: 'Stable = discs, altered = stars',
    degrees: {
      '1': 'disc',
      '2': 'disc',
      '3': 'disc',
      '4': 'disc',
      '5': 'disc',
      '6': 'disc',
      '7': 'disc',
      'b2': 'star',
      'b3': 'star',
      '#4': 'star',
      'b5': 'star',
      'b6': 'star',
      'b7': 'star',
    },
    ghost: 'disc',
  },
  {
    id: 'per-degree',
    name: 'Distinct shape per degree',
    degrees: {
      '1': 'disc',
      '2': 'hexagon',
      'b2': 'octagon',
      '3': 'diamond',
      'b3': 'square',
      '4': 'star',
      '#4': 'cloud',
      '5': 'disc',
      'b5': 'octagon',
      '6': 'hexagon',
      'b6': 'square',
      '7': 'diamond',
      'b7': 'cloud',
    },
    ghost: 'disc',
  },
];

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
  /**
   * Box-pattern ("position") view: when set, pattern markers show EVERY
   * occurrence of each member pitch class inside this fret window — one note
   * per string within the box — instead of the default one-marker-per-pitch-class
   * selection. The presenter clips rendering to `window`, so this is a pure
   * "clip + fill the box" operation (classic CAGED patterns).
   */
  readonly fretWindow?: { colStart: number; colEnd: number };
  /** Show positions that are not in any pattern. */
  readonly showBackground?: boolean;
  /** Include every candidate position for a pitch, or only the preferred one. */
  readonly includeAllCandidates?: boolean;
  /** Global size multiplier for pattern markers (dots AND their text). 1 = default. */
  readonly markerScale?: number;
  /** Marker geometry palette: one shape per role. Undefined = all discs. */
  readonly shapes?: ShapePalette;
  /**
   * Function-based marker geometry: shape varies by tonal degree class (like a
   * colour palette). Takes precedence over {@link shapes} when present. This is
   * the data model the future customizable palette editor will read/write.
   */
  readonly functionShapes?: FunctionShapePalette;
}

/** Which shape each marker role gets. Mirrors the colour palettes. */
export interface ShapePalette {
  readonly root: MarkerShape;
  readonly member: MarkerShape;
  readonly ghost: MarkerShape;
}

export const SHAPE_PALETTES: ReadonlyArray<{ id: string; name: string; palette: ShapePalette }> = [
  { id: 'discs', name: 'Discs (classic)', palette: { root: 'disc', member: 'disc', ghost: 'disc' } },
  { id: 'hex', name: 'Hexagons', palette: { root: 'hexagon', member: 'hexagon', ghost: 'hexagon' } },
  { id: 'stars', name: 'Stars', palette: { root: 'star', member: 'disc', ghost: 'disc' } },
  { id: 'octa', name: 'Octagons', palette: { root: 'octagon', member: 'octagon', ghost: 'octagon' } },
  { id: 'clouds', name: 'Clouds', palette: { root: 'cloud', member: 'cloud', ghost: 'cloud' } },
  { id: 'diamonds', name: 'Diamonds', palette: { root: 'diamond', member: 'square', ghost: 'square' } },
];

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
