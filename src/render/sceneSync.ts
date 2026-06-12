// Sim -> renderer reconciliation: diff world entities against display objects
// by id each frame. The renderer never mutates the world; the world never
// holds display objects.

import { Container, Graphics } from 'pixi.js';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import type { ArtTextures } from './assets';
import { tileToScreen } from './iso';
import { createBuildingView } from './views/buildingView';
import { createUnitView, type UnitView } from './views/unitView';

interface Effect {
  g: Graphics;
  ttl: number;
}

export class SceneSync {
  private buildingViews = new Map<number, Container>();
  private unitViews = new Map<number, UnitView>();
  private effects: Effect[] = [];

  constructor(
    private entityLayer: Container,
    private effectLayer: Container,
    private art: ArtTextures,
  ) {}

  update(world: World, events: SimEvent[], alpha: number): void {
    // Buildings: create new, remove vanished.
    for (const [id, b] of world.buildings) {
      if (!this.buildingViews.has(id)) {
        const view = createBuildingView(b, this.art);
        this.buildingViews.set(id, view);
        this.entityLayer.addChild(view);
      }
    }
    for (const [id, view] of this.buildingViews) {
      if (!world.buildings.has(id)) {
        view.destroy({ children: true });
        this.buildingViews.delete(id);
      }
    }

    // Units: reconcile + interpolate between prevPos and pos.
    for (const [id, u] of world.units) {
      let view = this.unitViews.get(id);
      if (!view) {
        view = createUnitView(u, this.art);
        this.unitViews.set(id, view);
        this.entityLayer.addChild(view.container);
      }
      const lx = u.prevPos.x + (u.pos.x - u.prevPos.x) * alpha;
      const ly = u.prevPos.y + (u.pos.y - u.prevPos.y) * alpha;
      const p = tileToScreen(lx, ly);
      view.container.position.set(p.x, p.y);
      // -0.01 keeps a unit *behind* a structure when tied on depth.
      view.container.zIndex = lx + ly - 1 - 0.01;
      view.container.visible = !u.insideBuilding;
      view.refresh(u);
    }
    for (const [id, view] of this.unitViews) {
      if (!world.units.has(id)) {
        view.container.destroy({ children: true });
        this.unitViews.delete(id);
      }
    }

    // One-shot effects.
    for (const e of events) {
      if (e.type === 'arrow') {
        const from = tileToScreen(e.from.x, e.from.y);
        const to = tileToScreen(e.to.x, e.to.y);
        const g = new Graphics();
        g.moveTo(from.x, from.y - 10)
          .lineTo(to.x, to.y - 8)
          .stroke({ width: 2, color: 0xf5f0dc });
        this.effectLayer.addChild(g);
        this.effects.push({ g, ttl: 10 });
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.ttl--;
      fx.g.alpha = fx.ttl / 10;
      if (fx.ttl <= 0) {
        fx.g.destroy();
        this.effects.splice(i, 1);
      }
    }
  }
}
