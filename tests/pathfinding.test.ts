import { describe, it, expect } from 'vitest';
import { createWorld, placeBuildingRaw } from '../src/sim/world';
import { findPath, findPathToBuilding } from '../src/sim/pathfinding';

describe('A* pathfinding', () => {
  it('finds a straight line on open ground', () => {
    const w = createWorld(1);
    const path = findPath(w, { x: 5.5, y: 5.5 }, { x: 10, y: 5 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5);
    expect(path![path!.length - 1]).toEqual({ x: 10, y: 5 });
  });

  it('detours around a building', () => {
    const w = createWorld(1);
    // 3x3 wall of keep at (8,4)..(10,6) directly between start and goal row 5
    placeBuildingRaw(w, 'keep', { x: 8, y: 4 });
    const path = findPath(w, { x: 5.5, y: 5.5 }, { x: 14, y: 5 });
    expect(path).not.toBeNull();
    // must be longer than the straight 9 steps
    expect(path!.length).toBeGreaterThan(9);
    // never crosses the footprint
    for (const t of path!) {
      const inside = t.x >= 8 && t.x <= 10 && t.y >= 4 && t.y <= 6;
      expect(inside).toBe(false);
    }
  });

  it('returns null when the goal is fully walled in', () => {
    const w = createWorld(1);
    // ring of walls around (5,5)
    for (const [x, y] of [[4, 4], [5, 4], [6, 4], [4, 5], [6, 5], [4, 6], [5, 6], [6, 6]]) {
      placeBuildingRaw(w, 'wall', { x, y });
    }
    expect(findPath(w, { x: 10.5, y: 10.5 }, { x: 5, y: 5 })).toBeNull();
  });

  it('returns null when the goal tile is occupied', () => {
    const w = createWorld(1);
    placeBuildingRaw(w, 'wall', { x: 7, y: 7 });
    expect(findPath(w, { x: 5.5, y: 5.5 }, { x: 7, y: 7 })).toBeNull();
  });

  it('paths to a tile adjacent to a building', () => {
    const w = createWorld(1);
    const b = placeBuildingRaw(w, 'tower', { x: 20, y: 20 });
    const path = findPathToBuilding(w, { x: 5.5, y: 5.5 }, b);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];
    const adjacent =
      last.x >= 19 && last.x <= 22 && last.y >= 19 && last.y <= 22 &&
      !(last.x >= 20 && last.x <= 21 && last.y >= 20 && last.y <= 21);
    expect(adjacent).toBe(true);
  });
});
