# Art request — batch 3 (gaps from integrating the v2 pack into the live game)

For the visualiz bot. Same house style/contract as `ART_SPEC_v2.md`:
iso 2:1 (64×32 tiles), light from top-left, the §4 material palette, soft
`#00000022` contact shadow. **Buildings:** 130×126 canvas, `data-anchor` at the
footprint center, `data-footprint="WxH"`; animated parts ship as a separate
same-viewBox overlay with `data-pivot` = motion origin and a stable group id.
**Terrain:** 64×32, `data-anchor="32,16"`. **Decor:** anchor at the base.
**Units:** 34×46, `data-anchor="17,46"`, `data-team-fill`.

## Why these — what changed in the game
The game now has a **per-tile terrain layer** (grass / water / rock), a procedurally
generated **rocky mountain**, a **stream**, and a **fishing pond**, plus a new
**Fisherman's Hut** producing a 4th food type (**fish**), a **day/night** cycle,
and ambient **birds + camel**. The pack had no mountain/rock, no fishing art, and
no fishery — these are the gaps I filled with placeholders and want real art for.

### 1. Fishery (replace placeholder)
- `fishery_base.svg` (2×2, anchor 65,92) — a coastal fisherman's lodge: timber +
  net, a couple of fish on a drying rack, a small jetty hint. Palette: weathered
  wood + a teal/slate accent so it reads as "by the water." *(I hand-authored a
  stand-in; want one that matches the set.)*
- `fishery_net.svg` (optional anim overlay, `#net` gentle sway, pivot at the rack top).

### 2. Mountain & elevation terrain (pack has none)
- `rocky_tile.svg` (64×32) — grey scree/rock ground tile, two shades for the
  checkerboard, to carpet the mountain footprint.
- `mountain_peak.svg` (decor, base anchor) — a flat-shaded rocky peak with a snow
  cap; ship **3 height variants** (small/medium/tall) so a cluster reads as a ridge.
  *(I'm generating peaks procedurally now; real art would look far better.)*
- `cliff_edge.svg` set — one raised step: straight + the four corners, so the map
  can show elevation between grass and rock.
- `boulder.svg`, `pine_tree.svg` (40×56-ish) — highland decor to vary the forest
  near the mountain.

### 3. Fishing kit (water gameplay)
- `fish_shoal.svg` (decor on a water tile) + `fish_ripple.svg` (anim overlay,
  `#ripple` expand/fade) — a shoal you can see, fading to ripples when fished out.
  *(Placeholder fish is a flat poly today.)*
- `peasant_fish.svg` (34×46 pose) — peasant holding a fishing rod, casting; pairs
  with the existing walk/work frames so the fisherman animates at the shore.
- `i-fish` carry-chip / 24×24 icon refinement to match the new HUD fish counter
  (a clean side-view fish, top-left light, 1px darker outline).
- `fx_splash_small.svg` — a little water splash one-shot for a successful catch.

### 4. Water depth + shore (currently flat color + code shimmer)
- `water_deep.svg` / `water_shallow.svg` (64×32) — two depth shades so the pond
  center reads deeper than the edges.
- `shore_autotile` set — water↔sand transition (straight + inner/outer corners),
  so pond/stream edges get a real shoreline instead of a stroke.
- `bridge_tile.svg` (1×1, plank bridge over water; straight + the turn) so players
  can cross the stream.

### 5. New buildings that fit the new terrain (§8.1, prioritized by fit)
- `dock_base.svg` (2×2 or 2×1) — a pier extending over water; natural partner to
  the fishery, lets fishing huts sit inland.
- `quarry_base.svg` (2×2) + `quarry_cart.svg` (anim) — built against the mountain
  to mine **stone** (a future resource); working-cart loop.
- `well_base.svg` is already in the pack — wire-ready; a `cistern`/`fountain`
  variant for the desert-oasis vibe would be nice.

### 6. Atmosphere polish (have the basics)
- `rain.svg` / `sandstorm.svg` drifting particle sheets (the §8.2 weather), as
  tiling overlays we can scroll.
- `window_glow` variants for the non-house buildings (keep, bakery) so the whole
  town lights up at night, not just houses.

**Priority order:** 1 (fishery) → 2 (mountain/cliff) → 3 (fishing kit) →
4 (water depth/shore) → 5 (dock/quarry) → 6 (weather). Ship each as its own
small zip with the `data-anchor`/`data-pivot` attributes so it drops straight in.
