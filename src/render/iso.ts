// Isometric projection math. Pure functions — shared by rendering and input
// picking. tileToScreen returns the TOP corner of the tile's diamond.

import { TILE_W, TILE_H } from '../config';

export interface Vec2 {
  x: number;
  y: number;
}

export function tileToScreen(tx: number, ty: number): Vec2 {
  return {
    x: (tx - ty) * (TILE_W / 2),
    y: (tx + ty) * (TILE_H / 2),
  };
}

// Inverse projection. Returns fractional tile coords; floor to pick a tile.
export function screenToTile(sx: number, sy: number): Vec2 {
  return {
    x: (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2,
    y: (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2,
  };
}

// Flat point list [x0,y0, x1,y1, ...] for the diamond of tile (tx, ty):
// top, right, bottom, left.
export function diamondPoints(tx: number, ty: number): number[] {
  const { x, y } = tileToScreen(tx, ty);
  return [
    x, y,
    x + TILE_W / 2, y + TILE_H / 2,
    x, y + TILE_H,
    x - TILE_W / 2, y + TILE_H / 2,
  ];
}
