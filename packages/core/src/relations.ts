/**
 * Relations: the vocabulary for saying "these things are connected" without
 * ever naming pixel coordinates.
 *
 * This module exists because the hardest part of a rich visualizer is not
 * drawing dots — it is expressing that *this* set of positions belongs to *that*
 * chord, or that this note here and that note over there are the same function in
 * two different keys. We model that with semantic groups keyed by position id.
 *
 * Every relation returns {@link RelationGroup}s whose `members` are instrument
 * position ids. The presenter later resolves those ids into geometry. Nothing in
 * this file knows anything about layout, which means every relation here works on
 * every instrument, including instruments that do not exist yet.
 */

import type { Instrument } from './instrument.js';
import type { Pattern } from './pattern.js';
import type { RelationGroup, ConnectorKind } from './presenter.js';
import { patternPcs } from './pattern.js';
import { pc, pcAdd, pcSub, type PitchClass } from './pitch-class.js';
import { TONAL_PALETTE } from './notation.js';
import { chordsWithinScale, diatonicSevenths, type DiatonicChord } from './library/harmony.js';

export interface RelationOptions {
  /** Layer id the resulting groups should live on. */
  readonly layer?: string;
  /** Only include groups with at least this many visible members. */
  readonly minMembers?: number;
  /** Connector style override. */
  readonly kind?: ConnectorKind;
  /**
   * When set, relation membership is restricted to positions inside this fret
   * window (columns). This is what makes chord-in-scale underlays agree with a
   * box-pattern view: every group only ever contains notes you can actually see.
   */
  readonly window?: { readonly colStart: number; readonly colEnd: number };
}

/** True when `cand` passes the optional window filter of {@link RelationOptions}. */
function inWindow(
  cand: { position: { col: number } },
  window?: { colStart: number; colEnd: number },
): boolean {
  if (!window) return true;
  return cand.position.col >= window.colStart && cand.position.col <= window.colEnd;
}

/** Positions on an instrument where any member of `pattern` appears. */
export function positionsForPattern(
  instrument: Instrument,
  pattern: Pattern,
  options: {
    includeAllCandidates?: boolean;
    /** Restrict to a fret window (columns) so groups agree with box views. */
    window?: { colStart: number; colEnd: number };
  } = {},
): string[] {
  const out: string[] = [];
  for (const candidate of candidatesForPattern(instrument, pattern, options)) {
    out.push(candidate);
  }
  return [...new Set(out)];
}

/** Same as {@link positionsForPattern}, exposed for presenters needing detail. */
export function candidatesForPattern(
  instrument: Instrument,
  pattern: Pattern,
  options: {
    includeAllCandidates?: boolean;
    window?: { colStart: number; colEnd: number };
  } = {},
): string[] {
  const out: string[] = [];
  for (const p of patternPcs(pattern)) {
    for (const cand of instrument.pitchClassToPositions(p)) {
      if (!inWindow(cand, options.window)) continue;
      // Inside a window every occurrence is meaningful (each string shows the
      // note at its own fret), so we keep all in-window candidates regardless
      // of the global "preferred" ranking, which is computed fretboard-wide.
      if (!options.includeAllCandidates && !cand.preferred) continue;
      out.push(cand.position.id);
    }
  }
  return out;
}

/** One group per pattern, labelled with its name. The simplest useful view. */
export function patternGroups(
  instrument: Instrument,
  patterns: readonly Pattern[],
  options: RelationOptions = {},
): RelationGroup[] {
  const layer = options.layer ?? 'patterns';
  const groups: RelationGroup[] = [];
  patterns.forEach((p, i) => {
    const members = positionsForPattern(instrument, p, {
      includeAllCandidates: false,
      window: options.window,
    });
    if (members.length < (options.minMembers ?? 1)) return;
    groups.push({
      id: `pattern:${p.id}`,
      label: p.name,
      color: TONAL_PALETTE.degrees[String(pc(i))] ?? TONAL_PALETTE.root,
      kind: options.kind ?? 'blob',
      members,
      layer,
      meta: { root: p.root, kind: p.kind, steps: p.steps.join(',') },
    });
  });
  return groups;
}

/**
 * Overlap/difference analysis between two patterns on one instrument. Produces
 * three groups: shared tones, only-in-A, only-in-B. This is what powers the
 * "compare scales" and "what's new in Dorian vs Aeolian" views.
 */
