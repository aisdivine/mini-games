# Stronghold-style isometric art spec — v2

A drop-in art bible for the isometric RTS. Everything here assumes the render layer
hides art behind a single asset interface (sprite id → SVG/PNG + anchor + optional
animated layers), so swapping assets in is a contained change.

---

## 1. Art direction (the "house style")

Five rules keep everything sitting together. If a new asset breaks one of these, it
will look pasted-in.

1. **Projection: isometric 2:1.** Every tile is a `64 × 32` diamond (width:height = 2:1).
   All cuboids use a 26.57° iso, i.e. for every 2px horizontal you move 1px vertical
   along a footprint edge.
2. **Light from the top-left.** One fixed sun. Surfaces get three values:
   - top / roof faces = **lightest**
   - left-facing walls (toward camera-left) = **mid**
   - right-facing walls = **darkest**
   Cast shadows always fall to the lower-right (we fake them with a soft ellipse).
3. **Material palette only** (section 4). Don't introduce new hues per building —
   recolor within the shared ramps so a village reads as one place.
4. **Soft contact shadow under everything.** A single `#00000022` ellipse, ~70% of the
   footprint width, sitting at the base anchor. This is what makes sprites "sit" on the
   ground instead of float.
5. **Readable silhouette first, detail second.** At 1× zoom a building is ~64–192px
   wide. Strong shape + one signature feature (flag, sails, antlers) reads better than
   fine texture. Add micro-detail for the 2× zoom layer only.

---

## 2. Geometry & sizing

Base tile: **64 × 32 px** at 1× zoom.

| Footprint | Diamond base (w × h) | Typical sprite canvas (w × h) |
|-----------|----------------------|-------------------------------|
| 1×1 | 64 × 32 | 64 × 80 |
| 2×2 | 128 × 64 | 128 × 150 |
| 3×3 | 192 × 96 | 192 × 220 |

Sprite canvas is always **wider/taller than the footprint** to fit walls, roofs and
overhanging parts (sails, flags). Keep the footprint diamond centered horizontally in
the canvas.

---

## 3. Coordinate & anchor contract

Every asset ships with an **anchor** `(ax, ay)` in its own sprite-pixel space. The
renderer places the sprite so its anchor lands on the tile's screen anchor.

- **Units & decor:** anchor = the ground-contact point (between the feet / trunk base).
- **Buildings:** anchor = **center of the footprint diamond** (where the tile center is).
  The sprite extends upward and slightly outward from there.
- **Animated layers:** each moving part ships as a separate sprite with (a) its own
  anchor expressed in the *base sprite's* coordinate space (where to pin it), and
  (b) for rotating parts, a **pivot** `(px, py)` for the rotation center.

Anchors for every shipped file are listed in section 11. Store them in the asset
manifest, not hard-coded in the renderer.

---

## 4. Material palette

Hardcoded hex (these are physical materials — they should NOT theme-invert).

| Material | Top / light | Left / mid | Right / dark | Line / detail |
|----------|-------------|------------|--------------|---------------|
| Sand tile A | `#E6D49C` | — | `#D8C386` | `#C9B377` |
| Sand tile B | `#DECB8E` | — | `#D0BA7C` | `#C9B377` |
| Stone (castle) | `#CFC8BA` | `#B5AC9B` | `#958D7C` | `#8E8676` |
| Plaster (house) | `#F0E2BE` | `#E2CFA4` | `#CDB888` | `#B49E6E` |
| Roof red | `#C0473A` | `#A8392E` | `#8E2E25` | `#732419` |
| Wood | `#8A6A3E` | `#6E5430` | `#5A4228` | `#3A2A19` |
| Thatch | `#D9B24A` | `#C49A2E` | `#A87E22` | `#856219` |
| Field / wheat | `#D9B24A` | — | `#C49A2E` | `#B8902F` |
| Foliage | `#5FA84E` | `#4E913F` | `#367A3C` | `#2C5E2C` |
| Water | `#5FA9C4` | — | `#1E4B5F` | `#16384A` |
| Gold trim | `#F4D87A` | — | `#C99A2E` | `#9A7320` |
| Skin (5 variants) | `#F2C9A0` `#E8B58C` `#D9A479` `#C08A5E` `#9A6A42` | | | |
| Flame | `#FFE38A` (core) → `#F6B12B` → `#E8651C` → `#B5331C` (base) | | | |
| Smoke | `#cfcfcf` (fades to transparent) | | | |
| Shadow | `#00000022` | | | |

