import { Graphics } from 'pixi.js';
import { MAP_W, MAP_H } from '../../config';
import { diamondPoints } from '../iso';

// Bake the entire static tile grid into ONE Graphics object. Never one
// display object per ground tile. Soft parchment-green palette so the
// hand-drawn art reads like it was sketched onto the map.
export function createGroundView(): Graphics {
  const g = new Graphics();
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const shade = (tx + ty) % 2 === 0 ? 0xccd6ae : 0xc6d0a8;
      g.poly(diamondPoints(tx, ty)).fill(shade).stroke({ width: 1, color: 0xb2bf92, alpha: 0.45 });
    }
  }
  return g;
}
