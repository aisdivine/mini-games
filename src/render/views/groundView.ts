import { Graphics } from 'pixi.js';
import { MAP_W, MAP_H } from '../../config';
import { diamondPoints } from '../iso';

// Bake the entire static tile grid into ONE Graphics object. Never one
// display object per ground tile. Sandy checkerboard, no grid strokes —
// matching the clean flat-shaded asset style.
export function createGroundView(): Graphics {
  const g = new Graphics();
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const shade = (tx + ty) % 2 === 0 ? 0xe4d7a8 : 0xdccf9d;
      g.poly(diamondPoints(tx, ty)).fill(shade);
    }
  }
  return g;
}
