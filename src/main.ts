// Composition root — the only file that knows both the sim and the renderer.

import {
  ARCHER_COST_WOOD,
  BUILDINGS,
  EDGE_PAN_MARGIN,
  EDGE_PAN_SPEED,
  MARKET_GOODS,
  MAX_ACCUM_MS,
  MAX_BUILDING_LEVEL,
  SIM_DT_MS,
  SIM_TICKS_PER_SEC,
  upgradeWoodCost,
  workTicksAtLevel,
  type BuildingType,
  type Resource,
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
import { loadUnitTextures } from './render/unitTextures';
import iconsSvg from './art/v2/icons.svg?raw';
import { Camera } from './render/camera';
import { tileToScreen } from './render/iso';
import { Atmosphere } from './render/atmosphere';
import { AmbientLife, loadAmbientLife } from './render/ambientLife';
import { SceneSync } from './render/sceneSync';
import { Container } from 'pixi.js';
import { createGroundView } from './render/views/groundView';
import { WaterView } from './render/views/waterView';
import { OverlayView } from './render/views/overlayView';
import { setupPointer } from './input/pointer';
import { Hotkeys } from './input/hotkeys';
import { Hud } from './ui/hud';

const SAVE_KEY = 'stronghold.save.v1';
const AUTOSAVE_MS = 30_000;

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
  | { kind: 'unit'; id: number }
  | { kind: 'building'; id: number };

const BUILD_ORDER: BuildingType[] = [
  'house', 'granary', 'appleOrchard', 'hunter', 'fishery', 'woodcutter', 'wheatFarm', 'mill', 'bakery', 'market', 'tower',
];

// HUD resource icon id for a tradeable resource.
const RESOURCE_ICON: Record<Resource, string> = {
  wood: 'i-wood', wheat: 'i-wheat', flour: 'i-flour',
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

  const [art, unitTex, buildingLayers, lifeTex] = await Promise.all([
    loadArtTextures(),
    loadUnitTextures(),
    loadBuildingLayers(),
    loadAmbientLife(),
  ]);
  const groundView = createGroundView(sim.world);
  layers.ground.addChild(groundView);
  const water = new WaterView(sim.world);
  layers.ground.addChild(water.g);
  const overlay = new OverlayView();
  layers.overlay.addChild(overlay.container);
  const sceneSync = new SceneSync(layers.entities, layers.overlay, art, unitTex, buildingLayers);

  // Ambient wildlife: a sky layer (above the world) for birds; the camel rides
  // the depth-sorted entity layer.
  const sky = new Container();
  sky.sortableChildren = true;
  layers.world.addChild(sky);
  const ambient = new AmbientLife(sky, layers.entities, lifeTex);

  // Screen-space lighting overlay lives on the stage, above the panned world.
  // Phones default to NIGHT mode (dark + easy on the eyes); desktops to DAY.
  const atmosphere = new Atmosphere();
  app.stage.addChild(atmosphere.g);
  const isMobile =
    window.matchMedia?.('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) ||
    window.innerWidth <= 860;
  atmosphere.setMode(isMobile ? 'night' : 'day');

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
        label: `${BUILDINGS[t].label} (${BUILDINGS[t].costWood})`,
        hint: BUILDINGS[t].recipe ? 'Needs a worker peasant' : undefined,
      })),
      { id: 'wall', label: `Wall (${BUILDINGS.wall.costWood}/tile)`, hint: 'Click-drag to draw' },
      { id: 'archer', label: `Archer (${ARCHER_COST_WOOD})`, hint: 'Recruited at the keep' },
      { id: 'raids', label: '⚔ Raids: Off', hint: 'Toggle enemy raids on/off' },
      { id: 'demolish', label: 'Demolish', hint: 'Click a building to remove it (50% refund)' },
      { id: 'resetview', label: 'Reset View', hint: 'Re-center on the keep (Home / c)' },
      { id: 'save', label: '💾 Save', hint: 'Save your city now (also autosaves every 30s · S)' },
      { id: 'newgame', label: 'New Game' },
    ],
    (id) => {
      if (id === 'archer') {
        sim.enqueue({ type: 'recruitArcher' });
      } else if (id === 'raids') {
        sim.enqueue({ type: 'setRaids', on: !sim.world.raidsEnabled });
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
      { id: 'pause', label: '⏸', hint: 'Pause / resume (Space)' },
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
  hotkeys.bind('s', saveGame);
  hotkeys.bind('S', saveGame);
  hotkeys.bind('Home', resetView);
  hotkeys.bind('c', resetView); // 'c' = center, easier to reach than Home
  hotkeys.bind('g', () => (overlay.debugPaths = !overlay.debugPaths));
  hotkeys.bind('n', () => {
    atmosphere.toggle();
    hud.showMessage(atmosphere.mode === 'night' ? '🌙 Night mode' : '☀️ Day mode');
  });
  hotkeys.bind('w', () => sim.enqueue({ type: 'cheatWood', amount: 100 }));
  hotkeys.bind('p', () => sim.enqueue({ type: 'spawnPeasant' }));
  hotkeys.bind('r', () => sim.enqueue({ type: 'startRaid' }));

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
    const raidIn = w.raid.triggered
      ? null
      : Math.max(0, Math.ceil((w.nextRaidTick - w.tick) / SIM_TICKS_PER_SEC));
    const mmss = raidIn !== null
      ? `${Math.floor(raidIn / 60)}:${String(raidIn % 60).padStart(2, '0')}`
      : null;
    const raidStat = !w.raidsEnabled
      ? `<span class="stat" title="Raids are off — peaceful sandbox. Toggle in the build menu.">☮ peaceful</span>`
      : mmss
        ? `<span class="stat" title="Time until the next enemy raid arrives from the east.">⚔ raid in ${mmss}</span>`
        : `<span class="stat" title="A raid is underway — defend your keep!">⚔ raid!</span>`;
    // keep the build-menu toggle's label in sync with the live state
    hud.setButtonLabel(
      'raids',
      w.raidsEnabled ? '⚔ Raids: On' : '⚔ Raids: Off',
      w.raidsEnabled ? 'Enemy raids enabled — click to return to peace' : 'No raids — click to enable enemy attacks',
    );
    // play-control labels
    hud.setButtonLabel('pause', paused ? '▶' : '⏸', paused ? 'Resume (Space)' : 'Pause (Space)');
    hud.setButtonLabel('speed', `${speed}×`, 'Cycle game speed (1/2/3)');
    const icon = (id: string): string => `<svg class="hud-icon"><use href="#${id}"/></svg>`;
    const t = (s: string): string => ` title="${s}"`;
    hud.setTopBar(
      [
        `<span class="stat"${t('Wood — your main building material. Woodcutters chop it from trees.')}>${icon('i-wood')} ${w.stockpile.wood}</span>`,
        `<span class="stat"${t('Wheat — grown on Wheat Farms, milled into flour.')}>${icon('i-wheat')} ${w.stockpile.wheat}</span>`,
        `<span class="stat"${t('Flour — milled from wheat at the Mill, baked into bread.')}>${icon('i-flour')} ${w.stockpile.flour}</span>`,
        `<span class="stat"${t('Food in the granary: bread / apples / meat / fish. Peasants eat every 20s; a varied diet boosts popularity.')}>${icon('i-bread')} ${w.granaryFood.bread} ${icon('i-apple')} ${w.granaryFood.apples} ${icon('i-meat')} ${w.granaryFood.meat} ${icon('i-fish')} ${w.granaryFood.fish}</span>`,
        `<span class="stat"${t('Gold — earned by selling goods at the Market, spent buying goods you need.')}>🪙 ${w.gold}</span>`,
        `<span class="stat"${t('Population / housing capacity. Build Houses to raise the cap so more peasants can move in.')}>👥 ${pop}/${housing}</span>`,
        `<span class="stat"${t('Popularity — rises when peasants are fed (varied diet helps), falls when they starve. Hits 0 = you lose.')}>❤️ ${w.popularity} (food ${w.lastFoodDelta >= 0 ? '+' : ''}${w.lastFoodDelta})</span>`,
        raidStat,
        `<span class="stat"${t('Game speed — 1/2/3 to change, Space to pause.')}>${paused ? '⏸ paused' : `▶ ${speed}×`}</span>`,
      ].join(''),
    );

    let marketOpen = false;
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
      hud.setAction(null);
    } else {
      hud.setInfo('');
      hud.setAction(null);
    }
    hud.showMarket(marketOpen);

    // Hover tooltip: status of the building under the cursor.
    const hoverB = hovered && mouse.allowed ? buildingAt(w, hovered.x, hovered.y) : null;
    if (hoverB && (mode.kind === 'select' || mode.kind === 'demolish')) {
      hud.showTooltip(buildingStatusHtml(hoverB, false), mouse.x, mouse.y);
    } else {
      hud.hideTooltip();
    }

    hud.setDebug(
      `${hovered ? `tile (${hovered.x}, ${hovered.y})` : 'tile —'}  tick ${w.tick}\n` +
        `keys: 1/2/3 speed · space pause · c center · g paths · w +wood · p +peasant · esc cancel`,
    );
  }
}

start();
