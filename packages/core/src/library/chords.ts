/**
 * Chord / arpeggio templates.
 *
 * Degrees are labelled against the major scale so `m7` = `1 b3 5 b7` and a
 * dominant `7` = `1 3 5 b7`. That single convention is what makes tonal notation
 * (coloring by function) work uniformly across scales and chords: a `b7` is the
 * same colour whether it came from Mixolydian or from G7 in C.
 */

import { template, type Template } from './template.js';
import type { DegreeAnnotation } from '../pattern.js';

const C = (
  id: string,
  name: string,
  symbol: string,
  steps: readonly number[],
  degrees: readonly DegreeAnnotation[],
  extra: Partial<Parameters<typeof template>[0]> = {},
): Template =>
  template({
    id,
    name,
    kind: 'chord',
    steps,
    degrees,
    aliases: [symbol],
    tags: ['chord', ...(extra.tags ?? [])],
    ...extra,
  });

export const CHORD_TEMPLATES: readonly Template[] = [
  // ---- Triads ---------------------------------------------------------------
  C('maj', 'Major Triad', '', [0, 4, 7], [[0, '1'], [4, '3'], [7, '5']], { family: 'triad', tags: ['triad', 'consonant'] }),
  C('min', 'Minor Triad', 'm', [0, 3, 7], [[0, '1'], [3, 'b3'], [7, '5']], { family: 'triad', tags: ['triad', 'consonant'] }),
  C('dim', 'Diminished Triad', 'dim', [0, 3, 6], [[0, '1'], [3, 'b3'], [6, 'b5']], { family: 'triad', tags: ['triad', 'dissonant'] }),
  C('aug', 'Augmented Triad', 'aug', [0, 4, 8], [[0, '1'], [4, '3'], [8, '#5']], { family: 'triad', tags: ['triad', 'symmetric'] }),
  C('sus2', 'Suspended Second', 'sus2', [0, 2, 7], [[0, '1'], [2, '2'], [7, '5']], { family: 'suspended' }),
  C('sus4', 'Suspended Fourth', 'sus4', [0, 5, 7], [[0, '1'], [5, '4'], [7, '5']], { family: 'suspended' }),
  C('power', 'Power Chord (Fifth)', '5', [0, 7], [[0, '1'], [7, '5']], { family: 'triad', tags: ['rock'] }),
  C('six-add9', 'Six Add Nine', '6/9', [0, 4, 7, 9, 14], [[0, '1'], [4, '3'], [7, '5'], [9, '6'], [14, '9']], { family: 'extended' }),

  // ---- Sevenths -------------------------------------------------------------
  C('maj7', 'Major Seventh', 'maj7', [0, 4, 7, 11], [[0, '1'], [4, '3'], [7, '5'], [11, '7']], { family: 'seventh' }),
  C('dom7', 'Dominant Seventh', '7', [0, 4, 7, 10], [[0, '1'], [4, '3'], [7, '5'], [10, 'b7']], { family: 'seventh' }),
  C('min7', 'Minor Seventh', 'm7', [0, 3, 7, 10], [[0, '1'], [3, 'b3'], [7, '5'], [10, 'b7']], { family: 'seventh' }),
  C('m7b5', 'Half-Diminished', 'm7b5', [0, 3, 6, 10], [[0, '1'], [3, 'b3'], [6, 'b5'], [10, 'b7']], {
    aliases: ['ø7', 'min7b5'],
    family: 'seventh',
  }),
  C('dim7', 'Fully Diminished Seventh', 'dim7', [0, 3, 6, 9], ['1', 'b3', 'b5', 'bb7'], {
    family: 'seventh',
    tags: ['symmetric', 'dissonant'],
    comment: 'Symmetric: only three distinct transpositions.',
  }),
  C('mmaj7', 'Minor-Major Seventh', 'mMaj7', [0, 3, 7, 11], [[0, '1'], [3, 'b3'], [7, '5'], [11, '7']], { family: 'seventh' }),
  C('maj7s5', 'Major Seventh Sharp Five', 'maj7#5', [0, 4, 8, 11], [[0, '1'], [4, '3'], [8, '#5'], [11, '7']], { family: 'seventh' }),
  C('7sus4', 'Seventh Suspending Fourth', '7sus4', [0, 5, 7, 10], [[0, '1'], [5, '4'], [7, '5'], [10, 'b7']], { family: 'suspended' }),
  C('add9', 'Add Nine', 'add9', [0, 4, 7, 14], [[0, '1'], [4, '3'], [7, '5'], [14, '9']], { family: 'extended' }),
  C('madd9', 'Minor Add Nine', 'm(add9)', [0, 3, 7, 14], [[0, '1'], [3, 'b3'], [7, '5'], [14, '9']], { family: 'extended' }),
  C('69', 'Six Nine', '6/9', [0, 4, 7, 9, 14], [[0, '1'], [4, '3'], [7, '5'], [9, '6'], [14, '9']], { family: 'extended' }),
  C('m6', 'Minor Sixth', 'm6', [0, 3, 7, 9], [[0, '1'], [3, 'b3'], [7, '5'], [9, '6']], { family: 'extended' }),

  // ---- Ninths ---------------------------------------------------------------
  C('maj9', 'Major Ninth', 'maj9', [0, 4, 7, 11, 14], [[0, '1'], [4, '3'], [7, '5'], [11, '7'], [14, '9']], { family: 'ninth' }),
  C('dom9', 'Dominant Ninth', '9', [0, 4, 7, 10, 14], [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [14, '9']], { family: 'ninth' }),
  C('min9', 'Minor Ninth', 'm9', [0, 3, 7, 10, 14], [[0, '1'], [3, 'b3'], [7, '5'], [10, 'b7'], [14, '9']], { family: 'ninth' }),
  C('m9b5', 'Half-Diminished Ninth', 'm9b5', [0, 3, 6, 10, 14], [[0, '1'], [3, 'b3'], [6, 'b5'], [10, 'b7'], [14, '9']], { family: 'ninth' }),
  C('dim9', 'Diminished Ninth', 'dim9', [0, 3, 6, 9, 14], ['1', 'b3', 'b5', 'bb7', '9'], { family: 'ninth' }),
  C('7b9', 'Dominant Flat Nine', '7b9', [0, 4, 7, 10, 13], [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [13, 'b9']], { family: 'altered' }),
  C('7#9', 'Dominant Sharp Nine (Hendrix)', '7#9', [0, 4, 7, 10, 15], [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [15, '#9']], {
    family: 'altered',
    tags: ['rock', 'jazz'],
  }),
  C('7sus9', 'Seventh Suspending Ninth', '7sus9', [0, 5, 7, 10, 14], [[0, '1'], [5, '4'], [7, '5'], [10, 'b7'], [14, '9']], {
    family: 'suspended',
  }),

  // ---- Elevenths ------------------------------------------------------------
  C('min11', 'Minor Eleventh', 'm11', [0, 3, 7, 10, 14, 17], [[0, '1'], [3, 'b3'], [7, '5'], [10, 'b7'], [14, '9'], [17, '11']], {
    family: 'eleventh',
  }),
  C('dom11', 'Dominant Eleventh', '11', [0, 4, 7, 10, 14, 17], [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [14, '9'], [17, '11']], {
    family: 'eleventh',
  }),
  C('maj11', 'Major Eleventh', 'maj11', [0, 4, 7, 11, 14, 17], [[0, '1'], [4, '3'], [7, '5'], [11, '7'], [14, '9'], [17, '11']], {
    family: 'eleventh',
  }),
  C('m11b5', 'Half-Diminished Eleventh', 'm11b5', [0, 3, 6, 10, 14, 17], [[0, '1'], [3, 'b3'], [6, 'b5'], [10, 'b7'], [14, '9'], [17, '11']], {
    family: 'eleventh',
  }),

  // ---- Thirteenths / altered dominants ---------------------------------------
  C('maj13', 'Major Thirteenth', 'maj13', [0, 4, 7, 11, 14, 21], [[0, '1'], [4, '3'], [7, '5'], [11, '7'], [14, '9'], [21, '13']], {
    family: 'thirteenth',
  }),
  C('dom13', 'Dominant Thirteenth', '13', [0, 4, 7, 10, 14, 21], [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [14, '9'], [21, '13']], {
    family: 'thirteenth',
  }),
  C('13b9', 'Thirteen Flat Nine', '13b9', [0, 4, 7, 10, 13, 21], [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [13, 'b9'], [21, '13']], {
    family: 'altered',
  }),
  C('7b9b5', 'Seven Flat Nine Flat Five', '7b9b5', [0, 4, 6, 10, 13], [[0, '1'], [4, '3'], [6, 'b5'], [10, 'b7'], [13, 'b9']], {
    family: 'altered',
  }),
  C('7#9#5', 'Seven Sharp Nine Sharp Five', '7#9#5', [0, 4, 8, 10, 15], [[0, '1'], [4, '3'], [8, '#5'], [10, 'b7'], [15, '#9']], {
    family: 'altered',
  }),
  C('alt', 'Altered Dominant', '7alt', [0, 3, 6, 9, 10, 13, 15], ['1', 'b3', 'b5', 'bb7', 'b7', 'b9', '#9'], {
    family: 'altered',
    tags: ['jazz', 'symmetric-source'],
    comment: 'Super-Locrian collection — all available tensions flattened/sharpened.',
  }),
  C('lydian-dominant', 'Lydian Dominant', '7#11', [0, 4, 6, 7, 10, 14], [[0, '1'], [4, '3'], [18, '#11'], [7, '5'], [10, 'b7'], [14, '9']], {
    family: 'altered',
    tags: ['jazz', 'melodic-minor-4'],
  }),

  // ---- Quartals / modern ----------------------------------------------------
  C('quartal3', 'Quartal Trichord', 'Q3', [0, 5, 10], [[0, '1'], [5, '4'], [10, 'b7']], {
    family: 'modern',
    tags: ['quartal', 'so-what'],
    comment: 'Stack of perfect fourths — the "So What" voicing cell.',
  }),
  C('quartal4', 'Quartal Tetrachord', 'Q4', [0, 5, 10, 15], [[0, '1'], [5, '4'], [10, 'b7'], [16, '10']], {
    family: 'modern',
    tags: ['quartal'],
  }),
  C('second-cluster', 'Tone Cluster (Seconds)', 'cluster', [0, 1, 2, 3], [[0, '1'], [1, 'b2'], [2, '2'], [3, 'b3']], {
    family: 'modern',
    tags: ['cluster', 'dissonant'],
  }),
];

/** Lookup by symbol-ish query (`m7`, `maj7#5`, `dim`). */
export function findChordTemplate(query: string): Template | undefined {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  return CHORD_TEMPLATES.find(
    (t) =>
      t.id === q ||
      t.name.toLowerCase().replace(/\s+/g, '') === q ||
      t.aliases.some((a) => a.toLowerCase().replace(/\s+/g, '') === q),
  );
}
