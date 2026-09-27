/**
 * The pattern library: named shapes with no root attached.
 *
 * A {@link Template} is a `Pattern` with `root = 0`. Rooting it (`root()`) yields
 * a concrete pattern; enumerating all roots yields a family. Templates are the
 * unit that search, import/export, and user "my library" features operate on.
 */
import { type DegreeAnnotation, type Pattern, type PatternKind } from '../pattern.js';
import { type PitchClass } from '../pitch-class.js';
export interface Template {
    readonly id: string;
    readonly name: string;
    readonly aliases: readonly string[];
    readonly kind: PatternKind;
    readonly steps: readonly number[];
    /**
     * Degree annotation per step. Accepts bare labels (`['1', 'b3', '5']`) or
     * `[semitonesAboveRoot, label]` pairs (the pairing keeps a label such as `'9'`
     * attached to its own octave placement when steps are normalized/sorted).
     */
    readonly degrees: readonly DegreeAnnotation[];
    readonly tags: readonly string[];
    readonly comment?: string;
    /** Family grouping used by the UI (`major`, `harmonic-minor`, ...). */
    readonly family?: string;
}
export declare function template(input: {
    id: string;
    name: string;
    kind: PatternKind;
    steps: readonly number[];
    degrees?: readonly DegreeAnnotation[];
    aliases?: readonly string[];
    tags?: readonly string[];
    comment?: string;
    family?: string;
}): Template;
/** Attach a root to a template → concrete pattern. */
export declare function root(t: Template, note?: PitchClass | string): Pattern;
/** All distinct rooted copies of a template. */
export declare function family(t: Template): Pattern[];
export declare function rootLabel(n: PitchClass, preferFlats?: boolean): string;
/** Accept `C`, `c#`, `Eb`, `7`, or a pitch class number. */
export declare function parseRootShorthand(value: string | number): PitchClass;
//# sourceMappingURL=template.d.ts.map