export function overlapGroups(
  instrument: Instrument,
  a: Pattern,
  b: Pattern,
  options: RelationOptions = {},
): RelationGroup[] {
  const layer = options.layer ?? 'connectors';
  const setA = new Set(patternPcs(a));
  const setB = new Set(patternPcs(b));
  const shared = [...setA].filter((x) => setB.has(x));
  const onlyA = [...setA].filter((x) => !setB.has(x));
  const onlyB = [...setB].filter((x) => !setA.has(x));

  const posOf = (pcs: Iterable<PitchClass>) => {
    const ids: string[] = [];
    for (const p of pcs) {
      for (const c of instrument.pitchClassToPositions(p)) {
        if (!inWindow(c, options.window)) continue;
        // Windowed views show every in-window occurrence (the box pattern);
        // unwindowed views use the canonical (preferred) one only. The
        // window-aware instrument clone already flags exactly those.
        if (!c.preferred) continue;
        ids.push(c.position.id);
      }
    }
    return ids;
  };

  const groups: RelationGroup[] = [];
  if (shared.length) {
    groups.push({
      id: `overlap:${a.id}&${b.id}`,
      label: `${a.name} ∩ ${b.name}`,
      color: '#ffffff',
      kind: 'hull',
      members: posOf(shared),
      layer,
      meta: { count: shared.length },
    });
  }
  if (onlyA.length) {
    groups.push({
      id: `diff:${a.id}-${b.id}`,
      label: `only in ${a.name}`,
      color: TONAL_PALETTE.degrees['2']!,
      kind: 'bracket',
      members: posOf(onlyA),
      layer,
    });
  }
  if (onlyB.length) {
    groups.push({
      id: `diff:${b.id}-${a.id}`,
      label: `only in ${b.name}`,
      color: TONAL_PALETTE.degrees['4']!,
      kind: 'bracket',
      members: posOf(onlyB),
      layer,
    });
  }
  return groups;
}

/**
 * Chord-tone groups inside a scale view: for each diatonic chord of `scale`, a
 * group containing the positions of its members. With `arrow-fan` connectors this
 * becomes the classic "chords hidden in the scale" picture.
 *
 * Membership is window-aware: when `options.window` is set, only positions
 * inside that fret window join a chord — so the underlay always agrees with the
 * notes actually visible on screen (the box pattern). The chord's root position
 * is preferred as the group anchor so labels sit on the bass note.
 */
export function chordInScaleGroups(
  instrument: Instrument,
  scale: Pattern,
  options: RelationOptions & { size?: number } = {},
): RelationGroup[] {
  const layer = options.layer ?? 'connectors';
  const chords: DiatonicChord[] =
    options.size === 3 ? diatonicTriadsOnly(scale) : chordsWithinScale(scale);
  const groups: RelationGroup[] = [];
  for (const c of chords) {
    // On windowed (box-pattern) instruments every in-window occurrence is
    // flagged preferred, so the default filter already clips correctly. On a
    // plain instrument with an explicit window we keep all in-window candidates.
    const includeAll = !!options.window;
    const members = positionsForPattern(instrument, c.pattern, {
      window: options.window,
      includeAllCandidates: includeAll,
    });
    if (members.length < (options.minMembers ?? 1)) continue;
    // Anchor on the chord's own root position (lowest-string occurrence) so the
    // label lands where a player reads the chord from.
    const rootPc = pcAdd(c.pattern.root, 0);
    let anchor: string | undefined;
    for (const cand of instrument.pitchClassToPositions(rootPc)) {
      if (!inWindow(cand, options.window)) continue;
      if (includeAll || cand.preferred) {
        if (members.includes(cand.position.id)) {
          anchor = cand.position.id;
          break;
        }
      }
    }
    groups.push({
      id: `chord:${scale.id}:${c.degree}`,
      label: `${c.numeral} · ${c.symbol}`,
      color: TONAL_PALETTE.degrees[String(pc(c.degree - 1))] ?? TONAL_PALETTE.outside,
      kind: options.kind ?? 'blob',
      members,
      anchor: anchor ?? members[0],
      layer,
      meta: { degree: c.degree, numeral: c.numeral, symbol: c.symbol },
    });
  }
  return groups;
}

function diatonicTriadsOnly(scale: Pattern): DiatonicChord[] {
  return chordsWithinScale(scale).filter((c) => c.pattern.steps.length === 3);
}

/**
 * Same-function-across-keys: all positions playing pitch class `target`, grouped
 * by which key/pattern they belong to. Used for "show me every b7 everywhere".
 */
export function functionGroups(
  instrument: Instrument,
  target: PitchClass,
  patterns: readonly Pattern[],
  options: RelationOptions = {},
): RelationGroup[] {
  const layer = options.layer ?? 'connectors';
  const groups: RelationGroup[] = [];
  for (const p of patterns) {
    const rel = pcSub(pc(target), p.root);
    if (!p.steps.includes(rel)) continue;
    const members = instrument
      .pitchClassToPositions(pc(target))
      .filter((c) => c.preferred)
      .map((c) => c.position.id);
    if (!members.length) continue;
    groups.push({
      id: `fn:${p.id}:${rel}`,
      label: `${degreeNameOf(rel)} of ${p.name}`,
      color: TONAL_PALETTE.degrees[String(rel)] ?? TONAL_PALETTE.root,
      kind: options.kind ?? 'arrow-fan',
      members,
      anchor: members[0],
      layer,
      meta: { step: rel, parent: p.name },
    });
  }
  return groups;
}

