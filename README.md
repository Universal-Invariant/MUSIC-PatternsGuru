# 🎸 MUSIC-PatternsGuru

**A visual mental-model trainer for musicians.**

Playing an instrument is, at its core, a *visualization* process: the musician carries
a living map of the instrument in their mind — where pitches live, how they relate,
what shapes mean — and articulates music by navigating that map. MUSIC-PatternsGuru
(MPG) exists to help you **build, explore, and refine that map**.

MPG renders musical patterns — scales, arpeggios, chords, modes, intervals, chord
relations, tonal functions — directly onto faithful visualizations of real
instruments: guitar fretboards, piano keyboards, flute key charts, trumpet valving,
violin and cello fingerboards, mandolins, basses, and anything else you can plug in.

It is **not** a notation engraver and **not** a DAW. It is a *theory explorer and
vocabulary trainer*: the goal is understanding, not output.

---

## ✨ What it does (today)

### The pattern universe
- A unified **Pattern** abstraction covers scales, chords, arpeggios, modes, pitch
  class sets, and melodic fragments — all modeled as ordered subsets of 12-tone
  pitch space with full algebra: transposition (Tₙ), inversion (Iₙ), modal rotation,
  normal order, symmetry detection, intersection / union / difference.
- A growing **library**: ~45 scale templates (major/minor families, modes, melodic &
  harmonic minor, diminished whole-tone, pentatonics, blues, bebop, Messiaen, maqam
  flavors, folk modes…) and ~40 chord types (triads through extended/altered/sus
  voicings), each searchable by name or shorthand (`m7`, `dorian`, `lydian dom`…).
- **Free-text search**: type `"D dorian"`, `"Gb maj7#11"`, `"harmonic minor"` and get
  a rooted pattern instantly.
- **Computed diatonic harmony**: given any scale, derive its diatonic chords with
  Roman-numeral analysis and function labels; given any chord, find which scales
  contain it. Chord⇄scale navigation in both directions.

### Four ways to label what you see
| Mode | What's on the marker | Use it for |
|---|---|---|
| **Blind** | nothing — only position | pure spatial memory training |
| **Interval** | `b3`, `5`, `maj7` … relative to root | ear-training & shape recognition |
| **Letter** | `C`, `D♯`, `A♭` … key-aware spelling | note-name fluency |
| **Tonal** | color-coded by harmonic function | seeing *meaning*, not just names |

Spelling is diatonically honest: in G major you get F♯, in F major you get E♭ —
the engine keeps letter-space and semitone-space separate (the un-quotiented side
of pitch) and resolves them per key.

### Instruments as plugins (the adjunction)
An instrument is formally a **lossy mapping between pitch space and position
space**, and MPG models it as an adjunction:

```
pitchToPositions(p)  : one pitch → many candidate positions (fingers are ambiguous!)
positionToPitch(pos) : one position → exactly one sounding pitch
```

The `Instrument` contract exposes range, layout geometry, capabilities (polyphony,
bends, microtonality…), and preference-ordered candidates so "show me this Cmaj7"
can render as a *sane fingering* rather than noise. Adding an instrument never
touches the theory layer.

**Working now:** a generic fretted-instrument engine driving **guitar (standard &
drop-D), bass, and mandolin**, with a fretboard presenter and SVG renderer.

### Visualization & presentation layer
- **Presenter architecture**: business logic emits a declarative `VisualizationScene`;
  presenters compile scenes into `RenderFrame`s (markers, connectors, layers); dumb
  renderers (SVG today) draw frames. You can retarget the same scene to canvas,
  WebGL, print, or a terminal without touching theory code.
- **Layers**: overlay / underlay organization (pattern fill, root emphasis, chord
  tones, grid background, connectors…) with independent toggles — no coordinate
  bookkeeping required to say *"these notes belong together."*
- **Relations & connectors**: semantic groups rendered as blobs, arrows-with-shared-
  tail, and geometric containers that signal functional belonging.
- **Effects vocabulary**: glow, fire, throb, blink, pulse, sweep — declared in the
  scene, realized by the renderer.
- **Multi-pattern views**: stack several patterns on one board, or show multiple
  boards side-by-side for comparison and overlap/difference study.

### The playground app
`web/` hosts a Vite + React playground wired to the whole pipeline: pick an
instrument, root, scale, optional chord and comparison scale; switch notation mode
and palette; toggle diatonic-chord display, connectors, effects, fret window, and
density. This is the prototype you can run right now.

