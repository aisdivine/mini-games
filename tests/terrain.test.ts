import { describe, it, expect } from 'vitest';
import { createWorld, shoreTileNear, findNearestFish } from '../src/sim/world';
import { canPlace, isPassable } from '../src/sim/grid';
import { BUILDINGS, MAP_W, MAP_H, T_GRASS, T_ROCK, T_WATER } from '../src/config';

describe('terrain & nature', () => {
  it('worldgen carves water (a pond/stream) and rock (a mountain)', () => {
    const w = createWorld(42);
    let water = 0;
    let rock = 0;
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      if (w.terrain[i] === T_WATER) water++;
      else if (w.terrain[i] === T_ROCK) rock++;
    }
    expect(water).toBeGreaterThan(10);
    expect(rock).toBeGreaterThan(10);
  });

  it('water and rock are impassable and unbuildable', () => {
    const w = createWorld(42);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = w.terrain[y * MAP_W + x];
        if (t === T_WATER || t === T_ROCK) {
          expect(isPassable(w, x, y)).toBe(false);
          expect(canPlace(w, BUILDINGS.house, { x, y })).toBe(false);
        }
      }
    }
  });

  it('keeps the start ring clear of terrain so the keep stays usable', () => {
    const w = createWorld(42);
    const cx = MAP_W >> 1;
    const cy = MAP_H >> 1;
    for (let y = cy - 8; y <= cy + 8; y++) {
      for (let x = cx - 8; x <= cx + 8; x++) {
        if (Math.hypot(x - cx, y - cy) < 8) {
          expect(w.terrain[y * MAP_W + x]).toBe(T_GRASS);
        }
      }
    }
  });

  it('seeds fish shoals on water, each with a reachable shore', () => {
    const w = createWorld(42);
    expect(w.fish.size).toBeGreaterThan(0);
    for (const f of w.fish.values()) {
      expect(w.terrain[f.tile.y * MAP_W + f.tile.x]).toBe(T_WATER);
      expect(shoreTileNear(w, f.tile)).not.toBeNull();
    }
    expect(findNearestFish(w, { x: MAP_W >> 1, y: MAP_H >> 1 })).not.toBeNull();
  });
});
