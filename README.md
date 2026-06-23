# The Land of Faaa Faaa Away

An isometric castle-builder + army-battler, Stronghold-meets-Clash-of-Clans.
TypeScript + Vite + PixiJS v8; a pure-TS simulation fully decoupled from rendering.

Live: https://aisdivine.github.io/mini-games/land-of-faaa-faaa-away/

> This repo is a little **mini-games arcade** (hub at
> https://aisdivine.github.io/mini-games/). A second game, **Worldly Farm** (a
> cozy Stardew-style farmer), lives self-contained in `games/farm/` — see
> `games/farm/README.md`. Build it with `npm run build:farm`; build both with
> `npm run build:all`. The rest of this README covers the stronghold game.

## Run

```bash
npm install
npm run dev      # → http://localhost:5173 (also on your LAN for phones)
npm test         # headless sim tests (vitest)
npm run build    # type-check + production build
```

## The game

Two scenes. Your **home** is a peaceful community — nothing ever attacks it.
You grow an economy, train an army, then **March to Battle**: your troops fight
an enemy army on a separate **battlefield**. Survivors come home with loot; the
fallen are gone for good. Each victory makes the next enemy army bigger and
tougher. Winning never ends the game; only your home town can fail (starvation).

### Home — build & grow

- **Economy:** a Woodcutter's peasant walks to the nearest tree, chops it, hauls
  the log back (trees deplete to stumps and regrow); then the bread chain —
  Wheat Farm → Mill → Bakery → Granary. Each production building binds one idle
  peasant who physically hauls goods through the stockpile, visible and animated.
- **Food & population:** all food goes to the **Granary**; the fastest sources
  are single buildings — **Apple Orchard**, **Hunter's Hut**, **Fisherman's Hut**
  (build near the pond). A **varied diet** boosts popularity more than any one
  food. Peasants eat every 20s: fed → popularity rises and immigrants arrive
  (build Houses for capacity); starving → popularity falls and people leave.
  **Popularity 0 = you lose.**
- **Gold & the Market:** sell surplus / buy shortfalls for gold (buy > sell).
- **The land:** a rocky **mountain** (mine it with a **Quarry**), a **stream**,
  and a fishing **pond**. You can't build or walk on water or rock.

### Army — train & arm

- **Barracks** trains soldiers (spearman, man-at-arms, pikeman, archer, medic,
  standard-bearer). Costs draw on wood / stone / gold / food.
- **Support buildings arm the army:** **Blacksmith** (+25% damage / −15% damage
  taken to all your troops, and unlocks the **Crossbowman**), **Stable**
  (unlocks **Knight** + **Camel Lancer**), **Siege Workshop** (unlocks the
  **Mangonel** — heavy splash). Elites are locked until you build their source.

### Battle — march & fight

- **March to Battle** takes your whole standing army to a fresh battlefield:
  your troops muster west, a scaled enemy host masses east and advances.
- Fight it out with full RTS control — **box-select** troops, **right-click** to
  maneuver and focus. Win by wiping the enemy army.
- **Win:** survivors return home + loot (gold/wood/stone), and the battle counter
  climbs (next enemy is bigger/tougher). **Lose:** your army is gone — rebuild
  and try again. **Retreat** anytime: survivors come home, no loot. No game-over
  either way; your home is untouched while you fight.

### Controls

| Input | Action |
|---|---|
| Left-drag / arrows | Pan camera |
| Scroll wheel | Zoom to cursor |
| Build menu + click | Place building (drag for walls) |
| Left-drag box | Select your soldiers |
| Right-click ground | Move/focus selected soldiers |
| Right-click / Space | Cancel mode, clear selection |
| Click unit/building | Select |
| `1` `2` `3` | Speed 1× / 2× / 4× |
| `p` | Pause · `c` Re-center · `g` Debug paths |
| `w` | Cheat: +100 wood |

Autosaves the **home** world to localStorage every 30s (battles are transient and
never saved — reloading mid-battle keeps your army and abandons the fight).
"New Game" wipes the save.

## Architecture

Two `Sim`/`World` instances coexist: `homeSim` (peaceful base) and, during a
fight, `battleSim` (army vs army). `main.ts` keeps `sim` pointing at the active
scene and rebuilds the world-bound render objects on a switch.

- `src/sim/` — deterministic simulation, **zero pixi imports**, runs headless in
  vitest. Fixed 20 Hz tick; seeded RNG; plain serializable `World` struct.
  - `world.ts` — the `World` struct, `createWorld` (home: keep, peasants,
    terrain, trees) and `createBattleWorld(seed, level, army)` (bare grass field,
    your army west + scaled raiders east). `World.kind` is `'home' | 'battle'`.
  - `sim.ts` — fixed tick order; battle worlds skip economy systems
    (`commands → units → combat` only).
  - `combat.ts` — role-based combat: your `SoldierType` troops auto-engage
    `raider` enemies and vice-versa (`fieldAdvance` is the battlefield enemy AI).
  - `commands.ts`, `buildings.ts`, `units.ts`, `population.ts`, `economy.ts`,
    `pathfinding.ts`, `grid.ts`, `save.ts` (versioned localStorage).
- `src/config.ts` — every tunable: buildings, soldier stats, battle scaling, loot.
- `src/art/` — isometric SVG art. The **v2 pack** (`art/v2/pack`) holds building
  bases + animated layers; `art/buildings.ts` and `art/decor.ts` register each
  asset to an `ArtId`. Adding a building's art = drop a `*_base.svg` + one line.
- `src/render/` — PixiJS views reconciled against the active world by entity id
  (`sceneSync.ts`, with `reset()` to tear down on a scene switch). `assets.ts`
  rasterizes SVGs to textures once; animated building layers (flags, smoke,
  sails, forge smoke) and combat FX are driven off a render clock, independent of
  the sim. `groundView`/`waterView` bake per-world terrain and are rebuilt on a
  switch; camera/atmosphere/ambient/HUD are world-agnostic and reused.
- `src/input/`, `src/ui/` — pointer/hotkeys → command queue; DOM HUD.
- `src/main.ts` — composition root: scene switching (`setScene`/`enterBattle`/
  `endBattle`), fixed-timestep game loop with interpolated render, save/load.