Team colors (recolorable, see §8.3): blue `#3A5FB5`, red `#C0392B`, green `#3F6E37`,
gold `#D9A93C`, purple `#6E4FC0`, slate `#4A4036`.

---

## 5. Buildings (v2)

All buildings: stone/plaster/wood per material table, top-left light, contact shadow,
arch door, optional animated layer shipped separately.

| Building | Footprint | Look | Animated layer(s) | Pivot/anchor of layer |
|----------|-----------|------|-------------------|----------------------|
| Keep | 3×3, tall | Stone cuboid, crenellated crown, arch door, window slits, corner merlons | `keep_flag` (waving pennant) | flag pole top |
| Tower | 2×2, tall | Round stone cylinder, crenellation ring, arrow slit | `tower_flag` | pole top |
| Wall | 1×1, low | Stone block, battlement teeth on top edge | — | — |
| Gatehouse* | 2×1 | Two short towers + arch + raisable portcullis | `gate_portcullis` (slides up) | top of arch |
| House | 2×2 | Plaster walls, hip red roof, door, window, brick chimney | `house_smoke` (puffs) | chimney mouth |
| Stockpile | 3×3, flat | Ground platform, crates/sacks (wood/wheat/flour swap by fill state) | — | — |
| Granary | 2×2 | Stone store, wide arch, grain sacks at base | — | — |
| Woodcutter | 2×2 | Timber lodge, stacked log-ends | `wood_saw` (saw + chips, when working) | sawhorse |
| Apple orchard | 3×3, flat | Green field, scattered small apple trees | (opt) `orchard_drop` falling apple | — |
| Hunter's hut | 2×2 | Log lodge, antlers over door, drying rack | — | — |
| Wheat farm | 3×3, flat | Golden field, furrows | `wheat_stalks` (sway) | base of stalk cluster |
| Mill | 2×2, tall | Stone house, peaked roof, sail cross | `mill_sails` (rotate) | hub center |
| Bakery | 2×2 | Plaster house, brick oven chimney | `bakery_smoke` (when baking) | chimney mouth |
| Campfire | 1×1 | Stone ring + crossed logs (start point) | `campfire_flame` (flicker) | base of flame |

\* = new building added in v2 (see §8).

### Build / damage states (new)
Each building gets up to four sprite states the renderer can cross-fade:
`ghost` (placement preview, green/red tint) → `scaffold` (timber frame + dust) →
`built` (the sprites above) → `damaged` (cracks, scorch, a smoke layer). Cheap to do:
`scaffold` is the built sprite at 60% opacity with a wood-frame overlay; `damaged` adds
a crack decal + reuses `house_smoke`.

---

## 6. Units

Canvas ~`34 × 46`, anchor `(17, 46)` between the feet. Capsule torso, round head, two
stubby legs, simple arms, two-dot face. Head uses one of 5 skin variants. Tunic = role
color. Built so a single body rig can be recolored and re-propped.

| Unit | Tunic | Prop | Notes |
|------|-------|------|-------|
| Peasant | role color (idle blue, woodcutter brown, orchard green, hunter olive, farm gold, mill pale, bakery orange) | none / tool when working | base body |
| Archer | red | longbow (held left), quiver on back | ranged friendly |
| Raider | slate/dark | spear + round shield | enemy melee |
| Spearman* | team | spear + kite shield | enemy/garrison |
| Knight* | team + mail | sword, plumed helm | heavy |
| Lord* | rich robe + gold | none (or scepter) | your avatar / win-con target |
| Scout* | light | rides a camel | fast, desert flavor |

### Unit animation (new — keep cheap)
Two ultra-light loops cover most of the feel without full sprite sheets:
- **Idle bob:** translate the whole sprite `±1px` vertical, 1.2s ease.
- **Walk waddle:** alternate a `±4°` skew on the two leg groups + the idle bob.
- **Work:** a 2-frame swap on the held tool (axe up/down, bow draw/release).
Facing: ship **4 directions** (NE, NW, SE, SW) by horizontal-flipping 2 drawn angles.
8-direction is a later upgrade.

