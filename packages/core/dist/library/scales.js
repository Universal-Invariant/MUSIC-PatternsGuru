/**
 * Scale templates. Degrees are expressed relative to the major scale's natural
 * degrees (1 2 3 4 5 6 7), so `b3`/`#4` style labels fall out automatically and
 * stay consistent with chord degree labels in tonal notation.
 */
import { template } from './template.js';
const S = (id, name, steps, degrees, extra = {}) => template({ id, name, kind: 'scale', steps, degrees, ...extra });
export const SCALE_TEMPLATES = [
    // ---- Heptatonic / church modes of the major scale -------------------------
    S('ionian', 'Ionian (Major)', [0, 2, 4, 5, 7, 9, 11], [[0, '1'], [2, '2'], [4, '3'], [5, '4'], [7, '5'], [9, '6'], [11, '7']], {
        aliases: ['major', 'Major scale'],
        tags: ['mode', 'diatonic', 'major'],
        family: 'major',
        comment: 'The reference diatonic collection.',
    }),
    S('aeolian', 'Aeolian (Natural Minor)', [0, 2, 3, 5, 7, 8, 10], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [10, 'b7']], {
        aliases: ['natural minor', 'minor'],
        tags: ['mode', 'diatonic', 'minor'],
        family: 'major',
    }),
    S('dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [9, '6'], [10, 'b7']], {
        tags: ['mode', 'diatonic', 'minor', 'jazz'],
        family: 'major',
        comment: 'Minor with a raised 6th — the default minor vamp sound.',
    }),
    S('phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10], [[0, '1'], [1, 'b2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [10, 'b7']], {
        tags: ['mode', 'diatonic', 'minor', 'flamenco'],
        family: 'major',
    }),
    S('lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11], [[0, '1'], [2, '2'], [4, '3'], [6, '#4'], [7, '5'], [9, '6'], [11, '7']], {
        tags: ['mode', 'diatonic', 'major'],
        family: 'major',
    }),
    S('mixolydian', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10], [[0, '1'], [2, '2'], [4, '3'], [5, '4'], [7, '5'], [9, '6'], [10, 'b7']], {
        tags: ['mode', 'diatonic', 'major', 'blues', 'rock'],
        family: 'major',
    }),
    S('locrian', 'Locrian', [0, 1, 3, 5, 6, 8, 10], [[0, '1'], [1, 'b2'], [3, 'b3'], [5, '4'], [6, 'b5'], [8, 'b6'], [10, 'b7']], {
        tags: ['mode', 'diatonic', 'diminished'],
        family: 'major',
    }),
    // ---- Melodic / harmonic minor --------------------------------------------
    S('melodic-minor', 'Melodic Minor (Jazz)', [0, 2, 3, 5, 7, 9, 11], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [9, '6'], [11, '7']], {
        aliases: ['jazz minor', 'ascending melodic minor'],
        tags: ['minor', 'jazz'],
        family: 'melodic-minor',
    }),
    S('melodic-minor-classic', 'Melodic Minor (Classic)', [0, 2, 3, 5, 7, 9, 11], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [9, '6'], [11, '7']], {
        tags: ['minor', 'classical'],
        family: 'melodic-minor',
        comment: 'Ascending form; descending uses Aeolian. Both share this pc set.',
    }),
    S('harmonic-minor', 'Harmonic Minor', [0, 2, 3, 5, 7, 8, 11], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']], {
        tags: ['minor', 'classical', 'neoclassical'],
        family: 'harmonic-minor',
    }),
    S('double-harmonic', 'Double Harmonic (Byzantine)', [0, 1, 4, 5, 7, 8, 11], [[0, '1'], [1, 'b2'], [4, '3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']], {
        aliases: ['byzantine', 'arabic-hijaz-kar', 'gypsy-major'],
        tags: ['major', 'middle-eastern', 'balkan'],
        family: 'harmonic-minor',
    }),
    S('neapolitan-major', 'Neapolitan Major', [0, 1, 2, 5, 7, 9, 11], [[0, '1'], [1, 'b2'], [3, 'b3'], [5, '4'], [7, '5'], [9, '6'], [11, '7']], {
        tags: ['minor'],
        family: 'harmonic-minor',
    }),
    S('neapolitan-minor', 'Neapolitan Minor', [0, 1, 2, 5, 7, 8, 11], [[0, '1'], [1, 'b2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']], {
        tags: ['minor'],
        family: 'harmonic-minor',
    }),
    S('ukrainian-dorian', 'Ukrainian Dorian', [0, 2, 3, 6, 7, 9, 10], [[0, '1'], [2, '2'], [3, 'b3'], [6, '#4'], [7, '5'], [9, '6'], [10, 'b7']], {
        aliases: ['romanian-minor', 'dorian-sharp-4'],
        tags: ['folk', 'eastern-european'],
        family: 'harmonic-minor',
    }),
    // ---- Pentatonic ----------------------------------------------------------
    S('major-pentatonic', 'Major Pentatonic', [0, 2, 4, 7, 9], [[0, '1'], [2, '2'], [4, '3'], [7, '5'], [9, '6']], {
        aliases: ['hiyama-bushi'],
        tags: ['pentatonic', 'major', 'folk', 'blues'],
        family: 'pentatonic',
    }),
    S('minor-pentatonic', 'Minor Pentatonic', [0, 3, 5, 7, 10], [[0, '1'], [3, 'b3'], [5, '4'], [7, '5'], [10, 'b7']], {
        aliases: ['ritusen'],
        tags: ['pentatonic', 'minor', 'blues', 'rock'],
        family: 'pentatonic',
    }),
    S('suspended-pentatonic', 'Suspended Pentatonic', [0, 2, 5, 7, 10], [[0, '1'], [2, '2'], [5, '4'], [7, '5'], [10, 'b7']], {
        aliases: ['egyptian', 'kumoi'],
        tags: ['pentatonic'],
        family: 'pentatonic',
    }),
    S('blues', 'Blues Scale (Minor)', [0, 3, 5, 6, 7, 10], [[0, '1'], [3, 'b3'], [5, '4'], [6, 'b5'], [7, '5'], [10, 'b7']], {
        aliases: ['bebop-blues'],
        tags: ['hexatonic', 'blues', 'jazz'],
        family: 'blues',
    }),
    S('major-blues', 'Major Blues Scale', [0, 2, 3, 4, 7, 9], [[0, '1'], [2, '2'], [3, 'b3'], [4, '3'], [7, '5'], [9, '6']], {
        tags: ['hexatonic', 'blues'],
        family: 'blues',
    }),
    // ---- Whole-tone / chromatic / symmetric ----------------------------------
    S('whole-tone', 'Whole Tone', [0, 2, 4, 6, 8, 10], [[0, '1'], [2, '2'], [4, '3'], [6, '#4'], [8, '#5'], [10, 'b7']], {
        tags: ['symmetric', 'hexatonic', 'debussy', 'augmented'],
        family: 'symmetric',
        comment: 'Only two distinct transpositions; every rotation is the same set.',
    }),
    S('chromatic', 'Chromatic', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [[0, '1'], [1, 'b2'], [2, '2'], [3, 'b3'], [4, '3'], [5, '4'], [6, 'b5'], [7, '5'], [8, 'b6'], [9, '6'], [10, 'b7'], [11, '7']], {
        tags: ['total'],
        family: 'symmetric',
    }),
    S('halftone-whole', 'Half-Whole Diminished', [0, 1, 3, 4, 6, 7, 9, 10], [[0, '1'], [1, 'b2'], [3, 'b3'], [4, '3'], [6, '#4'], [7, '5'], [9, '6'], [10, 'b7']], {
        aliases: ['diminished-half-whole'],
        tags: ['octatonic', 'symmetric', 'diminished', 'jazz'],
        family: 'octatonic',
    }),
    S('whole-halftone', 'Whole-Half Diminished', [0, 2, 3, 5, 6, 8, 9, 11], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [6, 'b5'], [7, '5'], [8, 'b6'], [11, '7']], {
        aliases: ['diminished-whole-half'],
        tags: ['octatonic', 'symmetric', 'diminished'],
        family: 'octatonic',
    }),
    S('messiaen-3', 'Messiaen Mode 3', [0, 2, 3, 4, 6, 7, 8, 10], [[0, '1'], [2, '2'], [3, 'b3'], [4, '3'], [6, '#4'], [7, '5'], [9, '6'], [10, 'b7']], {
        tags: ['octatonic', 'modes-of-limited-transposition'],
        family: 'messiaen',
    }),
    S('messiaen-4', 'Messiaen Mode 4', [0, 1, 2, 5, 6, 7, 8, 11], [[0, '1'], [1, 'b2'], [2, '2'], [5, '4'], [6, 'b5'], [7, '5'], [8, 'b6'], [11, '7']], {
        tags: ['octatonic', 'modes-of-limited-transposition'],
        family: 'messiaen',
    }),
    S('messiaen-5', 'Messiaen Mode 5', [0, 1, 5, 6, 7, 10, 11], [[0, '1'], [1, 'b2'], [5, '4'], [6, 'b5'], [7, '5'], [10, 'b7'], [11, '7']], {
        tags: ['heptatonic', 'modes-of-limited-transposition'],
        family: 'messiaen',
    }),
    S('leading-whole-tone', 'Leading Whole Tone', [0, 1, 3, 5, 7, 9, 11], [[0, '1'], [1, 'b2'], [3, 'b3'], [4, 'b4'], [6, 'b5'], [8, 'b6'], [10, 'b7']], {
        tags: ['heptatonic', 'symmetric'],
        family: 'symmetric',
    }),
    S('augmented', 'Augmented Scale', [0, 1, 4, 5, 8, 9], [[0, '1'], [1, 'b2'], [4, '3'], [5, '4'], [8, '#5'], [9, '6']], {
        tags: ['hexatonic', 'symmetric', 'augmented'],
        family: 'symmetric',
    }),
    S('prometheus', 'Prometheus', [0, 2, 4, 6, 9, 10], [[0, '1'], [2, '2'], [4, '3'], [6, '#4'], [9, '6'], [10, 'b7']], {
        aliases: ['skriabin'],
        tags: ['hexatonic'],
        family: 'symmetric',
    }),
    S('tristan', 'Tristan Chord Scale', [0, 4, 6, 9], [[0, '1'], [4, '3'], [6, 'b5'], [9, '6']], {
        tags: ['tetraclonic', 'wagner'],
        family: 'symmetric',
    }),
    // ---- World / folk collections -------------------------------------------
    S('hirajoshi', 'Hirajoshi', [0, 2, 3, 7, 8], [[0, '1'], [2, '2'], [3, 'b3'], [7, '5'], [8, 'b6']], {
        tags: ['pentatonic', 'japanese'],
        family: 'world',
    }),
    S('in-sen', 'In Sen', [0, 1, 5, 7, 10], [[0, '1'], [1, 'b2'], [5, '4'], [7, '5'], [10, 'b7']], {
        tags: ['pentatonic', 'japanese'],
        family: 'world',
    }),
    S('iwato', 'Iwato', [0, 1, 5, 6, 10], [[0, '1'], [1, 'b2'], [5, '4'], [6, 'b5'], [10, 'b7']], {
        tags: ['pentatonic', 'japanese'],
        family: 'world',
    }),
    S('yo', 'Yo', [0, 2, 5, 7, 9], [[0, '1'], [2, '2'], [5, '4'], [7, '5'], [9, '6']], {
        tags: ['pentatonic', 'japanese'],
        family: 'world',
    }),
    S('inseni', 'Ni Ren Zhi Gong (Chinese)', [0, 3, 5, 8, 10], [[0, '1'], [3, 'b3'], [5, '4'], [8, 'b6'], [10, 'b7']], {
        tags: ['pentatonic', 'chinese'],
        family: 'world',
    }),
    S('hijaz', 'Hijaz', [0, 1, 4, 5, 7, 8, 11], [[0, '1'], [1, 'b2'], [4, '3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']], {
        tags: ['maqam', 'middle-eastern'],
        family: 'world',
    }),
    S('nahawand', 'Nahawand', [0, 2, 3, 5, 7, 8, 11], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']], {
        tags: ['maqam', 'middle-eastern'],
        family: 'world',
    }),
    S('kurd', 'Kurd', [0, 1, 3, 5, 7, 8, 10], [[0, '1'], [1, 'b2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [10, 'b7']], {
        tags: ['maqam', 'middle-eastern'],
        family: 'world',
    }),
    S('hijaz-kar', 'Hijaz Kar', [0, 1, 4, 5, 7, 8, 11], [[0, '1'], [1, 'b2'], [4, '3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']], {
        tags: ['maqam', 'middle-eastern'],
        family: 'world',
    }),
    S('andalusian', 'Andalusian', [0, 1, 3, 5, 7, 8, 11], [[0, '1'], [1, 'b2'], [3, 'b3'], [5, '4'], [7, '5'], [8, 'b6'], [11, '7']], {
        aliases: ['spanish-flamenco'],
        tags: ['flamenco'],
        family: 'world',
    }),
    S('hungarian-minor', 'Hungarian Minor', [0, 2, 3, 6, 7, 8, 11], [[0, '1'], [2, '2'], [3, 'b3'], [6, '#4'], [7, '5'], [8, 'b6'], [11, '7']], {
        tags: ['minor', 'folk'],
        family: 'world',
    }),
    S('hungarian-major', 'Hungarian Major', [0, 2, 3, 6, 7, 9, 10], [[0, '1'], [2, '2'], [3, 'b3'], [6, '#4'], [7, '5'], [9, '6'], [10, 'b7']], {
        tags: ['major', 'folk'],
        family: 'world',
    }),
    S('enigmatic', 'Enigmatic', [0, 1, 4, 6, 8, 9, 11], [[0, '1'], [1, 'b2'], [4, '3'], [6, '#4'], [8, '#5'], [8, 'b6'], [11, '7']], {
        tags: ['verdi', 'rare'],
        family: 'world',
    }),
    S('persian', 'Persian', [0, 1, 4, 5, 6, 8, 11], [[0, '1'], [1, 'b2'], [4, '3'], [5, '4'], [6, 'b5'], [8, 'b6'], [11, '7']], {
        tags: ['middle-eastern'],
        family: 'world',
    }),
    S('locrian-natural-9', 'Locrian Natural 9', [0, 2, 3, 5, 6, 8, 10], [[0, '1'], [2, '2'], [3, 'b3'], [5, '4'], [6, 'b5'], [8, 'b6'], [10, 'b7']], {
        tags: ['mode', 'jazz'],
        family: 'major',
    }),
];
/** Quick lookup by id or alias (case-insensitive). */
export function findScaleTemplate(query) {
    const q = query.trim().toLowerCase();
    return SCALE_TEMPLATES.find((t) => t.id === q || t.name.toLowerCase() === q || t.aliases.some((a) => a.toLowerCase() === q));
}
//# sourceMappingURL=scales.js.map