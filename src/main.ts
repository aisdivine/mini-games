// Composition root — the only file that knows both the sim and the renderer.

import {
  ARCHER_COST_WOOD,
  BUILDINGS,
  EDGE_PAN_MARGIN,
  EDGE_PAN_SPEED,
  ELITE_SOLDIERS,
  isSoldier,
  MARKET_GOODS,
  MAX_BUILDING_LEVEL,
  SIM_DT_MS,
  SIM_TICKS_PER_SEC,
  SOLDIERS,
  upgradeWoodCost,
  workTicksAtLevel,
  type BuildingType,
  type Resource,
  type SoldierType,
  type TrainCost,
} from './config';
import { Sim } from './sim/sim';
import type { SimEvent } from './sim/events';
import { canPlace, isPassable } from './sim/grid';
import { housingCapacity, populationCount } from './sim/population';
import { resourceCount } from './sim/economy';
import { deserializeWorld, serializeWorld } from './sim/save';
import { buildingAt, type Building, type Unit, type Vec2 } from './sim/world';
import { createApp } from './render/app';
import { loadArtTextures } from './render/assets';
import { loadBuildingLayers } from './render/buildingLayers';
import { loadCombatFx } from './render/combatFx';
import { loadUnitTextures } from './render/unitTextures';
import iconsSvg from './art/v2/icons.svg?raw';
import { Camera } from './render/camera';
import { tileToScreen } from './render/iso';
import { Atmosphere } from './render/atmosphere';
import { AmbientLife, loadAmbientLife } from './render/ambientLife';
import { SceneSync } from './render/sceneSync';
import { Container, Graphics } from 'pixi.js';
import { createGroundView } from './render/views/groundView';
import { WaterView } from './render/views/waterView';
import { OverlayView } from './render/views/overlayView';
import { setupPointer } from './input/pointer';
import { Hotkeys } from './input/hotkeys';
import { Hud } from './ui/hud';

const SAVE_KEY = 'stronghold.save.v1';
const AUTOSAVE_MS = 30_000;
// When the tab is hidden/minimized the browser freezes the animation loop, so on
// return we fast-forward the sim by however long you were away — the world keeps
// running while you're in another app. Capped so a long absence doesn't lock the
// page while it catches up (30 min of game time).
const CATCHUP_MAX_MS = 30 * 60 * 1000;