---

## 7. Decor, terrain & effects

### Terrain tiles (2:1 diamonds, 64×32, anchor center `32,16`)
- Sand A / Sand B — checkerboard alternation (already in use).
- New biome tiles: **grass**, **dirt/road**, **rocky**, **water**, **shoreline**
  (water-edge with sand), **oasis** (water + reeds). Roads auto-tile at a basic level
  with a straight + corner + T + cross set (5 sprites).
- **Cliff / elevation** edge tiles so the map can have height (one raised step).

### Decor (anchor at base)
Tree (40×56), stump, palm, cactus, rock cluster, bush, reeds, dead tree, banner pole,
market stall, well, barrels/crate, hay bale, fence segment, scarecrow, signpost.

### Resource carry-chip
Small colored square floating above a hauling unit's head. Replace the emoji with the
6 custom icons in §9. Chip = the icon on a `#00000033` rounded square, 14px.

### Effects (separate transient sprites)
Flying arrow, wood chips, dust puff, smoke puff (shared with chimneys), splash,
spark burst, level-up sparkle, blood/impact tick (toggleable), coin pop on sale.

### Overlays (drawn by renderer, not sprites)
Tile hover (diamond outline, `#FFFFFF` 60%), placement ghost (green/red footprint fill),
selection ring (animated dashed ellipse), path dots, range circle (for archers/towers),
health bar (3-segment, hide at full).

---

## 8. New ideas worth adding

### 8.1 New buildings
Barracks (train soldiers), Market/Bazaar (trade + the colorful stall), Blacksmith
(anvil + sparks anim), Chapel/Shrine (calm, popularity boost), Well/Cistern (water in a
desert map), Watchtower (cheap ranged), Stables (camels/horses), Fishing hut (needs
shoreline), Quarry & Mine (stone/iron, with a working-cart anim), Herbalist, Tavern
(popularity), Gatehouse + drawbridge.

### 8.2 World life & atmosphere
- **Day / night cycle:** a single full-screen color multiply (warm noon → amber dusk →
  cool blue night) + window-glow layer that turns on at night. Huge mood payoff, near-zero
  art cost.
- **Weather:** sandstorm (drifting particle + haze), rain, heat shimmer over fire.
- **Wildlife / ambient units:** birds crossing, goats, camels, a stray cat near the
  bakery — pure flavor, cheap.
- **Seasons or biome reskins:** same building set, swapped palette (verdant / desert /
  winter) via the recolor system below.

### 8.3 Faction recolor system
Pull every team-colored fill out to a single `--team` token per sprite (one fill id).
Then one soldier sprite → N factions by swapping that fill. Lets you do "your lord vs.
rival lords" Crusader-style with no extra art. Heraldry: a small banner/shield emblem
sprite (cross, crescent, sun, eagle) layered onto keeps, tents and shields.

### 8.4 Polish details that punch above their weight
Window glow at night; flag color = owner faction; smoke only when a building is actively
working (ties anim to game state); footprint dust when a unit walks on sand; the carry-chip
bob; a tiny "+1 🪵" toast when a resource lands in the stockpile; selection ring color =
friendly/enemy. Audio hooks (out of art scope) on the same events.

---

## 9. Resource icons (custom — replaces emoji)

24×24, flat, top-left light, 1px darker outline, used in HUD + carry-chip. Ship as a
single `icons.svg` with `<symbol>` ids so the HUD can `<use>` them and tint via CSS.

| id | Resource | Look |
|----|----------|------|
| `i-wood` | wood | two stacked log-ends, brown, growth rings |
| `i-wheat` | wheat | three golden stalks bound at base |
| `i-flour` | flour | tied cloth sack, pale, a puff of dust |
| `i-bread` | bread | round boule loaf, scored top, golden crust |
| `i-apple` | apples | red apple + leaf + small highlight |
| `i-meat` | meat | drumstick, brown with bone end |

Future: stone, iron, gold, water, popularity (heart/face), faith (star/sun) — same kit.

---

## 10. HUD styling (DOM, lower priority)

Cohesive panel kit to tie it together:
- Surface: warm parchment `#EDE2C6` panels, `#5A4632` 1px border, 8px radius,
  subtle inner top highlight. Sits over the game canvas.
