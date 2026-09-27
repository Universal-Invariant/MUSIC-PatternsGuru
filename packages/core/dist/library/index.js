/**
 * The pattern library: named, root-less templates plus the computed harmony that
 * makes "chords within scales / scales containing chords" possible.
 */
export * from './template.js';
export * from './scales.js';
export * from './chords.js';
export * from './keys.js';
export * from './harmony.js';
import { createPattern } from '../pattern.js';
import { pc } from '../pitch-class.js';
import { CHORD_TEMPLATES } from './chords.js';
import { SCALE_TEMPLATES } from './scales.js';
import { parseRootShorthand, rootLabel } from './template.js';
/** Every template in the library (scales + chords), for search UIs. */
export const ALL_TEMPLATES = [...SCALE_TEMPLATES, ...CHORD_TEMPLATES];
/** Look a template up by id, name, alias, or chord symbol (`m7`, `dorian`). */
export function findTemplate(query) {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    return ALL_TEMPLATES.find((t) => t.id.toLowerCase() === q ||
        t.name.toLowerCase().replace(/\s+/g, '') === q ||
        t.aliases.some((a) => a.toLowerCase().replace(/\s+/g, '') === q));
}
/**
 * Parse free-text pattern queries used by the search box.
 *
 *   "D dorian"          → rooted scale
 *   "Gb maj7#11"        → rooted chord
 *   "harmonic minor"    → unrooted (C-rooted) scale
 *   "7"                 → root shorthand only → chromatic-ish fallback rejected
 */
export function parsePatternQuery(query) {
    const trimmed = query.trim();
    if (!trimmed)
        return undefined;
    // Try "<root> <template>" first.
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
        const head = parts[0];
        const rest = parts.slice(1).join(' ');
        let rootPc;
        try {
            if (/^[A-Ga-g][#b\u266F\u266D]*$/.test(head))
                rootPc = parseRootShorthand(head);
        }
        catch {
            rootPc = undefined;
        }
        if (rootPc !== undefined) {
            const t = findTemplate(rest);
            if (t)
                return rootTemplateAt(t, rootPc);
        }
    }
    const single = findTemplate(trimmed);
    if (single)
        return rootTemplateAt(single, 0);
    return undefined;
}
/** Root a template at a pitch class, with a human-readable name. */
export function rootTemplateAt(t, note) {
    const r = typeof note === 'number' ? pc(note) : parseRootShorthand(note);
    return createPattern({
        id: `${t.id}@${r}`,
        name: `${rootLabel(r)} ${t.name}`,
        kind: t.kind,
        root: r,
        steps: t.steps,
        degrees: t.degrees,
        tags: t.tags,
        source: 'library',
        comment: t.comment,
    });
}
//# sourceMappingURL=index.js.map