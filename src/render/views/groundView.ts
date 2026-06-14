import { Graphics } from 'pixi.js';
import { MAP_W, MAP_H } from '../../config';
import { diamondPoints } from '../iso';

// Bake the entire static tile grid into ONE Graphics object. Never one
// display object per ground tile. Sand checkerboard using the v2 art-spec
// palette (Sand tile A / B), with a faint edge for tile definition.
export function createGroundView(): Graphics {
  const g = new Graphics();
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const shade = (tx + ty) % 2 === 0 ? 0xe6d49c : 0xdecb8e;
      g.poly(diamondPoints(tx, ty)).fill(shade).stroke({ width: 0.5, color: 0xc9b377, alpha: 0.4 });
    }
  }
  return g;
}
