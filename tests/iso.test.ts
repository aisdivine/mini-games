import { describe, it, expect } from 'vitest';
import { tileToScreen, screenToTile } from '../src/render/iso';
import { TILE_H } from '../src/config';

describe('iso projection', () => {
  it('screenToTile inverts tileToScreen exactly on integer tiles', () => {
    for (let tx = 0; tx < 64; tx += 7) {
      for (let ty = 0; ty < 64; ty += 7) {
        const s = tileToScreen(tx, ty);
        const t = screenToTile(s.x, s.y);
        expect(t.x).toBeCloseTo(tx, 10);
        expect(t.y).toBeCloseTo(ty, 10);
      }
    }
  });

  it('round-trips fuzzed fractional positions', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 1000; i++) {
      const tx = rand() * 64;
      const ty = rand() * 64;
      const s = tileToScreen(tx, ty);
      const t = screenToTile(s.x, s.y);
      expect(t.x).toBeCloseTo(tx, 8);
      expect(t.y).toBeCloseTo(ty, 8);
    }
  });

  it('picks the tile whose diamond center is hovered', () => {
    // Center of tile (tx, ty)'s diamond is its top corner + half tile height.
    for (const [tx, ty] of [[0, 0], [5, 3], [63, 63]] as const) {
      const top = tileToScreen(tx, ty);
      const t = screenToTile(top.x, top.y + TILE_H / 2);
      expect(Math.floor(t.x)).toBe(tx);
      expect(Math.floor(t.y)).toBe(ty);
    }
  });
});
