/**
 * The presenter contract.
 *
 * A presenter is the layer between "what to show" and "how to draw it". It takes
 * a {@link VisualizationScene} (pure data: instrument + patterns + notation +
 * effects + layers) and produces a {@link RenderFrame} (also pure data: markers,
 * shapes, connectors). A *renderer* then turns a frame into SVG/Canvas/DOM/WebGL.
 *
 * Why three layers instead of two?
 *   - Presenters are testable without a browser and reusable across renderers
 *     (the same fretboard presenter feeds both the SVG view and the WebGL view).
 *   - Renderers can be swapped for platform targets (web, Canvas, native via
 *     Skia, terminal) without touching music logic.
 *   - Frames are serializable, which gives us PNG/SVG export, snapshot testing,
 *     and server-side rendering for free.
 */
/** Resolve the default layers when a scene doesn't specify them. */
export function defaultLayers() {
    return [
        { id: 'underlay', name: 'Underlay', z: 0, visible: true, opacity: 1, role: 'underlay' },
        { id: 'body', name: 'Instrument', z: 10, visible: true, opacity: 1, role: 'surface' },
        { id: 'patterns', name: 'Patterns', z: 20, visible: true, opacity: 1, role: 'surface' },
        { id: 'connectors', name: 'Relations', z: 30, visible: true, opacity: 1, role: 'overlay' },
        { id: 'labels', name: 'Labels', z: 40, visible: true, opacity: 1, role: 'overlay' },
        { id: 'effects', name: 'Effects', z: 50, visible: true, opacity: 1, role: 'overlay' },
    ];
}
/** Pick a sensible default effect set for a scene. */
export function defaultEffects() {
    return {
        root: { kind: 'glow', rate: 0.6, intensity: 0.8 },
        member: { kind: 'none' },
        outside: { kind: 'none' },
    };
}
//# sourceMappingURL=presenter.js.map