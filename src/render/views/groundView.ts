import { Graphics } from 'pixi.js';
import { MAP_W, MAP_H } from '../../config';
import { diamondPoints } from '../iso';

// Bake the entire static tile grid into ONE Graphics object. Never one
// display object per ground tile.
export function createGroundView(): Graphics {
  const g = new Graphics();
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const shade = (tx + ty) % 2 === 0 ? 0x4a7c3f : 0x447539;
      g.poly(diamondPoints(tx, ty)).fill(shade).stroke({ width: 1, color: 0x3a6531, alpha: 0.6 });
    }
  }
  return g;
}
