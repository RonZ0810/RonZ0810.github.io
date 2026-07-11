# FLIPSTRIKE

FLIPSTRIKE is a portrait-first pinball action roguelike implemented from the production game design baseline.

## Production content

- 101 deterministic campaign levels across five biomes
- Five major bosses, including the four-stage Final Core
- 96 regular enemy definitions across 12 combat roles
- Twelve deterministic role controllers covering rails, waypoint patrols, perches, formations, orbiting, summoning, splitting, and telegraphed phase movement
- Fifteen seeded handcrafted tables across five biome families
- 150 upgrade cards with the locked rarity and category distributions
- 32 cosmetic/skill achievement definitions
- Endless Mode beginning at Level 102
- Original production key art plus deterministic procedural card compositions

## Game systems

- PixiJS WebGL presentation and Planck.js fixed-step physics at 120 Hz
- Bounded servo flippers swing immediately through their full 20-degree travel, hold while pressed, and return to their downward rest angle on release; contact speed still scales from soft hinge contacts to powerful tip shots
- Collision-backed lower aprons connect to both flipper hinges and feed a non-rebounding central drain
- A continuous collision-backed upper rail closes the playfield so high-energy shots cannot escape above the table
- Physics-driven flippers, charged launch, multiball, nudge upgrades, and direct-impact combat across bumpers, slingshots, spinners, gates, rollovers, ramps, kickers, captive balls, magnets, vents, crushers, and breakable cover
- Drain-triggered attack/defense rhythm with two-second `BALL LEAKED` and `WAVE SURVIVED` intermissions; survival waits until every fired projectile has cleared
- Full-scene defense transformations with a dedicated player starfighter and five biome-specific space battlefields
- Persistent first-encounter tutorials pause and spotlight each new table obstacle before safely returning to play
- Vortex kickers capture the ball, telegraph a seeded safe direction and strength, then fire with a randomized upward launch
- The level timer runs only while a launched ball is active or during the defense phase; plunger setup, intermissions, drafts, pauses, and relaunches are timer-safe
- Twelve illustrated enemy roles with biome/tier treatments, five unique boss presenters, themed hostile projectiles, and a visually distinct energy-ring player ball
- Three-card XP drafts, stack limits, rarity weights, abilities, consumables, rerolls, and level-local builds
- Keyboard, pointer-drag, and touch controls in a responsive 9:16 frame
- Versioned browser progress plus one-use IndexedDB suspend saves
- Howler-managed browser audio context and stored accessibility settings

## Controls

- Left/right flippers: `A` / `D` or Left / Right Arrow
- Launch: hold and release Space or the Launch touch zone
- Nudge: Shift after acquiring a nudge card
- Ability: `Q`
- Consumable: `E`
- Defense movement: `A` / `D`, arrows, or horizontal pointer drag
- Pause: `P` or Escape

## Development

```powershell
npm install
npm run dev
```

Open `/pinball/`. All game runtimes and assets are vendored, so the deployed game has no runtime network requirement.

Run validation with:

```powershell
npm test
```

## Generated art

`assets/flipstrike-tower.png`, the 17 transparent WebP files in `assets/actors/`, and the ship plus five stage files in `assets/defense/` were generated with OpenAI's built-in image generation workflow for this project. Defense mode morphs the player into a starfighter and crossfades the table into a biome-specific space scene. Procedural vector fallbacks remain available if a texture cannot load. Generation metadata and prompt summaries are recorded in each asset directory's `manifest.json`.

## Third-party runtimes

PixiJS, Planck.js, and Howler.js are distributed under the MIT License. See `vendor/THIRD-PARTY-LICENSES.txt`.
