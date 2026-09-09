# First-person office

Run `npm run dev` for the local preview and `npm run build` for GitHub Pages output. `npm test -- --workers=1` runs ground-navigation unit tests, builds the site, and runs the browser suite. The published site uses local assets and has no backend.

CI uses the official Playwright container, pinned to version 1.61.1 and an image digest. Its browsers and OS dependencies are preinstalled; keep the image version aligned with the locked Playwright dependency. CI uses one browser worker for software WebGL rendering, 15-second asynchronous assertions, and a 60-second per-test limit. Failed runs upload traces, screenshots, and error context as `playwright-failures`.

## Explore

Home starts in the hallway facing the open office door. Enter office walks to the interior landing without changing the URL. Select the entrance/door to walk back outside, including when already on `/`. There is no top navigation in the 3D view. Explore objects opens an accessible directory of physical room objects.

- Focus the scene and use WASD to walk or strafe. Drag or use arrow keys to look.
- On phones, the left thumbstick moves and dragging the scene turns the view.
- Select an object or its accessible directory entry to walk to its standing viewpoint and read its section.
- Close the side panel or bottom sheet to resume walking. Read section reopens it without changing the URL or position.
- Lamp and Notebook controls walk to the desk when needed. Sculpture brings the object in front of the visitor for independent rotation. Done or Escape puts it back.
- Motion disables automatic travel and object animation; destinations remain valid standing locations. Deliberate walking and looking still work.
- Blur and hidden tabs clear held inputs and pause movement. Object states survive route navigation.

## Architecture

`src/walking.js` supplies a 0.2-metre A* grid with obstacles inflated by a 0.25-metre player radius. Segment validation smooths only clear paths, and substepped sliding prevents manual motion tunneling through walls or furniture. Colliders are explicit and independent of asynchronous model loading.

`src/scene-routes.js` defines standing positions and viewing targets. `src/scene.js` owns first-person control at a nominal 1.65-metre eye height with a maximum 1.2 cm walking bob and 60-degree vertical field of view. There is no camera orbit, roll, wall fading, or third-person transition.

`src/office-room.js` builds the enclosed office, hallway, ceiling, lighting, and garden. The garden is scenery, outside the walkable boundary. Shared instanced foliage and local shrub models provide parallax through the windows. Rendering continues while the ceiling fan rotates, and stops when otherwise settled, blurred, or hidden; static shadows are cached. Reduced motion stops decorative fan animation and walking bob. Hotspot occlusion is recalculated when the view changes rather than for each fan frame. Model textures are 1K; desktop wood color is 2K.

## Assets and fallback

Sources, licenses, and download checksums are in `public/office/sources.json` and `CREDITS.md`. Rebuild optimized models with:

```powershell
node scripts/fetch-office-assets.mjs
powershell -File scripts/optimize-office-assets.ps1
```

Raw downloads stay in `.cache/office`. glTF Transform 4.4.0 compresses geometry with meshopt and conservatively simplifies it while retaining source JPEG textures.

Failed models leave procedural stand-ins. Without JavaScript or WebGL, HTML content and links remain available with first-person posters. Browser tests save `hallway-poster.png`, `room-poster.png`, and desktop/mobile screenshots in `test-results`; reviewed posters are copied into `public/office` for shipping.

## Verification

Unit tests check every destination pair, doorway clearance, obstacle sliding, and invalid paths. Browser tests check standing height, entry and Home return, manual input, travel cancellation, panels and history, held-object inspection, touch movement, and fallback behavior. Review the built-in browser at desktop, tablet, and narrow-phone widths, including upward ceiling views and the garden windows.

Portfolio biography, project, school, and contact placeholders remain intentionally unfilled.

## Physical detail and controls

`src/office-details.js` adds original procedural window casements, seals, latches, insect screens, a Windows 11 style desktop, computer/USB/display/power wiring, an under-desk power strip, wall outlet, camera battery charger, contact business card, ceiling fan and two labelled wall switches. Desktop icons are visual only; the monitor opens Projects. Windows remain closed. Fan and ceiling light switches are independent and retain state during navigation.

All added textures are generated locally. Source and trademark notes are in `public/office/original-details.json`; imported CC0 assets retain their separate source manifest. The decorative desktop uses a fixed illustrative clock/date, with no live OS integration.

Main sections are accessed through objects. Detail cards remain inside reading panels. The X closes without changing URL/position; Escape does the same. Plain HTML retains the ordinary navigation when JavaScript or WebGL is unavailable. Movement help, contextual desk controls, motion preference, and the accessible object directory remain available without a persistent section navigation bar.

Walking velocity eases toward the requested speed and decays on release. Bob follows actual collision-resolved distance, never wall pushing. Input/velocity clear when the room loses focus or a panel/dialog opens. Tests expose nominal eye height separately from actual camera height.

Implementation policy: defer all test execution and browser verification until the complete change is ready for final verification. Run the full suite with one browser worker before delivery.

Final verification uses Playwright's full Chromium browser in its current headless mode (`channel: chromium`), with one worker. The older headless-shell software renderer stalled browser input during continuous WebGL animation on this Windows host. Software renderers receive a 0.65 pixel ratio and 256px shadows; hardware retains the desktop/mobile quality caps. Architectural meshes are batched by material while interactive objects and asset stand-ins retain their own geometry. Offscreen fans do not keep the renderer awake; fan-only rendering is capped at 30 fps (12 for software rendering).
