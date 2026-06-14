# Stronghold-lite

A Stronghold Crusader-inspired isometric castle & economy sim — vertical slice.
TypeScript + Vite + PixiJS v8; pure-TS simulation fully decoupled from rendering.

## Run

```bash
npm install
npm run dev      # → http://localhost:5173
npm test         # headless sim tests (vitest)
npm run build    # type-check + production build
```

## How to play

Peaceful economy sandbox — raids are paused (`RAIDS_ENABLED = false`).

- **Economy:** build a Woodcutter (its peasant walks out to the nearest tree,
  chops it, hauls the log back — trees deplete to stumps and regrow), then the
  bread chain — Wheat Farm → Mill → Bakery → Granary. Each production building
  binds one idle peasant who physically hauls goods through the stockpile.
  Workers stay visible and animated while working.
- **Food:** all food goes to the **Granary**. The fastest sources are single
  buildings — an **Apple Orchard** or **Hunter's Hut** — so build one early
  instead of waiting on the whole bread chain. A **varied diet** (bread +
  apples + meat) gives a bigger popularity boost than any single food.
- **Population:** peasants eat every 20s. Fed = popularity rises and
  immigrants arrive (build Houses for capacity). Starving = popularity falls
  and peasants leave. Popularity 0 = defeat.
- **Status & upgrades:** hover any building for a live status tooltip (what it
  makes, craft time, current activity). Click to select, then **Upgrade** it
  with wood (up to Lv 3) to speed up production.
- **Defense:** drag Walls, place Towers (range bonus for adjacent archers),
  recruit Archers at the keep and position them with click-to-move.
- **Win:** kill every raider. **Lose:** keep destroyed or popularity collapse.

### Controls

| Input | Action |
|---|---|
| Left-drag / arrows | Pan camera |
| Scroll wheel | Zoom to cursor |
| Build menu + click | Place building (drag for walls) |
| Right-click / Esc | Cancel mode, clear selection |
| Click unit/building | Select (archers: click ground to move) |
| `1` `2` `3` | Speed 1× / 2× / 4× |
| Space | Pause |
| `g` | Debug: show unit paths |
| `w` `p` `r` | Cheats: +100 wood, spawn peasant, start raid |

Autosaves to localStorage every 30s; "New Game" wipes it.

## Architecture

- `src/sim/` — deterministic simulation, **zero pixi imports**, runs headless
  in vitest. Fixed 20 Hz tick; seeded RNG; plain serializable world struct.
- `src/art/` — clean flat-shaded isometric vector art, generated as SVG from
  typed primitives (`flat.ts`: auto three-tone iso boxes, cylinders,
  crenellation cubes, flags, soft ground shadows — solid fills, no outlines).
  Every object resolves to a `VectorAsset` by its `ArtId`
  (`BuildingType | UnitRole`); adding art for a new building is one spec
  entry in `buildings.ts`. Fully deterministic.
- `src/art/v2/` — external art pack SVGs (units, tree, stump, icons) per the
  art bible in `docs/ART_SPEC.md`. Units are recolored per villager at load
  (`render/unitTextures.ts`: skin tone from id, tunic from job) and the resource
  icons drive the HUD. Buildings are still code-drawn (`art/buildings.ts`)
  pending the full 13-building v2 set, then they swap in as one consistent set.
- `src/render/` — PixiJS views reconciled against the world by entity id
  (`sceneSync.ts`). `assets.ts` rasterizes the SVGs to textures at 2× once
  at startup; views are sprites positioned by each asset's anchor. Living
  detail (`views/buildingAnim.ts`) is drawn into a per-building `Graphics`
  overlay each frame from a render clock — turning mill sails, chimney smoke,
  waving flags, flickering campfire, swaying wheat, sawdust — independent of
  the sim, so it animates even while paused.
- `src/input/`, `src/ui/` — pointer/hotkeys → command queue; DOM HUD.
- `src/main.ts` — composition root: game loop (fixed-timestep sim,
  interpolated render), mode state, save/load.
