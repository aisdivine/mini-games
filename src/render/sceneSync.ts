// Sim -> renderer reconciliation: diff world entities against display objects
// by id each frame. The renderer never mutates the world; the world never
// holds display objects. Also drives purely-cosmetic animation (work swings,
// chop chips) off a render clock — never the sim.

import { Container, Graphics, Sprite } from 'pixi.js';
import { BUILDINGS, MAP_W, MAP_H, T_GRASS, T_ROCK, T_WATER } from '../config';
import type { SimEvent } from '../sim/events';
import type { Fish, Tree, World } from '../sim/world';
import type { ArtTextures } from './assets';
import { tileToScreen } from './iso';
import { animateBuilding, createBuildingView, type BuildingView } from './views/buildingView';
import { createUnitView, tunicColorFor, type UnitView } from './views/unitView';
import type { UnitTextures } from './unitTextures';
import type { BuildingLayers } from './buildingLayers';
import type { CombatFx } from './combatFx';

interface Effect {
  g: Container; // Graphics (procedural) or Sprite (combat FX)
  ttl: number;
  max: number;
  vy: number; // vertical drift per tick (negative = rises)
  grow: number; // scale added per tick
}

interface TreeView {
  container: Container;
  sprite: Sprite;
  stump: boolean;
}

interface FishView {
  container: Container;
  sprite: Sprite;
  empty: boolean;
}

export class SceneSync {
  private buildingViews = new Map<number, BuildingView>();
  private unitViews = new Map<number, UnitView>();
  private treeViews = new Map<number, TreeView>();
  private fishViews = new Map<number, FishView>();
  private reedViews: { c: Container; phase: number }[] = [];
  private sceneryBuilt = false;
  private night = 0; // 0..1 day/night amount, for window glow
  private effects: Effect[] = [];
  private clock = 0; // ms, render-only
  /** last swing sign per working woodcutter, to spawn one chip per downstroke */
  private chopPhase = new Map<number, number>();

  constructor(
    private entityLayer: Container,
    private effectLayer: Container,
    private art: ArtTextures,
    private units: UnitTextures,
    private layers: BuildingLayers,
    private fx: CombatFx,
  ) {}

  /** Spawn a short-lived combat FX sprite at a world tile point. */
  private spawnFx(key: string, wx: number, wy: number, opts: { ttl: number; grow: number; vy: number; yOff?: number; tint?: number }): void {
    const f = this.fx.get(key);
    if (!f) return;
    const s = new Sprite(f.texture);
    s.anchor.set(f.ax, f.ay);
    if (opts.tint !== undefined) s.tint = opts.tint;
    const p = tileToScreen(wx, wy);
    s.position.set(p.x, p.y + (opts.yOff ?? -18));
    this.effectLayer.addChild(s);
    this.effects.push({ g: s, ttl: opts.ttl, max: opts.ttl, vy: opts.vy, grow: opts.grow });
  }

  update(world: World, events: SimEvent[], alpha: number, dtMs: number, night = 0): void {
    this.clock += dtMs;
    this.night = night;

    if (!this.sceneryBuilt) this.buildScenery(world);
    this.animateReeds();
    this.syncTrees(world);
    this.syncFish(world);
    this.syncBuildings(world);
    this.syncUnits(world, alpha);
    this.handleEvents(world, events);
    this.tickEffects();
  }

  private animateReeds(): void {
    for (const r of this.reedViews) {
      r.c.skew.x = Math.sin(this.clock * 0.0024 + r.phase) * 0.12;
    }
  }

