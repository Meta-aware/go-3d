# Go 3D — Weiqi / Baduk

A playable **3D Progressive Web App** for Go. Wooden board, lit stones with shadows, hotseat and a simple AI, plus interactive **Teach Me** lessons. Built with **Vite + TypeScript + Three.js**.

## Run locally

```bash
cd go-3d
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Install as a PWA

1. Open the app in a mobile browser (Chrome / Safari / Edge) or desktop Chrome.
2. Use **Add to Home Screen** / **Install app** from the browser menu.
3. Launch from the home screen for a fullscreen, offline-capable experience (service worker via `vite-plugin-pwa`).

Icons live under `public/icons/` (regenerate with `npm run icons`).

## Features

- **Rules engine** (separate from rendering): place on intersections, alternate turns, capture, no suicide unless capturing, simple ko, pass, resign, undo, Japanese territory + captures scoring with dead-stone marking.
- **Board sizes**: 9×9 (default), 13×13, 19×19.
- **3D scene**: wood texture board, grid, hoshi, shadowed stones, snap-to-intersection play, desktop hover highlight.
- **Camera modes** with smooth transitions + OrbitControls: Dramatic, Top, Piece, plus Reset.
- **Modes**: Local hotseat · vs liberty-aware AI · Teach Me (liberties, capture, atari, eyes) with board highlights.
- **UI**: turn indicator, captures, Pass / Resign / Undo / New, mode & size & camera selectors, optional coordinates.
- **PWA**: `manifest` + service worker, installable icons.

## Key files

| Path | Role |
|------|------|
| `src/engine/go.ts` | Rules, ko, scoring |
| `src/engine/ai.ts` | Heuristic AI |
| `src/render/GoScene.ts` | Three.js board & stones |
| `src/render/cameraRig.ts` | Camera poses & animation |
| `src/lessons/lessons.ts` | Teach Me content |
| `src/main.ts` | App wiring / UI |
| `vite.config.ts` | Build + PWA plugin |

## Notes / limitations

- AI is intentionally simple (liberty / capture heuristic), not strength-rated.
- Scoring is Japanese-style with manual dead-group marking after two passes; no automatic life-and-death solver.
- Multiplayer is local hotseat only (no online matchmaking).
- Best on devices with WebGL; very old browsers may struggle with shadows.

## License

Built as a local demo project. Go rules are traditional / public domain knowledge.