---

## 🧱 Architecture

```
┌────────────────────────────────────────────────────────────┐
│  web/  (Vite + React playground)                           │
├────────────────────────────────────────────────────────────┤
│  packages/react     @mpg/react                             │
│    presenters/  scene → RenderFrame (pure, testable)       │
│    FrameSvg     dumb SVG renderer (effects, connectors)    │
│    scene.ts     user-intent → VisualizationScene builder   │
├────────────────────────────────────────────────────────────┤
│  packages/instruments  @mpg/instruments                    │
│    fretted.ts   generic string/fret engine (plugin pack)   │
├────────────────────────────────────────────────────────────┤
│  packages/core      @mpg/core  (zero dependencies, pure TS)│
│    pitch-class  Z/12Z algebra: pc, Tₙ, Iₙ, interval class  │
│    spelling     letter + alteration (diatonic truth)       │
│    interval     2-D intervals (semitones × letter steps)   │
│    pattern      scales/chords/modes/sets + algebra         │
│    notation     blind / interval / letter / tonal + palettes│
│    instrument   the pitch ⇄ position adjunction contract   │
│    presenter    scene → frame model, layers, effects       │
│    relations    semantic grouping without coordinates      │
│    library      templates + computed diatonic harmony      │
└────────────────────────────────────────────────────────────┘
```

**The cardinal rule:** dependency arrows point *downward only*. `@mpg/core` knows
nothing about instruments, React, or the DOM. Instrument plugins know nothing about
rendering. Renderers know nothing about music. This is what makes the system
extensible in every direction at once.

## 📁 Repository layout

```
packages/core           # theory engine (published-ready, framework-free)
packages/instruments    # instrument plugin packs (fretted engine today)
packages/react          # presenters + SVG renderer + scene builder
web                     # Vite/React playground app
docs                    # VitePress documentation site
examples                # headless usage examples (Node scripts)
```

## 🚀 Getting started

Requires **Node ≥ 20**.

```bash
npm install          # install all workspaces
npm run dev          # start the playground → http://localhost:5173
```

Other useful commands:

```bash
npm run build        # build every workspace package + the web app
npm run typecheck    # strict TypeScript build across all packages
npm test             # run the vitest suite
npm run docs         # local VitePress docs server
```

Windows users: double-click `build.cmd` (or run it from a terminal) to install
dependencies, type-check, test, and build everything in one shot.

## 🔮 Future direction

**Instruments**
- Keyboard presenter (piano/organ): full key geometry, black/white topology,
  two-hand regions, per-octave shading.
- Wind presenters: flute key-chart (Boehm), trumpet valve-combination diagrams
  including partial series and alternate fingerings, clarinet register logic.
- Bowed-string presenters: violin/viola/cello fingerboards with position-letters,
  string crossings, and thumb position — plus *cross-instrument translation views*
  (see a pattern on guitar **and** violin simultaneously to learn how shapes carry).

**Theory depth**
- Key relationships: circle-of-fifths navigator, modulation targets, pivot-chord
  search, secondary dominants and tritone subs computed over any scale.
- Chord-progression mode: roman-numeral sequences visualized as animated journeys
  across the board (ii–V–I in every region of the fretboard).
- Melody input: enter/select a melody and see its pitch content, contour, and
  scale-membership mapped onto the instrument.
- MIDI file playback overlay ("follow the notes on the board") at a later stage.

**Visualization**
- Animated effect realization (CSS/SMIL/WebGL) for glow/fire/throb/blink/pulse.
- Richer connector geometry: convex hulls, minimum spanning blobs, arrow bundles.
- Dark/light themes, printable sheet export (PNG/SVG/PDF) of any view.
- Optional notation strip using a free SMuFL font — *display only*; we will not
  write a full engraver.

**Product surfaces**
- Hosted web app (this repo builds straight to static hosting).
- PWA/offline mode; Android APK via Capacitor wrapper.
- Practice tooling: spaced-repetition drills driven by the blind-mode visualizer,
  "name that tone" games, session tracking.
- Plugin SDK so the community can publish instrument packs and pattern libraries.

## ⚖️ License

See [LICENSE.md](./LICENSE.md).

---

*Built with the belief that music theory is something you should be able to*
***see***.