- Top resource bar: each resource = custom icon + count, monospace numerals.
- Bottom build menu: icon buttons in the parchment style, category tabs, hover lift,
  cost shown on hover, red-out when unaffordable.
- Tooltip: small parchment card, item name (serif), 1-line description, cost row.
- Selection panel: portrait (the unit/building sprite), name, stats, action buttons.
- Toasts: slide-in parchment chips for events.
- Win/lose: full overlay, banner, lord portrait, stats summary.

A consistent serif for titles (something medieval-but-legible) + sans for numbers ties
the whole UI to the world art.

---

## 11. Files shipped in this pack

Each SVG has `data-anchor="ax,ay"` (and `data-pivot` where relevant) on the root.

Terrain
- `assets/terrain/ground_tile.svg` — both shades as `#tileA` / `#tileB` symbols. anchor 32,16
- `assets/terrain/tree.svg` — anchor 20,54
- `assets/terrain/stump.svg` — anchor 16,28

Units (anchor 17,46)
- `assets/units/peasant.svg`
- `assets/units/archer.svg`
- `assets/units/raider.svg`

Buildings (base + separate animated layer = the contract pattern)
- `assets/buildings/keep_base.svg`  + `keep_flag.svg`     (layer pinned at base 49,8 · pivot at pole)
- `assets/buildings/mill_base.svg`  + `mill_sails.svg`    (layer pinned at 86,79 · pivot = center)
- `assets/buildings/campfire_base.svg` + `campfire_flame.svg` (layer pinned at 32,40)

Icons
- `assets/icons/icons.svg` — 6 `<symbol>`s: i-wood i-wheat i-flour i-bread i-apple i-meat

## 12. Roadmap (generate next, in priority order)
1. Remaining building bases + their animation layers (tower, house, bakery, granary,
   woodcutter, wheat farm, orchard, hunter, stockpile, wall, gatehouse).
2. 4-direction unit facings + idle/walk/work loops for peasant, archer, raider.
3. New terrain biome tiles + road auto-tile set + cliff edges.
4. New buildings from §8.1.
5. Day/night tint + window-glow layers; weather particles.
6. HUD parchment kit + remaining resource icons.

---

## 13. Batch 2 manifest (buildings complete + unit poses)

