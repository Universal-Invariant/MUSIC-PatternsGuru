/**
 * Generic fretted-instrument engine.
 *
 * One implementation covers 6-string guitar, bass, mandolin, ukulele, 7-string
 * extended-range guitars, and (with a `fretsPerString` cap) even bowed strings if
 * we ever want a fingerboard grid model. The engine is pure: it knows about
 * tunings, fret counts, and offsets — nothing about drawing.
 *
 * Coordinate convention (matches `@mpg/core` `Position`):
 *   row : string index, 0 = highest pitch (1st string / thinnest). Larger row ⇒
 *         lower-pitched string, so rows increase *downwards* on screen.
 *   col : fret number, 0 = open string. Larger col ⇒ higher pitch, rightwards.
 *
 * Preference ordering for `pitchToPositions` implements a simple, honest notion
 * of playability: prefer positions reachable with the fewest frets, break ties by
 * preferring lower-pitched strings (room to bend above), then by distance from a
 * reference centre position. This is what makes "one marker per note" views look
 * like a sane fingering rather than noise.
 */
import { type Instrument, type InstrumentLayout } from '@mpg/core';
export interface StringSpec {
    /** MIDI number of the open string. */
    readonly openMidi: number;
    /** Short label used in position ids/labels (`E`, `A`, `D`, ...). */
    readonly name: string;
}
export interface FrettedConfig {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
    /** Ordered high → low (e.g. standard guitar: [E4, B3, G3, D3, A2, E2]). */
    readonly strings: readonly StringSpec[];
    readonly numFrets: number;
    /** Nut offset in semitones (0 normally; capos/banjo 5th-string can use it). */
    readonly nutOffset?: number;
    readonly layout?: Partial<InstrumentLayout>;
    /** Reference centre used for preference ordering, as `[row, col]`. */
    readonly centre?: readonly [number, number];
}
/** Standard 6-string guitar tuning, high → low. */
export declare const STANDARD_TUNING: readonly StringSpec[];
/** Common alternate tunings, exposed for the UI's tuning picker. */
export declare const GUITAR_TUNINGS: Record<string, readonly StringSpec[]>;
export declare const BASS_TUNING: readonly StringSpec[];
export declare const MANDOLIN_TUNING: readonly StringSpec[];
/** Build an {@link Instrument} from a fretted configuration. Pure + memoized. */
export declare function createFrettedInstrument(config: FrettedConfig): Instrument;
/** Convenience: human-readable note name for a MIDI number (sharps). */
export declare function midiLabel(midi: number): string;
//# sourceMappingURL=fretted.d.ts.map