function degreeNameOf(step: number): string {
  const labels = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  return labels[pc(step)] ?? '?';
}

/**
 * Cross-instrument correspondence: given two instruments, group positions that
 * carry the same pitch class. This is what makes "translate this guitar shape to
 * violin" legible — the shared colour/label across two layouts *is* the mapping.
 */
export function crossInstrumentGroups(
  left: Instrument,
  right: Instrument,
  pattern: Pattern,
  options: RelationOptions = {},
): RelationGroup[] {
  const layer = options.layer ?? 'connectors';
  const groups: RelationGroup[] = [];
  patternPcs(pattern).forEach((p, i) => {
    const l = left
      .pitchClassToPositions(p)
      .filter((c) => c.preferred)
      .map((c) => `L:${c.position.id}`);
    const r = right
      .pitchClassToPositions(p)
      .filter((c) => c.preferred)
      .map((c) => `R:${c.position.id}`);
    const members = [...l, ...r];
    if (members.length < 2) return;
    groups.push({
      id: `x:${pattern.id}:${i}`,
      label: degreeNameOf(pcSub(p, pattern.root)),
      color: TONAL_PALETTE.degrees[String(pcSub(p, pattern.root))] ?? TONAL_PALETTE.root,
      kind: options.kind ?? 'arrow-fan',
      members,
      layer,
      meta: { pc: p },
    });
  });
  return groups;
}

/**
 * Intervallic symmetry axes: for symmetric collections, group positions related
 * by inversion about each axis. Reveals why whole-tone/diminished shapes repeat.
 */
export function symmetryGroups(
  instrument: Instrument,
  pattern: Pattern,
  options: RelationOptions = {},
): RelationGroup[] {
  const layer = options.layer ?? 'connectors';
  const groups: RelationGroup[] = [];
  const members = new Set(patternPcs(pattern));
  for (let axis = 0; axis < 12; axis++) {
    let invariant = true;
    for (const m of members) {
      if (!members.has(pc(pcAdd(axis, -m)))) {
        invariant = false;
        break;
      }
    }
    if (!invariant) continue;
    const pairs: string[] = [];
    for (const m of members) {
      const inv = pc(pcAdd(axis, -m));
      for (const c of instrument.pitchClassToPositions(m)) if (c.preferred) pairs.push(c.position.id);
      if (inv !== m) {
        for (const c of instrument.pitchClassToPositions(inv)) if (c.preferred) pairs.push(c.position.id);
      }
    }
    groups.push({
      id: `sym:${pattern.id}:${axis}`,
      label: `inversion axis ${degreeNameOf(axis)}`,
      color: TONAL_PALETTE.degrees[String(axis)] ?? '#8899aa',
      kind: 'ring',
      members: [...new Set(pairs)],
      layer,
      meta: { axis },
    });
  }
  return groups;
}

/** Cycle-of-fifths ordering groups: adjacent-fifth clusters within a pattern. */
export function fifthsChainGroups(
  instrument: Instrument,
  pattern: Pattern,
  options: RelationOptions = {},
): RelationGroup[] {
  const layer = options.layer ?? 'connectors';
  const order = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; // circle of fifths from C
  const members = new Set(patternPcs(pattern));
  const groups: RelationGroup[] = [];
  for (let start = 0; start < 12; start++) {
    const chain: string[] = [];
    let chainPcs: PitchClass[] = [];
    for (let k = 0; k < 12; k++) {
      const rootOfChain = pcAdd(pattern.root, order[(start + k) % 12]!);
      if (!members.has(rootOfChain)) break;
      chainPcs.push(rootOfChain);
      for (const c of instrument.pitchClassToPositions(rootOfChain)) {
        if (c.preferred) chain.push(c.position.id);
      }
    }
    if (chain.length >= 3) {
      groups.push({
        id: `fifths:${pattern.id}:${start}`,
        label: `fifths chain ${chainPcs.map((x) => degreeNameOf(pcSub(x, pattern.root))).join(' → ')}`,
        color: TONAL_PALETTE.degrees[String(pc(start))] ?? '#aabbcc',
        kind: 'path',
        members: chain,
        layer,
      });
    }
  }
  return groups;
}

/** Union several relation sets, de-duplicating by group id. */
export function mergeGroups(...sets: readonly RelationGroup[][]): RelationGroup[] {
  const map = new Map<string, RelationGroup>();
  for (const set of sets) for (const g of set) if (!map.has(g.id)) map.set(g.id, g);
  return [...map.values()];
}

/** Restrict groups to positions inside a window (used when zooming/cropping). */
export function filterGroupsByPositions(
  groups: readonly RelationGroup[],
  allowed: ReadonlySet<string>,
): RelationGroup[] {
  return groups
    .map((g) => ({ ...g, members: g.members.filter((m) => allowed.has(stripSide(m))) }))
    .filter((g) => g.members.length > 0);
}

function stripSide(id: string): string {
  const i = id.indexOf(':');
  return i >= 0 ? id.slice(i + 1) : id;
}