Conventions identical to batch 1: iso 2:1, top-left light, palette from §4. Each base
carries `data-anchor` (footprint-center) + `data-footprint`. Animated-layer files are
full-canvas overlays in the same viewBox as their base (drop on top at the same anchor,
exactly like `keep_flag`); the moving part's motion origin is in `data-pivot` — rotation
center for flags/sails, pin point for smoke/saw/sway. Sand tile is NOT baked into bases
(it's the terrain asset); contact shadow IS.

Buildings (`assets/buildings/`)
- `tower_base.svg` (2x2, anchor 65,99) + `tower_flag.svg` (pivot 65,24)
- `wall_base.svg` (1x1, anchor 65,98) — top face spans the tile so runs abut
- `house_base.svg` (2x2, anchor 65,92) + `house_smoke.svg` (pivot 79,52)
- `stockpile_base.svg` (3x3, anchor 65,96)
- `granary_base.svg` (2x2, anchor 65,92)
- `woodcutter_base.svg` (2x2, anchor 65,92) + `wood_saw.svg` (pivot 71,93; `#chip1/#chip2` for spawned chips)
- `apple_orchard_base.svg` (3x3, anchor 65,96) + `orchard_drop.svg` (pivot 41,80, optional)
- `hunter_base.svg` (2x2, anchor 65,92)
- `wheat_farm_base.svg` (3x3, anchor 65,96) + `wheat_stalks.svg` (pivot 65,104)
- `bakery_base.svg` (2x2, anchor 65,92) + `bakery_smoke.svg` (pivot 78,49)

Animated layer ids (target these to loop/transform): `#flag`, `#smoke`, `#saw`,
`#stalks`, `#apple`. Suggested loops: flag/stalks = `skewX` oscillate from pivot;
smoke = translate up + fade, stagger 2–3 instances; saw = `translateX` ±2px from pivot,
spawn `#chip1/#chip2` rising; sails (batch 1) = `rotate` around pivot.

Unit alt poses (`assets/units/`, 34x46, anchor 17,46, `data-team-fill`)
- `peasant_walk.svg`, `peasant_work.svg` (hoe), `archer_draw.svg` (bow drawn), `raider_attack.svg` (spear thrust)
Frame-swap base ↔ pose; pair with the idle-bob/walk-waddle from §6.

All buildings from the v2 set now have files. Remaining roadmap items (§12): gatehouse,
4-direction facings, new biome/road tiles, the §8.1 new buildings, day/night + weather,
and the HUD parchment kit.

---

## 14. Batch 3 manifest — life & motion

Adds water, fire, cloth, wildlife, walk cycles and atmosphere. Same contract: base
carries `data-anchor`/`data-footprint`; animated-layer files overlay in the same viewBox
with `data-pivot` = motion origin and a stable group id to target.

Terrain (`assets/terrain/`)
- `water_base.svg` (1x1, anchor 32,16) + `water_shimmer.svg` (overlay, `#shimmer`)
- `shoreline_base.svg` (1x1, anchor 32,16)

Decor (`assets/decor/`)
- `palm_base.svg` (anchor 35,92) + `palm_fronds.svg` (`#fronds`, pivot 37,52 — skew/sway)
- `oasis_reeds.svg` (`#reeds`, pivot 22,56 — sway)
- `torch_base.svg` (anchor 25,94) + `torch_flame.svg` (`#flame` flicker + `#glow` pulse, pivot 25,40)
- `banner_base.svg` (anchor 25,104) + `banner_cloth.svg` (`#cloth` wave, pivot 27,22, `data-team-fill`)
- `well_base.svg` (2x2, anchor 45,100) + `well_bucket.svg` (`#bucket` swing, pivot 45,46)
- `market_base.svg` (2x2, anchor 60,98) + `market_awning.svg` (`#awning` flutter, pivot 35,40)

Life (`assets/life/`)
- `birds.svg` (`#flock`) — loop by translating the whole sprite across the screen
- `camel.svg` (anchor 55,94) — `#body` + 4 leg groups (`#legFL/#legFR/#legBL/#legBR`),
  each with its own `data-pivot`; rotate legs ±14° alternating + bob `#body` for a walk

Unit facings (`assets/units/`, 34x46, anchor 17,46, `data-team-fill`, `data-facing`)
- `peasant_se.svg` `peasant_sw.svg` (front, mirrored) · `peasant_ne.svg` `peasant_nw.svg` (back, mirrored)
- Combine with `peasant_walk`/`peasant_work` from batch 2 for a per-direction walk loop.
  (Archer/raider facings follow the same mirror trick when you want them.)

Effects (`assets/effects/`) — transient one-shots; spawn, play, destroy
- `fx_arrow.svg` (anchor at tip 38,6 — rotate to travel dir)
- `fx_dust.svg` (`#dust` expand+fade), `fx_splash.svg` (`#splash`), `fx_coin.svg` (`#coin` pop), `fx_sparkle.svg` (`#sparkle` burst)

Atmosphere (`assets/atmosphere/`)
- `window_glow.svg` — overlay on `house_base`; lerp `#glow` opacity 0 (day) → 1 (night)
- `daynight_tints.svg` — the four full-screen overlay color stops (dawn/noon/dusk/night);
  lerp fill+opacity across the in-game clock. Pair with `window_glow` turning on at dusk.

### Suggested motion params (so the village reads alive)
- Sway/wave (palm, reeds, banner, awning): `skewX`/`rotate` ±4–7°, 1.6–2.8s ease-in-out, from pivot.
- Flame flicker: `scale(.88,1.16)` 0.45s; glow opacity 0.4↔0.8 1.4s.
- Water shimmer: ripple opacity 0.25↔0.7 + 4px drift, 3s.
- Bucket swing: `rotate` ±8° 2.2s from rope top.
- Birds: translate across + slight vertical drift, 5s linear, stagger 2–3 flocks.
- Walk cycle: legs `rotate` ±14° alternating 0.5s + body bob 1.5px; arms swing opposite.
- Day/night: ~full clock loop; window glow ramps in over dusk.
Stagger start delays so nothing pulses in unison.
