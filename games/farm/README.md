# Worldly Farm

A cozy Stardew-Valley-style farming game. Second game in the mini-games repo;
same house style as the stronghold game (PixiJS v8 + TypeScript + Vite + Vitest,
a pure-TS deterministic sim decoupled from rendering). Self-contained under
`games/farm/` with its own Vite config.

Live: https://aisdivine.github.io/mini-games/worldly-farm/

## Run (from the repo root)

```bash
npm run dev:farm        # dev server
npm run test:farm       # headless sim tests (vitest)
npm run build:farm      # type-check + build → dist/worldly-farm
```

## How to play

A relaxed loop, day by day:

1. **Hoe** grass into soil, **Plant** a seed on it, **Water** it.
2. **Sleep** to end the day — watered crops grow one stage overnight (unwatered
   ones wait), energy refills.
3. When a crop is ripe, **click it** (any tool) to **harvest**.
4. **Shop** to buy seeds and sell your harvest for gold.
5. **Gift the farmhand** a harvested crop to raise their mood 💖 — the higher it
   is, the more of your crops they **water for you each morning**.

Crops: 🥕 Parsnip (4d) · 🥔 Potato (5d) · 🍓 Strawberry (6d) · 🎃 Pumpkin (7d).
Every action costs a little energy; sleep restores it. Cozy and endless — no
fail state, just grow your farm.

Controls: click a tile to use the selected tool (harvest is automatic on a ripe
crop). Keys `1`/`2`/`3` switch Hoe/Water/Plant, `S` sleeps. Autosaves to
localStorage.

## Architecture

- `src/config.ts` — tunables: crops, tools, energy, farmhand mood.
- `src/sim/` — pure, deterministic, headless-testable: `world.ts` (serializable
  `World` + `createWorld`), `actions.ts` (every mutation: till/water/plant/
  harvest, buy/sell, gift, and `sleep` = the overnight grow step incl. the
  farmhand's morning watering), `save.ts` (versioned localStorage).
- `src/render/` — PixiJS, top-down. `view.ts` redraws the board from the world
  each frame with Graphics (terrain only rebuilds when tilled); characters bob.
- `src/ui/` — DOM HUD (tool belt, shop, stats, toasts).
- `src/main.ts` — composition root: pointer/keys → actions, board fit-to-window,
  render loop, save.
