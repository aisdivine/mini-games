// Composition root — the only file that knows both the sim and the renderer.

import {
  ARCHER_COST_WOOD,
  BUILDINGS,
  MAX_ACCUM_MS,
  RAID_AT_TICK,
  SIM_DT_MS,
  SIM_TICKS_PER_SEC,
  type BuildingType,
} from './config';
import { Sim } from './sim/sim';
import type { SimEvent } from './sim/events';
import { canPlace, isPassable } from './sim/grid';
import { housingCapacity, populationCount } from './sim/population';
import { deserializeWorld, serializeWorld } from './sim/save';
import { buildingAt, type Building, type Unit, type Vec2 } from './sim/world';
import { createApp } from './render/app';
import { Camera } from './render/camera';
import { tileToScreen } from './render/iso';
import { SceneSync } from './render/sceneSync';
import { createGroundView } from './render/views/groundView';
import { OverlayView } from './render/views/overlayView';
import { setupPointer } from './input/pointer';
import { Hotkeys } from './input/hotkeys';
import { Hud } from './ui/hud';

const SAVE_KEY = 'stronghold.save.v1';
const AUTOSAVE_MS = 30_000;

type Mode =
  | { kind: 'select' }
  | { kind: 'place'; building: BuildingType }
  | { kind: 'wall' }
  | { kind: 'demolish' };

type Selection =
  | { kind: 'none' }
  | { kind: 'unit'; id: number }
  | { kind: 'building'; id: number };

const BUILD_ORDER: BuildingType[] = [
  'house', 'granary', 'woodcutter', 'wheatFarm', 'mill', 'bakery', 'tower',
];

