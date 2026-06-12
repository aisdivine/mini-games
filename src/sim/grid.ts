import { BUILDINGS, MAP_W, MAP_H, type BuildingDef } from '../config';
import type { Vec2, World } from './world';

export function idx(tx: number, ty: number): number {
  return ty * MAP_W + tx;
}

export function inBounds(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
}

export function isPassable(world: World, tx: number, ty: number): boolean {
  return inBounds(tx, ty) && world.occupancy[idx(tx, ty)] === 0;
}

/** Footprint fits, all tiles free, and (for worker buildings) the access tile
 *  is passable so units can reach it. */
export function canPlace(world: World, def: BuildingDef, tile: Vec2): boolean {
  const { w, h } = def.size;
  if (!inBounds(tile.x, tile.y) || !inBounds(tile.x + w - 1, tile.y + h - 1)) return false;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (world.occupancy[idx(tile.x + dx, tile.y + dy)] !== 0) return false;
    }
  }
  // Access tile: just outside the east corner, orthogonally adjacent.
  if (def.recipe || def.type === 'keep' || def.type === 'stockpile' || def.type === 'granary') {
    if (!isPassable(world, tile.x + w, tile.y + h - 1)) return false;
  }
  return true;
}

export function footprintTiles(def: BuildingDef, tile: Vec2): Vec2[] {
  const tiles: Vec2[] = [];
  for (let dy = 0; dy < def.size.h; dy++) {
    for (let dx = 0; dx < def.size.w; dx++) {
      tiles.push({ x: tile.x + dx, y: tile.y + dy });
    }
  }
  return tiles;
}

/** Highest tx+ty over a building's footprint — its render depth. */
export function footprintDepth(type: keyof typeof BUILDINGS, tile: Vec2): number {
  const def = BUILDINGS[type];
  return tile.x + def.size.w - 1 + tile.y + def.size.h - 1;
}
