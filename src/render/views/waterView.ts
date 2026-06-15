// Living water: an animated shimmer drawn over every water tile from a render
// clock (never the sim). Tile screen-centers are precomputed once from the
// terrain layer; each frame we redraw a couple of drifting highlight arcs per
// tile so the pond and stream ripple. One Graphics, cheap.

import { Graphics } from 'pixi.js';
import { MAP_W, MAP_H, T_WATER, TILE_H } from '../../config';
import type { World } from '../../sim/world';
import { tileToScreen } from '../iso';

export class WaterView {
  readonly g = new Graphics();
  private centers: { x: number; y: number; phase: number }[] = [];

  constructor(world: World) {
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (world.terrain[ty * MAP_W + tx] !== T_WATER) continue;
        const p = tileToScreen(tx + 0.5, ty + 0.5);
        this.centers.push({ x: p.x, y: p.y, phase: (tx * 1.3 + ty * 0.7) % (Math.PI * 2) });
      }
    }
  }

  update(clock: number): void {
    const g = this.g;
    g.clear();
    for (const c of this.centers) {
      const t = clock * 0.0016 + c.phase;
      const drift = Math.sin(t) * 5;
      const alpha = 0.18 + (Math.sin(t * 1.3) * 0.5 + 0.5) * 0.32;
      const y1 = c.y + TILE_H * 0.32 + Math.sin(t * 0.7) * 2;
      g.moveTo(c.x - 9 + drift, y1)
        .quadraticCurveTo(c.x + drift, y1 - 3, c.x + 9 + drift, y1)
        .stroke({ width: 1.4, color: 0xbfe6f0, alpha });
      const y2 = c.y + TILE_H * 0.58 - Math.cos(t) * 2;
      g.moveTo(c.x - 6 - drift, y2)
        .quadraticCurveTo(c.x - drift, y2 - 2, c.x + 6 - drift, y2)
        .stroke({ width: 1.1, color: 0xdff4fa, alpha: alpha * 0.7 });
    }
  }
}
