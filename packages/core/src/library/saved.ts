/**
 * User library: saveable, shareable scale/chord definitions.
 *
 * Design goal (request #2): a single generic record shape so future fields
 * (fingering, voicing, display overrides, tags, ...) can be added WITHOUT
 * touching the save/load routine. The envelope is versioned; unknown fields
 * are preserved verbatim through round-trips because we store the raw JSON of
 * each item rather than re-serializing from a fixed class.
 */

import { template, type Template } from './template.js';
import type { DegreeAnnotation } from '../pattern.js';

export const SAVED_LIBRARY_FORMAT = 'mpg-library';
export const SAVED_LIBRARY_VERSION = 1;

/** One saved pattern. `kind` + `steps` are the core; everything else is optional data. */
export interface SavedPattern {
  /** Stable unique id (user namespace; prefixed to avoid clashing with built-ins). */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** 'scale' | 'chord' | any future kind — treated generically. */
  readonly kind: string;
  /** Semitone offsets from root (the essential definition). */
  readonly steps: readonly number[];
  /** Optional degree labels (bare labels or [semitone, label] pairs, like built-in templates). */
  readonly degrees?: readonly DegreeAnnotation[];
  readonly aliases?: readonly string[];
  readonly tags?: readonly string[];
  readonly family?: string;
  readonly comment?: string;
  /** Root offset used when this entry is selected in the UI (0-based pitch class). */
  readonly rootOffset?: number;
  /**
   * Escape hatch for forward compatibility: any extra fields written by newer
   * versions survive here and are re-emitted on export untouched.
   */
  readonly extra?: Record<string, unknown>;
}

export interface SavedLibraryFile {
  readonly format: typeof SAVED_LIBRARY_FORMAT;
  readonly version: number;
  readonly exportedAt?: string;
  readonly patterns: readonly SavedPattern[];
}

/** Convert a built-in or ad-hoc Template into a storable record. */
export function savedFromTemplate(t: Template, rootOffset = 0): SavedPattern {
  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    steps: [...t.steps],
    degrees: t.degrees.map((d) => (typeof d === 'string' ? d : ([d[0], d[1]] as const))),
    aliases: [...t.aliases],
    tags: [...t.tags],
    family: t.family,
    comment: t.comment,
    rootOffset,
  };
}

/** Rebuild a renderable Template from a stored record (lossless for core fields). */
export function templateFromSaved(s: SavedPattern): Template {
  return template({
    id: s.id,
    name: s.name,
    kind: s.kind as Parameters<typeof template>[0]['kind'],
    steps: s.steps,
    degrees: s.degrees,
    aliases: s.aliases,
    tags: s.tags,
    family: s.family,
    comment: s.comment,
  });
}

let counter = 0;
/** Generate a fresh user-namespace id that cannot collide with built-ins. */
export function newSavedId(kind: string): string {
  counter += 1;
  return `user:${kind}:${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Validate + normalize an arbitrary parsed JSON blob into a library file. Throws on bad input. */
export function parseSavedLibrary(json: string): SavedPattern[] {
  const data = JSON.parse(json) as Partial<SavedLibraryFile> & { patterns?: unknown };
  // Accept both a full envelope and a bare array (friends may paste either).
  const raw = Array.isArray(data) ? data : data.patterns;
  if (!Array.isArray(raw)) throw new Error('Not a MPG library file (missing "patterns" array)');
  const out: SavedPattern[] = [];
  for (const item of raw) {
    const p = item as Partial<SavedPattern>;
    if (typeof p?.name !== 'string' || !Array.isArray(p.steps)) continue;
    const known = new Set(['id', 'name', 'kind', 'steps', 'degrees', 'aliases', 'tags', 'family', 'comment', 'rootOffset']);
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (!known.has(k)) extra[k] = v;
    out.push({
      id: typeof p.id === 'string' ? p.id : newSavedId(String(p.kind ?? 'scale')),
      name: p.name,
      kind: typeof p.kind === 'string' ? p.kind : 'scale',
      steps: p.steps.filter((n) => typeof n === 'number'),
      degrees: p.degrees as SavedPattern['degrees'],
      aliases: p.aliases,
      tags: p.tags,
      family: p.family,
      comment: p.comment,
      rootOffset: typeof p.rootOffset === 'number' ? p.rootOffset : undefined,
      extra: Object.keys(extra).length ? extra : undefined,
    });
  }
  if (!out.length) throw new Error('No valid scale/chord entries found');
  return out;
}

/** Serialize entries to a shareable JSON envelope (unknown `extra` fields preserved). */
export function exportSavedLibrary(patterns: readonly SavedPattern[]): string {
  const file: SavedLibraryFile = {
    format: SAVED_LIBRARY_FORMAT,
    version: SAVED_LIBRARY_VERSION,
    exportedAt: new Date().toISOString(),
    patterns: patterns.map((p) => ({ ...p, ...(p.extra ?? {}) })),
  };
  return JSON.stringify(file, null, 2);
}
