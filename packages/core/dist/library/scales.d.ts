/**
 * Scale templates. Degrees are expressed relative to the major scale's natural
 * degrees (1 2 3 4 5 6 7), so `b3`/`#4` style labels fall out automatically and
 * stay consistent with chord degree labels in tonal notation.
 */
import { type Template } from './template.js';
export declare const SCALE_TEMPLATES: readonly Template[];
/** Quick lookup by id or alias (case-insensitive). */
export declare function findScaleTemplate(query: string): Template | undefined;
//# sourceMappingURL=scales.d.ts.map