/**
 * @mpg/react — the visualization end of MUSIC-PatternsGuru.
 *
 * Two halves:
 *   presenters/  pure scene → RenderFrame logic (no React; testable in Node)
 *   components   dumb SVG renderer that only knows frames + hints
 *   scene.ts     ergonomic builder from user intent to VisualizationScene
 */
export * from './presenters/fretboard.js';
export * from './scene.js';
export { FrameSvg } from './FrameSvg.js';
//# sourceMappingURL=index.js.map