# Interactive office

Run `npm run dev` for the local preview, `npm run build` for GitHub Pages output, and `npm test -- --workers=1` for the full Playwright suite. There is no backend and the deployed site makes no third-party asset requests.

CI uses one Playwright worker because hosted runners render WebGL in software. Asynchronous assertions have a 15-second CI timeout; the 60-second per-test limit and all behavioral checks remain in place. Failed runs upload browser traces, screenshots, and error context as the `playwright-failures` artifact.

## Controls

- Drag to orbit; touch users drag horizontally and scroll vertically.
- Focus the room and use arrow keys to rotate, `+` / `-` to zoom, or `Home` to reset.
- Select the notebook, monitor, framed timeline, school books, or camera to open a portfolio section.
- The toolbar controls the lamp and notebook. Select Sculpture to inspect and rotate it independently; Done or Escape returns to room controls.
- Motion disables camera travel, damping, and object animations. The system reduced-motion setting is honored by default. Object states survive enhanced route navigation; a fresh page load resets them.
- The header remains visible while reading. Desktop sculpture inspection uses the full scene area and temporarily hides the welcome text. Camera travel completes when the room scrolls offscreen, keeping the reading view free of stale motion controls.

## Implementation

`src/office-room.js` builds the architecture, materials, lighting, and actionable props. It loads local models after the essential wood maps settle. `src/scene.js` owns interaction, camera transitions, wall fading, and resource cleanup; `src/scene-routes.js` supplies route camera presets. `src/main.js` retains the static-route navigation and accessible HTML controls.

The renderer is event driven: it stops when settled, offscreen, or in a hidden tab. Static shadows are cached; asset replacement and relevant object changes refresh them. Desktop wood color uses 2K, while mobile color and all normal/roughness maps use 1K. Models have 1K textures on every device.

## Assets and recovery

Source URLs and checksums are in `public/office/sources.json`, with license notes in `CREDITS.md`. To regenerate the optimized models:

```powershell
node scripts/fetch-office-assets.mjs
powershell -File scripts/optimize-office-assets.ps1
```

Downloads are verified and raw models are kept outside the published output in `.cache/office`. The optimization command pins glTF Transform 4.4.0, uses meshopt compression, retains source JPEG textures, and conservatively simplifies geometry.

Failed model downloads leave detailed procedural stand-ins. JavaScript or WebGL failure leaves a static room poster and normal HTML links. The screenshot test captures a fresh poster and desktop/mobile QA images under `test-results`; the shipped poster is `public/office/room-poster.png`.

The existing biography, project, school, and contact placeholders still need real portfolio content.

## Visual and performance checks

Desktop QA uses a 1440 × 1000 viewport; mobile QA uses 390 × 844 with touch enabled. The recorded desktop sample measured a 16.7 ms median animation-frame interval after a keyboard orbit and 9.8 MB of transferred office assets, including the poster. This is a short local-browser sample, not a guarantee for every device or network. `tests/office.spec.js` writes the measurements and screenshots into `test-results` for inspection.