// Night ground tint — multiplied onto the baked sand so it reads darker and
// cooler at night (the primary night effect; the screen wash stays light).
const NIGHT_GROUND_TINT = 0x5e6cb4;
function lerpRgb(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

type Mode =
  | { kind: 'select' }
  | { kind: 'place'; building: BuildingType }
  | { kind: 'wall' }
  | { kind: 'demolish' };

type Selection =
  | { kind: 'none' }
  | { kind: 'units'; ids: number[] }
  | { kind: 'building'; id: number };

/** Units the player can box-select and command (military). Workers are excluded
 *  so commanding them never orphans their job. Soldier roles join this later. */
function isCommandable(u: Unit): boolean {
  return isSoldier(u.role);
}

/** Compact cost string for a soldier, e.g. "🪵8 🪨2". */
function costText(cost: TrainCost): string {
  const parts: string[] = [];
  if (cost.wood) parts.push(`🪵${cost.wood}`);
  if (cost.stone) parts.push(`🪨${cost.stone}`);
  if (cost.gold) parts.push(`🪙${cost.gold}`);
  if (cost.food) parts.push(`🍖${cost.food}`);
  return parts.join(' ');
}

function canAffordTrain(w: { stockpile: { wood: number; stone: number }; gold: number; granaryFood: Record<string, number> }, cost: TrainCost): boolean {
  if ((cost.wood ?? 0) > w.stockpile.wood) return false;
  if ((cost.stone ?? 0) > w.stockpile.stone) return false;
  if ((cost.gold ?? 0) > w.gold) return false;
  const food = w.granaryFood.bread + w.granaryFood.apples + w.granaryFood.meat + w.granaryFood.fish;
  if ((cost.food ?? 0) > food) return false;
  return true;
}

const BUILD_ORDER: BuildingType[] = [
  'house', 'granary', 'appleOrchard', 'hunter', 'fishery', 'woodcutter', 'quarry', 'wheatFarm', 'mill', 'bakery', 'market', 'barracks', 'blacksmith', 'stable', 'siege_workshop', 'tower',
];

/** Compact placement-cost string for a building, e.g. "🪵40 🪙25". */
function buildingCostText(t: BuildingType): string {
  return costText(BUILDINGS[t].cost ?? { wood: BUILDINGS[t].costWood });
}

// HUD resource icon id for a tradeable resource.
const RESOURCE_ICON: Record<Resource, string> = {
  wood: 'i-wood', wheat: 'i-wheat', flour: 'i-flour', stone: 'i-stone',
  bread: 'i-bread', apples: 'i-apple', meat: 'i-meat', fish: 'i-fish',
};

async function start(): Promise<void> {
  const { app, layers } = await createApp();
  const camera = new Camera(layers.world);
  const hud = new Hud();
  // Inject the resource icon <symbol> sheet so the HUD can <use> them.
  document.body.insertAdjacentHTML('afterbegin', iconsSvg);
  const hotkeys = new Hotkeys();

  // Sim: resume the autosave if present, else a fresh world.
  const saved = localStorage.getItem(SAVE_KEY);
  const loadedWorld = saved ? deserializeWorld(saved) : null;
  const sim = new Sim(Date.now() & 0x7fffffff, loadedWorld ?? undefined);
  if (loadedWorld) setTimeout(() => hud.showMessage('Game resumed from autosave'), 300);

  const [art, unitTex, buildingLayers, lifeTex, combatFx] = await Promise.all([
    loadArtTextures(),
    loadUnitTextures(),
    loadBuildingLayers(),
    loadAmbientLife(),
    loadCombatFx(),
  ]);
  const groundView = createGroundView(sim.world);
  layers.ground.addChild(groundView);
  const water = new WaterView(sim.world);
  layers.ground.addChild(water.g);
  const overlay = new OverlayView();
  layers.overlay.addChild(overlay.container);
  const sceneSync = new SceneSync(layers.entities, layers.overlay, art, unitTex, buildingLayers, combatFx);

  // Ambient wildlife: a sky layer (above the world) for birds; the camel rides
  // the depth-sorted entity layer.
  const sky = new Container();
  sky.sortableChildren = true;
  layers.world.addChild(sky);
  const ambient = new AmbientLife(sky, layers.entities, lifeTex);

  // Screen-space lighting overlay lives on the stage, above the panned world.
  // On a phone, night mode kicks in only when it's actually night (local clock);
  // otherwise — and always on desktop — it's daytime. 'n' overrides for the run.
  const atmosphere = new Atmosphere();
  app.stage.addChild(atmosphere.g);
  // Selection-box marquee, drawn in screen space on top of everything.
  const marquee = new Graphics();
  app.stage.addChild(marquee);
  const isMobile =
    window.matchMedia?.('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) ||
    window.innerWidth <= 860;
  const isNightTime = (): boolean => {
    const h = new Date().getHours();
    return h >= 19 || h < 7; // 7pm–7am counts as night
  };
  let manualLight = false; // set once the player presses 'n'
  const applyAutoMode = (): void => {
    if (!manualLight) atmosphere.setMode(isMobile && isNightTime() ? 'night' : 'day');
  };
  applyAutoMode();
  setInterval(applyAutoMode, 60_000); // follow the day↔night boundary while playing

  // Restore default zoom and re-center the camera on the keep.
  function resetView(): void {
    layers.world.scale.set(1);
    const keep = sim.world.buildings.get(sim.world.keepId);
    const c = keep ? tileToScreen(keep.tile.x + 1.5, keep.tile.y + 1.5) : { x: 0, y: 0 };
    camera.centerOn(c.x, c.y, app.screen.width, app.screen.height);
  }
  resetView();

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

  function saveGame(): void {
    if (sim.world.outcome !== 'playing') return;
    localStorage.setItem(SAVE_KEY, serializeWorld(sim.world));
    autosaveTimer = 0; // restart the autosave countdown from this manual save
    hud.showMessage('💾 Game saved');
  }

  // --- Build menu -----------------------------------------------------------
  hud.buildMenu(
    [
      ...BUILD_ORDER.map((t) => ({
        id: t,
        label: `${BUILDINGS[t].label} (${buildingCostText(t)})`,
        hint: BUILDINGS[t].recipe ? 'Needs a worker peasant' : undefined,
      })),
      { id: 'wall', label: `Wall (${BUILDINGS.wall.costWood}/tile)`, hint: 'Click-drag to draw' },
      { id: 'archer', label: `Archer (${ARCHER_COST_WOOD})`, hint: 'Recruited at the keep' },
      { id: 'demolish', label: 'Demolish', hint: 'Click a building to remove it (50% refund)' },
      { id: 'resetview', label: 'Reset View', hint: 'Re-center on the keep (Home / c)' },
      { id: 'save', label: '💾 Save', hint: 'Save your city now (also autosaves every 30s · S)' },
      { id: 'newgame', label: 'New Game' },
    ],
    (id) => {
      if (id === 'archer') {
        sim.enqueue({ type: 'recruitArcher' });
      } else if (id === 'demolish') {
        setMode(mode.kind === 'demolish' ? { kind: 'select' } : { kind: 'demolish' });
      } else if (id === 'wall') {
        setMode(mode.kind === 'wall' ? { kind: 'select' } : { kind: 'wall' });
      } else if (id === 'resetview') {
        resetView();
      } else if (id === 'save') {
        saveGame();
      } else if (id === 'newgame') {
        if (confirm('Abandon this city and start over?')) newGame();
      } else {
        setMode({ kind: 'place', building: id as BuildingType });
      }
    },
  );

  // Always-visible play controls (essential on touch, where there's no keyboard).
  hud.controlMenu(
    [
      { id: 'pause', label: '⏸', hint: 'Pause / resume (P)' },
      { id: 'speed', label: '1×', hint: 'Cycle game speed (1/2/3)' },
    ],
    (id) => {
      if (id === 'pause') {
        paused = !paused;
      } else if (id === 'speed') {
        speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
      }
    },
  );

  // Market trade panel (shown when a Market is selected).
  hud.buildMarket(
    MARKET_GOODS.map((g) => ({
      id: g.resource,
      label: `<svg class="hud-icon"><use href="#${RESOURCE_ICON[g.resource]}"/></svg> ${g.resource}`,
      sell: g.sell,
      buy: g.buy,
    })),
    (id, dir) => sim.enqueue({ type: 'trade', resource: id as Resource, dir }),
  );

  // Barracks training panel (shown when a Barracks is selected).
  hud.buildBarracks(
    (Object.keys(SOLDIERS) as SoldierType[]).map((id) => ({
      id,
      label: SOLDIERS[id].label,
      cost: costText(SOLDIERS[id].cost),
    })),
    (id) => sim.enqueue({ type: 'trainSoldier', soldier: id as SoldierType }),
  );

  // Upgrade button inside the selection panel (event-delegated so it survives
  // the panel's per-frame re-render).
  hud.onInfoAction(() => {
    if (selection.kind === 'building') {
      sim.enqueue({ type: 'upgrade', buildingId: selection.id });
    }
  });

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

  /** Order every commandable unit in the current selection to `tile`, spread
   *  over a small grid so they don't all stack on one square. */
  function moveSelectedTo(tile: Vec2): void {
    if (selection.kind !== 'units') return;
    const movable = selection.ids
      .map((id) => sim.world.units.get(id))
      .filter((u): u is Unit => !!u && isCommandable(u));
    const cols = Math.max(1, Math.ceil(Math.sqrt(movable.length)));
    movable.forEach((u, i) => {
      const dx = (i % cols) - (cols >> 1);
      const dy = Math.floor(i / cols) - (cols >> 1);
      let dest = { x: tile.x + dx, y: tile.y + dy };
      if (!isPassable(sim.world, dest.x, dest.y)) dest = tile;
      sim.enqueue({ type: 'moveUnit', unitId: u.id, dest });
    });
  }

  setupPointer(app, layers.world, camera, {
    onHoverTile(tile) {
      hovered = tile;
    },
    onClickTile(tile, frac, button) {
      // Right-click: command the selected soldiers to move there, else cancel.
      if (button === 2) {
        if (mode.kind === 'select' && selection.kind === 'units' && isPassable(sim.world, tile.x, tile.y)) {
          moveSelectedTo(tile);
          return;
        }
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
            selection = { kind: 'units', ids: [unit.id] };
            return;
          }
          const building = buildingAt(sim.world, tile.x, tile.y);
          if (building) {
            selection = { kind: 'building', id: building.id };
            return;
          }
          selection = { kind: 'none' };
          return;
        }
      }
    },
    isSelectMode: () => mode.kind === 'select',
    onBoxMove(x0, y0, x1, y1) {
      marquee.clear();
      marquee
        .rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
        .fill({ color: 0x7fd4ff, alpha: 0.12 })
        .stroke({ width: 1.5, color: 0x7fd4ff, alpha: 0.9 });
    },
    onBoxEnd(x0, y0, x1, y1, commit) {
      marquee.clear();
      if (!commit) return;
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
      const ids: number[] = [];
      for (const u of sim.world.units.values()) {
        if (u.insideBuilding || !isCommandable(u)) continue;
        const sp = layers.world.toGlobal(tileToScreen(u.pos.x, u.pos.y));
        if (sp.x >= minX && sp.x <= maxX && sp.y >= minY && sp.y <= maxY) ids.push(u.id);
      }
      selection = ids.length ? { kind: 'units', ids } : { kind: 'none' };
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
  // Space cancels the current mode / clears selection; Escape pauses.
  hotkeys.bind(' ', () => {
    setMode({ kind: 'select' });
    selection = { kind: 'none' };
  });
  hotkeys.bind('1', () => (speed = 1));
  hotkeys.bind('2', () => (speed = 2));
  hotkeys.bind('3', () => (speed = 4));
  hotkeys.bind('p', () => (paused = !paused));
  hotkeys.bind('s', saveGame);
  hotkeys.bind('S', saveGame);
  hotkeys.bind('Home', resetView);
  hotkeys.bind('c', resetView); // 'c' = center, easier to reach than Home
  hotkeys.bind('g', () => (overlay.debugPaths = !overlay.debugPaths));
  hotkeys.bind('n', () => {
    manualLight = true; // stop auto day/night for the rest of this session
    atmosphere.toggle();
    hud.showMessage(atmosphere.mode === 'night' ? '🌙 Night mode' : '☀️ Day mode');
  });
  hotkeys.bind('w', () => sim.enqueue({ type: 'cheatWood', amount: 100 }));

  // --- Edge scrolling -------------------------------------------------------
  // Move the cursor near a screen edge to pan the camera that way (RTS-style),
  // alongside drag-pan and wheel-zoom. Hovering the DOM HUD fires the canvas
  // mouseleave, which naturally suspends edge-scroll over the controls.
  // Track the cursor at the window level so all four edges work even over the
  // HUD overlay; only suppress scrolling when the cursor is over a genuinely
  // interactive HUD element (buttons), where e.target is not the canvas.
  const mouse = { x: 0, y: 0, allowed: false };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.allowed = e.target === app.canvas;
  });
  window.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget) mouse.allowed = false; // cursor left the window
  });

  // Top-bar inventory tooltips: hovering a stat chip shows what it is.
  let topTip: string | null = null;
  const topBarEl = document.getElementById('hud-top')!;
  topBarEl.addEventListener('mousemove', (e) => {
    const chip = (e.target as HTMLElement).closest('.stat') as HTMLElement | null;
    topTip = chip?.dataset.tip ?? null;
  });
  topBarEl.addEventListener('mouseleave', () => {
    topTip = null;
  });

  function edgeScroll(dtMs: number): void {
    if (!mouse.allowed) return;
    const sw = app.screen.width;
    const sh = app.screen.height;
    const m = EDGE_PAN_MARGIN;
    const sp = EDGE_PAN_SPEED * (dtMs / 16.67);
    let dx = 0;
    let dy = 0;
    if (mouse.x < m) dx += sp; // cursor left → reveal the left (camera moves left)
    else if (mouse.x > sw - m) dx -= sp; // cursor right → camera moves right
    if (mouse.y < m) dy += sp;
    else if (mouse.y > sh - m) dy -= sp;
    if (dx || dy) camera.panBy(dx, dy);
  }

  // --- Game loop ---------------------------------------------------------------
  let acc = 0;
  let renderClock = 0; // ms, render-only (water shimmer etc.)
  let autosaveTimer = 0;
  let lastWall = Date.now(); // wall-clock anchor so the sim keeps time across tab hides
  // Track the canvas size so we can keep the view centered when the window
  // resizes (PixiJS resizeTo:window already resizes the renderer itself).
  let lastW = app.screen.width;
  let lastH = app.screen.height;
  // Persist when the tab is backgrounded so progress survives closing it while away.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && sim.world.outcome === 'playing') {
      localStorage.setItem(SAVE_KEY, serializeWorld(sim.world));
    }
  });

  app.ticker.add((ticker) => {
    // Window resized: PixiJS already resized the canvas; keep whatever world
    // point was at screen-center still centered (so content doesn't drift off).
    if (app.screen.width !== lastW || app.screen.height !== lastH) {
      const s = layers.world.scale.x;
      const wx = (lastW / 2 - layers.world.position.x) / s;
      const wy = (lastH / 2 - layers.world.position.y) / s;
      camera.centerOn(wx, wy, app.screen.width, app.screen.height);
      lastW = app.screen.width;
      lastH = app.screen.height;
    }

    // Advance the sim by real elapsed wall-clock time, so it keeps running even
    // while the tab was hidden (the animation loop is frozen then; on return we
    // catch up). A large gap = we just came back from another app.
    const now = Date.now();
    let elapsed = now - lastWall;
    lastWall = now;
    let caughtUp = false;
    if (!paused && sim.world.outcome === 'playing') {
      if (elapsed > 1000) {
        acc += Math.min(elapsed, CATCHUP_MAX_MS); // catch up at 1× real time, capped
        caughtUp = true;
      } else {
        acc += elapsed * speed;
      }
      let steps = Math.floor(acc / SIM_DT_MS);
      acc -= steps * SIM_DT_MS;
      while (steps-- > 0 && sim.world.outcome === 'playing') sim.tick();
    }

    // After a long catch-up, only surface a game-over (don't flood toasts), and
    // persist the fast-forwarded world.
    const drained = sim.drainEvents();
    const events = caughtUp ? drained.filter((e) => e.type === 'gameOver') : drained;
    handleEvents(events);
    // Backstop: if the world ended during a hidden-tab catch-up (its event may
    // have been drained/discarded while away), surface the game-over now.
    if (sim.world.outcome !== 'playing' && !gameOverShown) {
      gameOverShown = true;
      localStorage.removeItem(SAVE_KEY);
      hud.showGameOver(sim.world.outcome, sim.world.outcomeReason, newGame);
    }
    if (caughtUp && sim.world.outcome === 'playing') {
      localStorage.setItem(SAVE_KEY, serializeWorld(sim.world));
    }
    renderClock += ticker.deltaMS;
    water.update(renderClock);
    ambient.update(renderClock, ticker.deltaMS);
    atmosphere.update(renderClock, app.screen.width, app.screen.height);
    // dim the HUD to a dark theme at night so bright panels don't strain the eyes
    document.body.classList.toggle('night', atmosphere.nightAmount() > 0.4);
    // darken the sand/ground itself at night (the main night look, easy on eyes)
    groundView.tint = lerpRgb(0xffffff, NIGHT_GROUND_TINT, atmosphere.nightAmount());
    sceneSync.update(sim.world, events, Math.min(acc / SIM_DT_MS, 1), ticker.deltaMS, atmosphere.nightAmount());

    hotkeys.update(camera);
    edgeScroll(ticker.deltaMS);
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

  // While the tab is hidden (you're in another tab/app) the animation loop is
  // frozen, so drive the sim from a timer instead — the world keeps running
  // while you're gone. It only does work when hidden; the rAF loop owns timing
  // when the tab is visible. Browsers throttle background timers, so it advances
  // in coarse steps and the rAF loop fully catches up the moment you return.
  setInterval(() => {
    if (!document.hidden || paused || sim.world.outcome !== 'playing') return;
    const now = Date.now();
    acc += Math.min(now - lastWall, CATCHUP_MAX_MS);
    lastWall = now;
    let steps = Math.floor(acc / SIM_DT_MS);
    acc -= steps * SIM_DT_MS;
    while (steps-- > 0 && sim.world.outcome === 'playing') sim.tick();
    sim.drainEvents(); // no UI while hidden; outcome is surfaced on return
    if (sim.world.outcome === 'playing') localStorage.setItem(SAVE_KEY, serializeWorld(sim.world));
  }, 1000);

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
        canPlace(sim.world, def, hovered) &&
        canAffordTrain(sim.world, def.cost ?? { wood: def.costWood });
      overlay.setGhost(mode.building, hovered, valid);
    } else if (mode.kind === 'wall') {
      const preview = wallPreview.length > 0 ? wallPreview : hovered ? [hovered] : [];
      overlay.setWallPreview(preview, (t) => canPlace(sim.world, BUILDINGS.wall, t));
    }

    // Selection rings follow the selected units; drop any that died/left.
    if (selection.kind === 'units') {
      const positions: Vec2[] = [];
      const alive: number[] = [];
      for (const id of selection.ids) {
        const u = sim.world.units.get(id);
        if (!u) continue;
        alive.push(id);
        if (!u.insideBuilding) positions.push(u.pos);
      }
      selection = alive.length ? { kind: 'units', ids: alive } : { kind: 'none' };
      overlay.setUnitSelections(positions);
    } else if (selection.kind === 'building') {
      const b = sim.world.buildings.get(selection.id);
      if (!b) {
        selection = { kind: 'none' };
        overlay.setUnitSelections([]); // clear the shared selection graphic
      } else {
        overlay.setSelectedBuilding(b.type, b.tile);
      }
    } else {
      overlay.setUnitSelections([]);
    }

    overlay.drawPaths(sim.world);
  }

  // Live status line for a building's current activity.
  function stateLabel(b: Building): string {
    const def = BUILDINGS[b.type];
    switch (b.state.kind) {
      case 'none':
        return '';
      case 'awaitingWorker':
        return b.workerId !== null ? '🚶 Worker on the way' : '⏳ Needs a worker';
      case 'awaitingInput':
        if (b.type === 'woodcutter') return '🔍 Looking for trees';
        if (b.type === 'fishery') return '🎣 Looking for fish';
        if (b.type === 'quarry') return '⛏ Looking for stone';
        return `⏳ Waiting for ${def.recipe?.input?.resource ?? 'input'}`;
      case 'producing': {
        const full = workTicksAtLevel(def.recipe!.workTicks, b.level);
        const pct = Math.max(0, Math.min(100, Math.round((1 - b.state.ticksLeft / full) * 100)));
        return `⚙ Working ${pct}%`;
      }
      case 'delivering':
        return '📦 Delivering';
    }
  }

  // Shared status HTML for the hover tooltip (full=false) and the selection
  // panel (full=true, adds HP + the upgrade button).
  function buildingStatusHtml(b: Building, full: boolean): string {
    const def = BUILDINGS[b.type];
    const title = def.recipe ? `${def.label} · Lv ${b.level}` : def.label;
    let html = full ? `<h3>${title}</h3>` : `<div class="t-title">${title}</div>`;
    if (def.recipe) {
      const sec = (workTicksAtLevel(def.recipe.workTicks, b.level) / SIM_TICKS_PER_SEC).toFixed(1);
      html += `<span class="t-dim">Makes ${def.recipe.output.resource} · ~${sec}s each</span><br>`;
      html += `${stateLabel(b)}<br>`;
      html += `<span class="t-dim">Worker: ${b.workerId !== null ? 'yes' : 'none'}</span>`;
    } else if (def.housing) {
      html += `<span class="t-dim">Houses ${def.housing} people</span>`;
    } else {
      html += `<span class="t-dim">Storage</span>`;
    }
    if (full) {
      html += `<br><span class="t-dim">HP ${b.hp}/${def.hp}</span>`;
      if (def.recipe && b.level >= MAX_BUILDING_LEVEL) {
        html += `<br><span class="t-dim">⭐ Max level</span>`;
      }
      // The upgrade button itself is a persistent element, set via hud.setAction.
    }
    return html;
  }

  function updateHud(): void {
    const w = sim.world;
    const pop = populationCount(w);
    const housing = housingCapacity(w);
    // play-control labels
    hud.setButtonLabel('pause', paused ? '▶' : '⏸', paused ? 'Resume (P)' : 'Pause (P)');
    hud.setButtonLabel('speed', `${speed}×`, 'Cycle game speed (1/2/3)');
    const icon = (id: string): string => `<svg class="hud-icon"><use href="#${id}"/></svg>`;
    // data-tip drives the on-theme hover tooltip (see the top-bar listener).
    const t = (s: string): string => ` data-tip="${s}"`;
    hud.setTopBar(
      [
        `<span class="stat"${t('Wood — your main building material. Woodcutters chop it from trees.')}>${icon('i-wood')} ${w.stockpile.wood}</span>`,
        `<span class="stat"${t('Wheat — grown on Wheat Farms, milled into flour at the Mill.')}>${icon('i-wheat')} ${w.stockpile.wheat}</span>`,
        `<span class="stat"${t('Flour — milled from wheat, baked into bread at the Bakery.')}>${icon('i-flour')} ${w.stockpile.flour}</span>`,
        `<span class="stat"${t('Stone — mined at the mountain by a Quarry. Tradeable building material.')}>${icon('i-stone')} ${w.stockpile.stone}</span>`,
        `<span class="stat"${t('Bread — food. Baked at the Bakery (wheat → flour → bread).')}>${icon('i-bread')} ${w.granaryFood.bread}</span>`,
        `<span class="stat"${t('Apples — food from the Apple Orchard.')}>${icon('i-apple')} ${w.granaryFood.apples}</span>`,
        `<span class="stat"${t("Meat — food from the Hunter's Hut.")}>${icon('i-meat')} ${w.granaryFood.meat}</span>`,
        `<span class="stat"${t("Fish — food from the Fisherman's Hut.")}>${icon('i-fish')} ${w.granaryFood.fish}</span>`,
        `<span class="stat"${t('Gold — earned by selling at the Market, spent buying goods or training soldiers.')}>🪙 ${w.gold}</span>`,
        `<span class="stat"${t('Population / housing capacity. Build Houses to raise the cap.')}>👥 ${pop}/${housing}</span>`,
        `<span class="stat"${t('Popularity — rises when peasants are fed (varied diet helps), falls when they starve. 0 = you lose.')}>❤️ ${w.popularity} (food ${w.lastFoodDelta >= 0 ? '+' : ''}${w.lastFoodDelta})</span>`,
        w.villages.length
          ? `<span class="stat"${t('Enemy lands conquered. Your home is peaceful — build an army, then march your soldiers east across the frontier to invade. Defeat a land\'s defenders to capture it: its land opens, it pays passive income, and it unlocks an elite unit. Winning never ends the game.')}>🏳 ${w.villages.filter((v) => v.captured).length}/${w.villages.length}</span>`
          : '',
        `<span class="stat"${t('Your home is a peaceful community — no raids or attacks here. Conquest happens out on the eastern frontier.')}>☮ peaceful home</span>`,
        `<span class="stat"${t('Game speed — 1/2/3 to change, P to pause.')}>${paused ? '⏸ paused' : `▶ ${speed}×`}</span>`,
      ].join(''),
    );

    let marketOpen = false;
    let barracksOpen = false;
    if (selection.kind === 'building') {
      const b = sim.world.buildings.get(selection.id);
      if (b && b.type === 'market') {
        marketOpen = true;
        const counts: Record<string, number> = {};
        const canBuy: Record<string, boolean> = {};
        for (const g of MARKET_GOODS) {
          counts[g.resource] = resourceCount(w, g.resource);
          canBuy[g.resource] = w.gold >= g.buy;
        }
        hud.updateMarket(w.gold, counts, canBuy);
        hud.setInfo('');
        hud.setAction(null);
      } else if (b && b.type === 'barracks') {
        barracksOpen = true;
        const status: Record<string, 'ok' | 'poor' | 'locked'> = {};
        for (const id of Object.keys(SOLDIERS) as SoldierType[]) {
          if (ELITE_SOLDIERS.includes(id) && !w.unlocked.includes(id)) status[id] = 'locked';
          else status[id] = canAffordTrain(w, SOLDIERS[id].cost) ? 'ok' : 'poor';
        }
        hud.updateBarracks(status);
        hud.setInfo('');
        hud.setAction(null);
      } else if (b) {
        hud.setInfo(buildingStatusHtml(b, true));
        const def = BUILDINGS[b.type];
        if (def.recipe && b.level < MAX_BUILDING_LEVEL) {
          const cost = upgradeWoodCost(b.type, b.level);
          hud.setAction(`⬆ Upgrade to Lv ${b.level + 1} — ${cost} 🪵`, w.stockpile.wood >= cost);
        } else {
          hud.setAction(null);
        }
      }
    } else if (selection.kind === 'units') {
      if (selection.ids.length === 1) {
        const u = sim.world.units.get(selection.ids[0]);
        if (u) {
          hud.setInfo(
            `<h3>${u.role}</h3>` +
              `Task: ${u.task.kind}<br>` +
              (u.carrying ? `Carrying ${u.carrying.resource}` : '') +
              (isCommandable(u) ? '<br><em>Right-click ground to move</em>' : ''),
          );
        }
      } else {
        const n = selection.ids.length;
        hud.setInfo(`<h3>${n} units selected</h3><em>Right-click ground to move them</em>`);
      }
      hud.setAction(null);
    } else {
      hud.setInfo('');
      hud.setAction(null);
    }
    hud.showMarket(marketOpen);
    hud.showBarracks(barracksOpen);

    // Hover tooltip: top-bar inventory chip takes priority, then the building
    // under the cursor.
    const hoverB = hovered && mouse.allowed ? buildingAt(w, hovered.x, hovered.y) : null;
    if (topTip) {
      hud.showTooltip(topTip, mouse.x, mouse.y);
    } else if (hoverB && (mode.kind === 'select' || mode.kind === 'demolish')) {
      hud.showTooltip(buildingStatusHtml(hoverB, false), mouse.x, mouse.y);
    } else {
      hud.hideTooltip();
    }

    hud.setDebug(
      `${hovered ? `tile (${hovered.x}, ${hovered.y})` : 'tile —'}  tick ${w.tick}\n` +
        `keys: 1/2/3 speed · p pause · c center · g paths · w +wood · space cancel`,
    );
  }
}

start();
