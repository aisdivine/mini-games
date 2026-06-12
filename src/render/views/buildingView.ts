// Programmer-art building blocks: an extruded iso box over the footprint.
// This factory is the seam where sprites replace shapes later — nothing
// outside views/ knows what a building looks like.

import { Container, Graphics } from 'pixi.js';
import { BUILDINGS } from '../../config';
import { footprintDepth } from '../../sim/grid';
import type { Building } from '../../sim/world';
import { tileToScreen } from '../iso';

export function createBuildingView(b: Building): Container {
  const def = BUILDINGS[b.type];
  const c = new Container();
  const g = new Graphics();
  drawBlock(g, def.size.w, def.size.h, def.height, def.color);
  if (b.type === 'campfire') {
    g.circle(0, 10, 6).fill(0xffb347); // ember glow on top
  }
  c.addChild(g);
  const p = tileToScreen(b.tile.x, b.tile.y);
  c.position.set(p.x, p.y);
  c.zIndex = footprintDepth(b.type, b.tile);
  return c;
}

// Local coords: (0,0) is the TOP corner of the footprint diamond.
function drawBlock(g: Graphics, w: number, h: number, height: number, color: number): void {
  const T = { x: 0, y: 0 };
  const R = { x: w * 32, y: w * 16 };
  const B = { x: (w - h) * 32, y: (w + h) * 16 };
  const L = { x: -h * 32, y: h * 16 };
  const up = -height;

  // left face
  g.poly([L.x, L.y, B.x, B.y, B.x, B.y + up, L.x, L.y + up])
    .fill(shade(color, 0.7));
  // right face
  g.poly([B.x, B.y, R.x, R.y, R.x, R.y + up, B.x, B.y + up])
    .fill(shade(color, 0.5));
  // top face
  g.poly([T.x, T.y + up, R.x, R.y + up, B.x, B.y + up, L.x, L.y + up])
    .fill(color)
    .stroke({ width: 1, color: shade(color, 0.4) });
}

export function shade(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const gr = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (gr << 8) | b;
}
