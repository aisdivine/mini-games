// Composition root — the only file that knows both the sim and the renderer.
// Action-driven: pointer + HUD enqueue mutations, the render loop only animates
// and reconciles the board.

import { FARM_H, FARM_W, TILE, type CropType, type Tool } from './config';
import { createWorld, inBounds, type World } from './sim/world';
import { applyTile, buySeed, giftHelper, sellHarvest, sleep, type ActionResult } from './sim/actions';
import { deserialize, serialize } from './sim/save';
import { createApp } from './render/app';
import { FarmView } from './render/view';
import { Hud } from './ui/hud';

const SAVE_KEY = 'worldly-farm.save.v1';

async function start(): Promise<void> {
  const { app, layers } = await createApp();
  const view = new FarmView();
  layers.board.addChild(view.root);
  const hud = new Hud();

  const saved = localStorage.getItem(SAVE_KEY);
  const world: World = (saved && deserialize(saved)) || createWorld();
  view.markTerrainDirty();

  let tool: Tool = 'hoe';
  let seed: CropType = 'parsnip';
  let hover: { x: number; y: number } | null = null;

  const save = (): void => localStorage.setItem(SAVE_KEY, serialize(world));
  const refresh = (r?: ActionResult): void => {
    if (r) hud.toast(r.msg);
    hud.render(world, tool, seed);
    save();
  };

  // --- Board fit: scale the whole farm to the window, centered, leaving room
  // for the top bar and the bottom tool/action belts. ---
  let s = 1;
  let ox = 0;
  let oy = 0;
  const fit = (): void => {
    const W = app.screen.width;
    const H = app.screen.height;
    const padX = 24;
    const padTop = 56; // top stats bar
    const padBottom = 110; // tool + action belts
    s = Math.min((W - padX * 2) / (FARM_W * TILE), (H - padTop - padBottom) / (FARM_H * TILE));
    s = Math.max(0.3, Math.min(s, 2));
    ox = (W - FARM_W * TILE * s) / 2;
    oy = padTop + (H - padTop - padBottom - FARM_H * TILE * s) / 2;
    layers.board.scale.set(s);
    layers.board.position.set(ox, oy);
  };
  fit();

  const toTile = (sx: number, sy: number): { x: number; y: number } | null => {
    const x = Math.floor((sx - ox) / (TILE * s));
    const y = Math.floor((sy - oy) / (TILE * s));
    return inBounds(x, y) ? { x, y } : null;
  };

  // --- Pointer -----------------------------------------------------------------
  const canvas = app.canvas;
  canvas.addEventListener('pointermove', (e) => {
    hover = toTile(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => {
    hover = null;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const t = toTile(e.clientX, e.clientY);
    if (!t) return;
    const r = applyTile(world, t.x, t.y, tool, seed);
    if (tool === 'hoe' && r.ok) view.markTerrainDirty();
    refresh(r);
  });

  // --- HUD wiring --------------------------------------------------------------
  hud.onTool((t) => {
    tool = t;
    refresh();
  });
  hud.onSelectSeed((c) => {
    seed = c;
    tool = 'plant';
    refresh();
  });
  hud.onAction((id) => {
    if (id === 'gift') refresh(giftHelper(world));
    else if (id === 'sleep') refresh(sleep(world));
    else if (id === 'save') {
      save();
      hud.toast('💾 Saved');
    } else hud.render(world, tool, seed); // shop toggle
  });
  hud.onShop((kind, crop) => {
    refresh(kind === 'buy' ? buySeed(world, crop) : sellHarvest(world, crop));
  });

  // keyboard shortcuts (desktop): 1/2/3 tools, S sleep
  window.addEventListener('keydown', (e) => {
    const map: Record<string, Tool> = { '1': 'hoe', '2': 'water', '3': 'plant' };
    if (map[e.key]) {
      tool = map[e.key];
      refresh();
    } else if (e.key.toLowerCase() === 's') {
      refresh(sleep(world));
    }
  });

  hud.render(world, tool, seed);

  // --- Render loop (animation + reconcile only) --------------------------------
  let clock = 0;
  app.ticker.add((ticker) => {
    clock += ticker.deltaMS;
    view.update(world, hover, clock);
  });

  let lastW = app.screen.width;
  let lastH = app.screen.height;
  app.ticker.add(() => {
    if (app.screen.width !== lastW || app.screen.height !== lastH) {
      lastW = app.screen.width;
      lastH = app.screen.height;
      fit();
    }
  });
}

void start();
