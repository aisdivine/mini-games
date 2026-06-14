# Art request — remaining buildings (v2, batch 2)

Your batch 1 (keep, mill, campfire + units, tree, stump, ground, icons) is integrated
and looks great. This batch completes the building set so we can swap **all** buildings
to the v2 style at once. Follow the same `SPEC.md` you already wrote — this is just the
work list + the engine's exact expectations.

## Conventions (must match batch 1 exactly)

- **Isometric 2:1, light from top-left, material palette from `SPEC.md`.** No new hues.
- **Each building = one base SVG + optional separate animated-layer SVG(s)** — same as
  `keep_base.svg` + `keep_flag.svg`.
- **Root `data-anchor="ax,ay"` = center of the GROUND footprint diamond** (exactly like
  `keep_base` `65,92`, `mill_base` `65,90`). Also set `data-footprint="WxH"`.
- **Animated layer files**: root `data-anchor` = the pin point expressed in the *base
  sprite's* pixel coordinates (where the part attaches). For rotating parts add
  `data-pivot="px,py"` (rotation center, in the same coordinate space).
- **Soft contact shadow** (`#00000022` ellipse, ~70% footprint width) under every base.
- **Size the canvas to fit** the art (as you did in batch 1) — the engine reads
  `width`/`height`/`data-anchor` from each file, so canvas size is up to you.

Footprint → ground diamond (for placing the anchor):

| Footprint | Ground diamond (w×h) |
|-----------|----------------------|
| 1×1 | 64 × 32 |
| 2×2 | 128 × 64 |
| 3×3 | 192 × 96 |

## Buildings needed (10)

| # | File(s) | Footprint | Material | Look / signature | Animated layer |
|---|---------|-----------|----------|------------------|----------------|
| 1 | `tower_base` + `tower_flag` | 2×2 tall | Stone | Round cylinder, crenellation ring, arrow slit | flag waving — **pivot at pole top** |
| 2 | `wall_base` | 1×1 low | Stone | Low block, battlement teeth on top edge (placed in long runs — keep left/right edges abutting cleanly) | — |
| 3 | `house_base` + `house_smoke` | 2×2 | Plaster + roof-red | Plaster walls, red hip roof, door, window, brick chimney | smoke puffs — pin at **chimney mouth** |
| 4 | `stockpile_base` | 3×3 flat | Wood | Low ground platform with crates + grain sacks | — |
| 5 | `granary_base` | 2×2 | Stone | Store with wide arch, grain sacks at base | — |
| 6 | `woodcutter_base` + `wood_saw` | 2×2 | Wood | Timber lodge, stacked log-ends, sawhorse | saw stroke + wood chips (plays only while working) — pin at **sawhorse** |
| 7 | `apple_orchard_base` (+ opt `orchard_drop`) | 3×3 flat | Foliage/field | Green field, scattered small apple trees (red dots) | (optional) a falling apple |
| 8 | `hunter_base` | 2×2 | Wood | Log lodge, **antlers over the door**, drying rack | — |
| 9 | `wheat_farm_base` + `wheat_stalks` | 3×3 flat | Field/wheat | Golden field, plowed furrows | stalks sway — pin at **field center** |
| 10 | `bakery_base` + `bakery_smoke` | 2×2 | Plaster + brick | Plaster house, brick oven chimney | smoke puffs when baking — pin at **chimney mouth** |

## How the engine animates the layers (so they slot in)

- **Rotating** (flags, and the already-delivered sails): we rotate the layer around
  `data-pivot`. Draw it in a neutral rest pose.
- **Puffs / smoke / chips / sway**: ship a small single sprite (e.g. one smoke puff, one
  chip, one stalk cluster). We loop & transform it (translate up + fade for smoke, sway
  rotate for stalks). If you'd rather author crisp motion, ship 2–3 frames named
  `*_smoke_1/2/3.svg` and we'll cycle them — single sprite is fine though.

## Optional — richer unit motion ("doing stuff")

Units currently animate via code transforms (walk bounce, work swing). If you want
crisper cycles, add **one or two alternate poses per unit**, same `34×46` canvas, same
`data-anchor="17,46"`, same `data-team-fill` recolor tag:
- `peasant_walk.svg` (mid-step), `peasant_work.svg` (arms raised / bent over).
- Same for archer (draw-bow pose) and raider if easy.
We'll frame-swap these; not required.

## Delivery

Same zip layout: `assets/buildings/*.svg` (+ any unit poses under `assets/units/`).
Keep the `SPEC.md` palette/anchors identical so batch 1 and 2 read as one set.
