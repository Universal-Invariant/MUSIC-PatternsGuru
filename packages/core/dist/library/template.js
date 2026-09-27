/**
 * The pattern library: named shapes with no root attached.
 *
 * A {@link Template} is a `Pattern` with `root = 0`. Rooting it (`root()`) yields
 * a concrete pattern; enumerating all roots yields a family. Templates are the
 * unit that search, import/export, and user "my library" features operate on.
 */
import { createPattern, degreeLabelForStep, } from '../pattern.js';
import { pc } from '../pitch-class.js';
export function template(input) {
    const steps = [...new Set(input.steps.map(pc))].sort((a, b) => a - b);
    return {
        id: input.id,
        name: input.name,
        aliases: input.aliases ?? [],
        kind: input.kind,
        steps,
        degrees: input.degrees ?? steps.map((st) => [st, degreeLabelForStep(st)]),
        tags: input.tags ?? [],
        comment: input.comment,
        family: input.family,
    };
}
/** Attach a root to a template → concrete pattern. */
export function root(t, note = 0) {
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
/** All distinct rooted copies of a template. */
export function family(t) {
    const seen = new Set();
    const out = [];
    for (let n = 0; n < 12; n++) {
        const p = root(t, n);
        const key = p.steps.join(',');
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(p);
    }
    return out;
}
const SHARP_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export function rootLabel(n, preferFlats = false) {
    return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pc(n)] ?? '?';
}
/** Accept `C`, `c#`, `Eb`, `7`, or a pitch class number. */
export function parseRootShorthand(value) {
    if (typeof value === 'number')
        return pc(value);
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed))
        return pc(Number(trimmed));
    const table = {
        c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6,
        g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11, cb: 11, bs: 0,
    };
    const key = trimmed.toLowerCase().replace(/\u266F/g, '#').replace(/\u266D/g, 'b');
    if (key in table)
        return table[key];
    throw new TypeError(`Unrecognized root: ${JSON.stringify(value)}`);
}
//# sourceMappingURL=template.js.map