async function start(): Promise<void> {
  const { app, layers } = await createApp();
  const camera = new Camera(layers.world);
  const hud = new Hud();
  const hotkeys = new Hotkeys();

  // Sim: resume the autosave if present, else a fresh world.
  const saved = localStorage.getItem(SAVE_KEY);
  const loadedWorld = saved ? deserializeWorld(saved) : null;
  const sim = new Sim(Date.now() & 0x7fffffff, loadedWorld ?? undefined);
  if (loadedWorld) setTimeout(() => hud.showMessage('Game resumed from autosave'), 300);

  layers.ground.addChild(createGroundView());
  const overlay = new OverlayView();
  layers.overlay.addChild(overlay.container);
  const sceneSync = new SceneSync(layers.entities, layers.overlay);

  const keep = sim.world.buildings.get(sim.world.keepId);
  const center = keep ? tileToScreen(keep.tile.x + 1.5, keep.tile.y + 1.5) : { x: 0, y: 0 };
  camera.centerOn(center.x, center.y, app.screen.width, app.screen.height);

  let mode: Mode = { kind: 'select' };
  let selection: Selection = { kind: 'none' };
  let hovered: Vec2 | null = null;
  let wallStart: Vec2 | null = null;
  let wallPreview: Vec2[] = [];
  let speed = 1;
  let paused = false;
  let gameOverShown = false;

  function setMode(next: Mode): void {
    mode = next;
    wallStart = null;
    wallPreview = [];
    overlay.clearGhost();
    hud.setActiveButton(
      next.kind === 'place' ? next.building : next.kind === 'select' ? null : next.kind,
    );
  }

  function newGame(): void {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  // --- Build menu -----------------------------------------------------------
  hud.buildMenu(
    [
      ...BUILD_ORDER.map((t) => ({
        id: t,
        label: `${BUILDINGS[t].label} (${BUILDINGS[t].costWood})`,
        hint: BUILDINGS[t].recipe ? 'Needs a worker peasant' : undefined,
      })),
      { id: 'wall', label: `Wall (${BUILDINGS.wall.costWood}/tile)`, hint: 'Click-drag to draw' },
      { id: 'archer', label: `Archer (${ARCHER_COST_WOOD})`, hint: 'Recruited at the keep' },
      { id: 'demolish', label: 'Demolish', hint: 'Click a building to remove it (50% refund)' },
      { id: 'newgame', label: 'New Game' },
    ],
    (id) => {
      if (id === 'archer') {
        sim.enqueue({ type: 'recruitArcher' });
      } else if (id === 'demolish') {
        setMode(mode.kind === 'demolish' ? { kind: 'select' } : { kind: 'demolish' });
      } else if (id === 'wall') {
        setMode(mode.kind === 'wall' ? { kind: 'select' } : { kind: 'wall' });
      } else if (id === 'newgame') {
        if (confirm('Abandon this city and start over?')) newGame();
      } else {
        setMode({ kind: 'place', building: id as BuildingType });
      }
    },
  );

  // --- Pointer --------------------------------------------------------------
  function wallLine(a: Vec2, b: Vec2): Vec2[] {
    // L-shaped manhattan trace: x leg first, then y leg.
    const tiles: Vec2[] = [];
    const stepX = Math.sign(b.x - a.x);
    for (let x = a.x; x !== b.x; x += stepX) tiles.push({ x, y: a.y });
    const stepY = Math.sign(b.y - a.y);
    for (let y = a.y; y !== b.y; y += stepY) tiles.push({ x: b.x, y });
    tiles.push({ ...b });
    return tiles;
  }

  function pickUnit(frac: Vec2): Unit | null {
    let best: Unit | null = null;
    let bestDist = 0.9;
    for (const u of sim.world.units.values()) {
      if (u.insideBuilding || u.role === 'raider') continue;
      const d = Math.hypot(u.pos.x - frac.x, u.pos.y - frac.y);
      if (d < bestDist) {
        bestDist = d;
        best = u;
      }
    }
    return best;
  }

  setupPointer(app, layers.world, camera, {
    onHoverTile(tile) {
      hovered = tile;
    },
    onClickTile(tile, frac, button) {
      if (button === 2) {
        setMode({ kind: 'select' });
        selection = { kind: 'none' };
        return;
      }
      switch (mode.kind) {
        case 'place':
          sim.enqueue({ type: 'placeBuilding', building: mode.building, tile });
          return;
        case 'demolish': {
          const b = buildingAt(sim.world, tile.x, tile.y);
          if (b) sim.enqueue({ type: 'demolish', buildingId: b.id });
          return;
        }
        case 'wall':
          sim.enqueue({ type: 'placeWalls', tiles: [tile] });
          return;
        case 'select': {
          const unit = pickUnit(frac);
          if (unit) {
            selection = { kind: 'unit', id: unit.id };
            return;
          }
          const building = buildingAt(sim.world, tile.x, tile.y);
          if (building) {
            selection = { kind: 'building', id: building.id };
            return;
          }
          // empty ground: order the selected archer around
          if (selection.kind === 'unit') {
            const sel = sim.world.units.get(selection.id);
            if (sel?.role === 'archer' && isPassable(sim.world, tile.x, tile.y)) {
              sim.enqueue({ type: 'moveUnit', unitId: sel.id, dest: tile });
              return;
            }
          }
          selection = { kind: 'none' };
          return;
        }
      }
    },
    isPaintMode: () => mode.kind === 'wall',
    onPaintStart(tile) {
      wallStart = tile;
      wallPreview = [tile];
    },
    onPaintMove(tile) {
      if (wallStart) wallPreview = wallLine(wallStart, tile);
    },
    onPaintEnd(tile) {
      if (wallStart) {
        sim.enqueue({ type: 'placeWalls', tiles: wallLine(wallStart, tile) });
      }
      wallStart = null;
      wallPreview = [];
    },
  });

  // --- Hotkeys ---------------------------------------------------------------
  hotkeys.bind('Escape', () => {
    setMode({ kind: 'select' });
    selection = { kind: 'none' };
  });
  hotkeys.bind('1', () => (speed = 1));
  hotkeys.bind('2', () => (speed = 2));
  hotkeys.bind('3', () => (speed = 4));
  hotkeys.bind(' ', () => (paused = !paused));
  hotkeys.bind('g', () => (overlay.debugPaths = !overlay.debugPaths));
  hotkeys.bind('w', () => sim.enqueue({ type: 'cheatWood', amount: 100 }));
  hotkeys.bind('p', () => sim.enqueue({ type: 'spawnPeasant' }));
  hotkeys.bind('r', () => sim.enqueue({ type: 'startRaid' }));

  // --- Game loop ---------------------------------------------------------------
  let acc = 0;
  let autosaveTimer = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) acc = 0;
  });

  app.ticker.add((ticker) => {
    // Fixed-timestep sim with interpolated rendering.
    if (!paused && sim.world.outcome === 'playing') {
      acc = Math.min(acc + ticker.deltaMS * speed, MAX_ACCUM_MS * speed);
      while (acc >= SIM_DT_MS) {
        sim.tick();
        acc -= SIM_DT_MS;
      }
    }

    const events = sim.drainEvents();
    handleEvents(events);
    sceneSync.update(sim.world, events, Math.min(acc / SIM_DT_MS, 1));

    hotkeys.update(camera);
    updateOverlays();
    updateHud();

    // Autosave on wall-clock time.
    autosaveTimer += ticker.deltaMS;
    if (autosaveTimer >= AUTOSAVE_MS) {
      autosaveTimer = 0;
      if (sim.world.outcome === 'playing') {
        localStorage.setItem(SAVE_KEY, serializeWorld(sim.world));
      }
    }
  });

  function handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'rejected' || e.type === 'message') {
        hud.showMessage(e.type === 'rejected' ? `✋ ${e.reason}` : e.text);
      } else if (e.type === 'gameOver' && !gameOverShown) {
        gameOverShown = true;
        localStorage.removeItem(SAVE_KEY);
        hud.showGameOver(e.outcome, e.reason, newGame);
      }
    }
  }

  function updateOverlays(): void {
    if (hovered) overlay.setHoverTile(hovered.x, hovered.y);
    else overlay.setHoverTile(-1, -1);

    if (mode.kind === 'place' && hovered) {
      const def = BUILDINGS[mode.building];
      const valid =
        canPlace(sim.world, def, hovered) && sim.world.stockpile.wood >= def.costWood;
      overlay.setGhost(mode.building, hovered, valid);
    } else if (mode.kind === 'wall') {
      const preview = wallPreview.length > 0 ? wallPreview : hovered ? [hovered] : [];
      overlay.setWallPreview(preview, (t) => canPlace(sim.world, BUILDINGS.wall, t));
    }

    // Selection ring follows the selected entity; drop selection if it died.
    if (selection.kind === 'unit') {
      const u = sim.world.units.get(selection.id);
      if (!u) selection = { kind: 'none' };
      else overlay.setSelection(u.insideBuilding ? null : u.pos);
    } else if (selection.kind === 'building') {
      const b = sim.world.buildings.get(selection.id);
      if (!b) selection = { kind: 'none' };
      else overlay.setSelectedBuilding(b.type, b.tile);
    } else {
      overlay.setSelection(null);
    }

    overlay.drawPaths(sim.world);
  }

  function stateText(b: Building): string {
    switch (b.state.kind) {
      case 'none':
        return '';
      case 'awaitingWorker':
        return 'Awaiting worker';
      case 'awaitingInput':
        return `Awaiting ${BUILDINGS[b.type].recipe?.input?.resource ?? 'input'}`;
      case 'producing':
        return `Working (${Math.ceil(b.state.ticksLeft / SIM_TICKS_PER_SEC)}s)`;
      case 'delivering':
        return 'Delivering';
    }
  }

  function updateHud(): void {
    const w = sim.world;
    const pop = populationCount(w);
    const housing = housingCapacity(w);
    const raidIn = w.raid.triggered
      ? null
      : Math.max(0, Math.ceil((RAID_AT_TICK - w.tick) / SIM_TICKS_PER_SEC));
    const mmss = raidIn !== null
      ? `${Math.floor(raidIn / 60)}:${String(raidIn % 60).padStart(2, '0')}`
      : null;
    hud.setTopBar(
      [
        `<span class="stat">🪵 ${w.stockpile.wood}</span>`,
        `<span class="stat">🌾 ${w.stockpile.wheat}</span>`,
        `<span class="stat">🫓 ${w.stockpile.flour}</span>`,
        `<span class="stat">🍞 ${w.granaryBread}</span>`,
        `<span class="stat">👥 ${pop}/${housing}</span>`,
        `<span class="stat">❤️ ${w.popularity} (food ${w.lastFoodDelta >= 0 ? '+' : ''}${w.lastFoodDelta})</span>`,
        mmss ? `<span class="stat">⚔ raid in ${mmss}</span>` : `<span class="stat">⚔ raid!</span>`,
        `<span class="stat">${paused ? '⏸ paused' : `▶ ${speed}×`}</span>`,
      ].join(''),
    );

    if (selection.kind === 'building') {
      const b = sim.world.buildings.get(selection.id);
      if (b) {
        const def = BUILDINGS[b.type];
        hud.setInfo(
          `<h3>${def.label}</h3>` +
            `HP ${b.hp}/${def.hp}<br>` +
            (def.recipe
              ? `${stateText(b)}<br>Worker: ${b.workerId !== null ? 'yes' : 'none'}`
              : def.housing
                ? `Houses ${def.housing}`
                : ''),
        );
      }
    } else if (selection.kind === 'unit') {
      const u = sim.world.units.get(selection.id);
      if (u) {
        hud.setInfo(
          `<h3>${u.role}</h3>` +
            `Task: ${u.task.kind}<br>` +
            (u.carrying ? `Carrying ${u.carrying.resource}` : '') +
            (u.role === 'archer' ? '<br><em>Click ground to move</em>' : ''),
        );
      }
    } else {
      hud.setInfo('');
    }

    hud.setDebug(
      `${hovered ? `tile (${hovered.x}, ${hovered.y})` : 'tile —'}  tick ${w.tick}\n` +
        `keys: 1/2/3 speed · space pause · g paths · w +wood · p +peasant · r raid · esc cancel`,
    );
  }
}

start();