  /** Static terrain decor (mountain peaks), placed once from the terrain layer.
   *  Peaks are taller toward the mountain's center so the blob reads as a ridge
   *  rather than a field of identical cones. */
  private buildScenery(world: World): void {
    this.sceneryBuilt = true;
    const rocks: { x: number; y: number }[] = [];
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (world.terrain[y * MAP_W + x] === T_ROCK) {
          rocks.push({ x, y });
          sumX += x;
          sumY += y;
        }
      }
    }
    if (rocks.length === 0) return;
    const cx = sumX / rocks.length;
    const cy = sumY / rocks.length;
    const maxD = Math.max(1, ...rocks.map((r) => Math.hypot(r.x - cx, r.y - cy)));
    const entry = this.art.get('mountain')!;
    for (const r of rocks) {
      const hash = ((r.x * 73856093) ^ (r.y * 19349663)) >>> 0;
      const near = Math.hypot(r.x - cx, r.y - cy) < maxD * 0.45;
      if (!near && hash % 5 !== 0) continue; // sparse peaks on the outskirts
      const closeness = 1 - Math.hypot(r.x - cx, r.y - cy) / (maxD + 1);
      const scale = 0.55 + closeness * 0.85; // center peaks ~1.4x, edge ~0.6x
      const sprite = new Sprite(entry.texture);
      sprite.position.set(-entry.anchor.x, -entry.anchor.y);
      const container = new Container();
      container.addChild(sprite);
      container.scale.set(scale);
      const p = tileToScreen(r.x + 0.5, r.y + 0.5);
      container.position.set(p.x, p.y);
      container.zIndex = r.x + r.y;
      this.entityLayer.addChild(container);
    }

    this.buildReeds(world);
  }

  /** Reed clumps on the shore — grass tiles touching water. Deterministic
   *  subset so the pond/stream edges read as a living wetland. */
  private buildReeds(world: World): void {
    const entry = this.art.get('reeds');
    if (!entry) return;
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        if (world.terrain[i] !== T_GRASS || world.occupancy[i] !== 0) continue;
        const touchesWater =
          world.terrain[i - 1] === T_WATER || world.terrain[i + 1] === T_WATER ||
          world.terrain[i - MAP_W] === T_WATER || world.terrain[i + MAP_W] === T_WATER;
        if (!touchesWater) continue;
        if (((x * 31 + y * 17) >>> 0) % 3 !== 0) continue; // ~1/3 of shore tiles
        const sprite = new Sprite(entry.texture);
        sprite.position.set(-entry.anchor.x, -entry.anchor.y);
        const c = new Container();
        c.addChild(sprite);
        const p = tileToScreen(x + 0.5, y + 0.5);
        c.position.set(p.x, p.y);
        c.zIndex = x + y + 0.3;
        this.entityLayer.addChild(c);
        this.reedViews.push({ c, phase: (x * 1.7 + y) % (Math.PI * 2) });
      }
    }
  }

  private syncFish(world: World): void {
    for (const [id, f] of world.fish) {
      let view = this.fishViews.get(id);
      if (!view) {
        view = this.createFishView(f);
        this.fishViews.set(id, view);
        this.entityLayer.addChild(view.container);
      }
      const isEmpty = f.fish <= 0;
      if (isEmpty !== view.empty) {
        view.sprite.alpha = isEmpty ? 0.2 : 1; // faded ripple while restocking
        view.empty = isEmpty;
      }
      // gentle bob/drift on the water surface
      const t = this.clock * 0.003 + f.id * 1.3;
      view.sprite.y = Math.sin(t) * 1.5;
      view.sprite.x = Math.cos(t * 0.7) * 1.2;
    }
    for (const [id, view] of this.fishViews) {
      if (!world.fish.has(id)) {
        view.container.destroy({ children: true });
        this.fishViews.delete(id);
      }
    }
  }

  private createFishView(f: Fish): FishView {
    const entry = this.art.get('fish')!;
    const sprite = new Sprite(entry.texture);
    sprite.position.set(-entry.anchor.x, -entry.anchor.y);
    const container = new Container();
    container.addChild(sprite);
    const p = tileToScreen(f.tile.x + 0.5, f.tile.y + 0.5);
    container.position.set(p.x, p.y);
    container.zIndex = f.tile.x + f.tile.y - 0.4;
    return { container, sprite, empty: f.fish <= 0 };
  }

  private syncTrees(world: World): void {
    for (const [id, t] of world.trees) {
      let view = this.treeViews.get(id);
      if (!view) {
        view = this.createTreeView(t);
        this.treeViews.set(id, view);
        this.entityLayer.addChild(view.container);
      }
      const isStump = t.wood <= 0;
      if (isStump !== view.stump) {
        view.sprite.texture = this.art.get(isStump ? 'stump' : 'tree')!.texture;
        view.stump = isStump;
      }
    }
    for (const [id, view] of this.treeViews) {
      if (!world.trees.has(id)) {
        view.container.destroy({ children: true });
        this.treeViews.delete(id);
      }
    }
  }

  private createTreeView(t: Tree): TreeView {
    const entry = this.art.get('tree')!;
    const sprite = new Sprite(entry.texture);
    sprite.position.set(-entry.anchor.x, -entry.anchor.y);
    const container = new Container();
    container.addChild(sprite);
    const p = tileToScreen(t.tile.x + 0.5, t.tile.y + 0.5);
    container.position.set(p.x, p.y);
    container.zIndex = t.tile.x + t.tile.y - 0.5;
    return { container, sprite, stump: t.wood <= 0 };
  }

  private syncBuildings(world: World): void {
    for (const [id, b] of world.buildings) {
      let view = this.buildingViews.get(id);
      if (!view) {
        view = createBuildingView(b, this.art, this.layers);
        this.buildingViews.set(id, view);
        this.entityLayer.addChild(view.container);
      }
      if (view.base) view.base.tint = b.owner === 'enemy' ? 0xff7a6a : 0xffffff;
      animateBuilding(view, b, this.clock, this.night);
    }
    for (const [id, view] of this.buildingViews) {
      if (!world.buildings.has(id)) {
        view.container.destroy({ children: true });
        this.buildingViews.delete(id);
      }
    }
  }

  private syncUnits(world: World, alpha: number): void {
    for (const [id, u] of world.units) {
      let view = this.unitViews.get(id);
      if (!view) {
        view = createUnitView(u, this.units);
        this.unitViews.set(id, view);
        this.entityLayer.addChild(view.container);
      }
      const lx = u.prevPos.x + (u.pos.x - u.prevPos.x) * alpha;
      const ly = u.prevPos.y + (u.pos.y - u.prevPos.y) * alpha;
      const p = tileToScreen(lx, ly);

      // Tunic color reflects the unit's current job (building it's bound to).
      const wp = u.workplaceId !== null ? world.buildings.get(u.workplaceId) : undefined;

      // Cosmetic animation, driven by the render clock (not the sim): work
      // motions when laboring, a bouncy gait while walking.
      let rot = 0;
      let bob = 0;
      const phase = u.id * 1.7;
      if (u.task.kind === 'workAt') {
        if (wp?.type === 'woodcutter') {
          const s = Math.sin(this.clock * 0.02 + phase);
          rot = s * 0.42; // axe swing
          this.maybeChip(u.id, s, p);
        } else if (wp?.type === 'fishery') {
          rot = Math.sin(this.clock * 0.0045 + phase) * 0.16; // slow rod cast/sway
        } else {
          bob = -Math.abs(Math.sin(this.clock * 0.013 + phase)) * 2.5; // labor bob
        }
      } else if (u.pos.x !== u.prevPos.x || u.pos.y !== u.prevPos.y) {
        const t = this.clock * 0.022 + phase; // walking gait
        bob = -Math.abs(Math.sin(t)) * 2.2;
        rot = Math.sin(t) * 0.06;
      }
      view.container.position.set(p.x, p.y + bob);
      view.container.rotation = rot;
      view.container.zIndex = lx + ly - 1 - 0.01;
      view.container.visible = !u.insideBuilding;
      view.refresh(u, tunicColorFor(u.role, wp?.type ?? null));
    }
    for (const [id, view] of this.unitViews) {
      if (!world.units.has(id)) {
        view.container.destroy({ children: true });
        this.unitViews.delete(id);
        this.chopPhase.delete(id);
      }
    }
  }

  /** Spawn a wood chip on each downstroke of a woodcutter's swing. */
  private maybeChip(id: number, s: number, p: { x: number; y: number }): void {
    const prev = this.chopPhase.get(id) ?? 0;
    this.chopPhase.set(id, s);
    if (prev <= 0.9 && s > 0.9) {
      const g = new Graphics();
      g.poly([0, 0, 4, 2, 1, 4]).fill(0xc9a26a);
      g.position.set(p.x + 6, p.y - 18);
      this.effectLayer.addChild(g);
      this.effects.push({ g, ttl: 14, max: 14, vy: 0.6, grow: 0 });
    }
  }

  private handleEvents(world: World, events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'arrow') {
        const from = tileToScreen(e.from.x, e.from.y);
        const to = tileToScreen(e.to.x, e.to.y);
        const g = new Graphics();
        g.moveTo(from.x, from.y - 10)
          .lineTo(to.x, to.y - 8)
          .stroke({ width: 2, color: 0xf5f0dc });
        this.effectLayer.addChild(g);
        this.effects.push({ g, ttl: 10, max: 10, vy: 0.6, grow: 0 });
      } else if (e.type === 'buildingPlaced') {
        this.spawnDust(world, e.id);
      } else if (e.type === 'upgraded') {
        this.spawnSparkle(world, e.id);
      } else if (e.type === 'hit') {
        if (e.kind === 'melee') this.spawnFx('slash', e.x, e.y, { ttl: 6, grow: 0.06, vy: 0 });
        if (e.kind === 'charge') this.spawnFx('charge', e.x, e.y, { ttl: 12, grow: 0.05, vy: 0.3, yOff: -8 });
        this.spawnFx('impact', e.x, e.y, { ttl: 7, grow: 0.07, vy: 0 });
      } else if (e.type === 'fallen') {
        this.spawnFx('fallen', e.x, e.y, {
          ttl: 90, grow: 0, vy: 0, yOff: -4, tint: e.enemy ? 0xff7a6a : 0xffffff,
        });
      }
    }
  }

  /** A puff of dust at a freshly placed building's footprint center. */
  private spawnDust(world: World, id: number): void {
    const p = this.buildingCenter(world, id);
    if (!p) return;
    const g = new Graphics();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.circle(Math.cos(a) * 10, Math.sin(a) * 5 + 4, 5).fill({ color: 0xd8c8a0, alpha: 0.7 });
    }
    g.position.set(p.x, p.y);
    this.effectLayer.addChild(g);
    this.effects.push({ g, ttl: 26, max: 26, vy: -0.5, grow: 0.025 });
  }

  /** A gold sparkle burst when a building levels up. */
  private spawnSparkle(world: World, id: number): void {
    const p = this.buildingCenter(world, id);
    if (!p) return;
    const g = new Graphics();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const r = 12;
      g.star(Math.cos(a) * r, Math.sin(a) * r - 18, 4, 3).fill({ color: 0xf4d87a });
    }
    g.position.set(p.x, p.y);
    this.effectLayer.addChild(g);
    this.effects.push({ g, ttl: 34, max: 34, vy: -0.45, grow: 0.02 });
  }

  private buildingCenter(world: World, id: number): { x: number; y: number } | null {
    const b = world.buildings.get(id);
    if (!b) return null;
    const { w, h } = BUILDINGS[b.type].size;
    return tileToScreen(b.tile.x + w / 2, b.tile.y + h / 2);
  }

  private tickEffects(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.ttl--;
      fx.g.alpha = fx.ttl / fx.max;
      fx.g.y += fx.vy;
      if (fx.grow) fx.g.scale.set(fx.g.scale.x + fx.grow);
      if (fx.ttl <= 0) {
        fx.g.destroy();
        this.effects.splice(i, 1);
      }
    }
  }
}
