import { Graphics } from 'pixi.js';
import { MAP_W, MAP_H, T_ROCK, T_WATER } from '../../config';
import type { World } from '../../sim/world';
import { diamondPoints } from '../iso';

// Per-terrain two-tone checkerboards (art-spec palette): sandy grass, blue
// water, grey rock. Baked into ONE Graphics — never a display object per tile.
const PALETTE: Record<number, [number, number, number]> = {
  // [shade A, shade B, edge]
  0: [0xe6d49c, 0xdecb8e, 0xc9b377], // grass
  [T_WATER]: [0x4a86c4, 0x4079b8, 0x6aa3d8], // water
  [T_ROCK]: [0x9a958c, 0x8d887f, 0xb0aaa0], // rock
};

// Bake the entire static tile grid into one Graphics object, colored by the
// world's terrain layer.
export function createGroundView(world: World): Graphics {
  const g = new Graphics();
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const terrain = world.terrain[ty * MAP_W + tx];
      const [a, b, edge] = PALETTE[terrain] ?? PALETTE[0];
      const shade = (tx + ty) % 2 === 0 ? a : b;
      g.poly(diamondPoints(tx, ty)).fill(shade).stroke({ width: 0.5, color: edge, alpha: 0.4 });
      // a soft lighter rim on water tiles that touch land reads as a shoreline
      if (terrain === T_WATER && shoreEdge(world, tx, ty)) {
        g.poly(diamondPoints(tx, ty)).stroke({ width: 1.5, color: 0x9fd0ec, alpha: 0.5 });
      }
    }
  }
  return g;
}

function shoreEdge(world: World, tx: number, ty: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
    if (world.terrain[ny * MAP_W + nx] !== T_WATER) return true;
  }
  return false;
}
