/**
 * Concrete instrument registry entries.
 *
 * Each export is a fully-formed `Instrument` built from the generic engines. The
 * web app and tests consume these directly; third-party plugins register their
 * own via {@link registerInstrument}.
 */
import type { Instrument } from '@mpg/core';
export declare const guitarStandard: Instrument;
export declare const bassStandard: Instrument;
export declare const mandolinStandard: Instrument;
export declare const guitarDropD: Instrument;
/** Built-in instruments keyed by id — the default plugin set. */
export declare const INSTRUMENTS: Record<string, Instrument>;
/** Register (or replace) an instrument plugin at runtime. */
export declare function registerInstrument(instrument: Instrument): void;
/** Look up a registered instrument by id. */
export declare function getInstrument(id: string): Instrument | undefined;
/** All registered instruments, for pickers. */
export declare function listInstruments(): Instrument[];
//# sourceMappingURL=index.d.ts.map