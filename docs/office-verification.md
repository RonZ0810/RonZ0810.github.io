# Office verification - 9 September 2026

The final implementation passed 5 ground-navigation unit tests, the production build, and all 37 Playwright tests using one worker. After small visual placement adjustments, the final build and four poster/performance checks also passed. GitHub runs the entire suite again against the committed source.

## Visual review

Built-in browser review covered 1440x900 desktop, 1024x768 tablet, 390x844 phone and 320x740 narrow phone: hallway entry, room-object navigation, monitor desktop, window hardware and scenery, upward fan view, switches and lighting, cable grommets and wall outlet, grounded furniture, panel scrolling/X controls, Contact and held sculpture rotation. No browser console errors were observed. Both fallback posters were regenerated from the final room.

## Performance snapshot

These are short samples of 24 browser animation-frame intervals per state on this Windows desktop with hardware Chromium. Phone dimensions use the same desktop hardware; these are not physical-phone benchmarks. Animation-frame callbacks measure browser responsiveness, not scene-render FPS. The fan-only renderer caps its update rate separately.

| Viewport | Fan stopped mean | Fan running mean | Running p95 | Last render submission | Fan render interval | Draw calls in sampled view | Recorded transfer | Estimate with refreshed poster |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1440x900 | 10.0 ms | 12.9 ms | 10.1 ms | 1.7 ms | 40.1 ms | 59 | 12.19 MB | 12.43 MB |
| 390x844 | 10.0 ms | 10.0 ms | 10.1 ms | 1.4 ms | 40.0 ms | 32 | 9.94 MB | 10.18 MB |

Transfers include the essential scene, full decorative models, sampled route requests and the loading poster. The estimate substitutes the refreshed poster size; it is not a second network measurement. JavaScript/CSS compression on the host can change transfer totals. Desktop screen artwork is generated locally at 1920x1080, mobile at 1024x576. No external image or operating-system service is requested.

## Rendering resilience

Windows uses full Chromium headless mode; Linux CI retains its previously working bundled headless shell. CI remains single-worker in the pinned Playwright container. Static meshes are batched by material. Software GPU backends use a maximum 0.65 pixel ratio, a 150,000-pixel framebuffer budget, 256px shadows and a 12 fps fan-only cap; hardware fan-only rendering is capped at 30 fps. Hidden tabs, blurred windows, stopped fans and offscreen fans do not keep unnecessary rendering active.

The first hosted run was stopped after its partial logs showed desktop software-GPU timeouts. The software framebuffer budget and platform-specific browser selection address the measured fill-rate cost; hardware-rendered visuals and test deadlines are unchanged.

After the software-rendering correction, the complete local suite passed again (37 browser tests in 1.7 minutes and all 5 unit tests).
