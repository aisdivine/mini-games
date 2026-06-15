// Sim -> renderer reconciliation: diff world entities against display objects
// by id each frame. The renderer never mutates the world; the world never
// holds display objects. Also drives purely-cosmetic animation (work swings,
// chop chips) off a render clock — never the sim.

import { Container, Graphics, Sprite } from 'pixi.js';
import { MAP_W, MAP_H, T_ROCK } from '../config';
import type { SimEvent } from '../sim/events';
import type { Fish, Tree, World } from '../sim/world';
import type { ArtTextures } from './assets';
import { tileToScreen } from './iso';
import { animateBuilding, createBuildingView, type BuildingView } from './views/buildingView';
import { createUnitView, tunicColorFor, type UnitView } from './views/unitView';
import type { UnitTextures } from './unitTextures';
import type { BuildingLayers } from './buildingLayers';

interface Effect {
  g: Graphics;
  ttl: number;
  max: number;
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
  private sceneryBuilt = false;
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
  ) {}

  update(world: World, events: SimEvent[], alpha: number, dtMs: number): void {
    this.clock += dtMs;

    if (!this.sceneryBuilt) this.buildScenery(world);
    this.syncTrees(world);
    this.syncFish(world);
    this.syncBuildings(world);
    this.syncUnits(world, alpha);
    this.handleEvents(events);
    this.tickEffects();
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
      animateBuilding(view, b, this.clock);
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
      this.effects.push({ g, ttl: 14, max: 14 });
    }
  }

  private handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'arrow') {
        const from = tileToScreen(e.from.x, e.from.y);
        const to = tileToScreen(e.to.x, e.to.y);
        const g = new Graphics();
        g.moveTo(from.x, from.y - 10)
          .lineTo(to.x, to.y - 8)
          .stroke({ width: 2, color: 0xf5f0dc });
        this.effectLayer.addChild(g);
        this.effects.push({ g, ttl: 10, max: 10 });
      }
    }
  }

  private tickEffects(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.ttl--;
      fx.g.alpha = fx.ttl / fx.max;
      fx.g.y += 0.6; // chips/arrows drift down slightly as they fade
      if (fx.ttl <= 0) {
        fx.g.destroy();
        this.effects.splice(i, 1);
      }
    }
  }
}
