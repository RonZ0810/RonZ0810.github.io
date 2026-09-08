# Asset credits

The office combines original Three.js architecture, furniture, printed artwork, and animated props with these local Poly Haven assets, all licensed **CC0-1.0**:

- [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) — glTF, 1K textures.
- [Camera 01](https://polyhaven.com/a/Camera_01) — glTF, 1K textures.
- [Potted Plant 01](https://polyhaven.com/a/potted_plant_01) — glTF, 1K textures.
- [Wood Floor](https://polyhaven.com/a/wood_floor) — color, normal, and roughness maps at 1K and 2K.

The complete download URLs, byte sizes, and checksums are in `public/office/sources.json`. `node scripts/fetch-office-assets.mjs` verifies source downloads into `.cache/office`; `powershell -File scripts/optimize-office-assets.ps1` produces the shipped GLB files with meshopt compression and conservative mesh simplification. Source JPEG textures remain unchanged. Only wood color uses 2K on desktop; normal and roughness maps use 1K on all devices. The room poster is a render of this scene. Outfit remains self-hosted under OFL-1.1. No tracking or audio is added to the portfolio.

Poly Haven's license: https://polyhaven.com/license. The pinball game retains its own asset and dependency credits.
