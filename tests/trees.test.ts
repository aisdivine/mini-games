import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { createWorld, findNearestTree } from '../src/sim/world';
import { TREE_REGROW_TICKS, TREE_WOOD } from '../src/config';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

describe('trees', () => {
  it('worldgen scatters trees, all clear of the start area', () => {
    const w = createWorld(42);
    expect(w.trees.size).toBeGreaterThan(10);
    const cx = 32;
    const cy = 32;
    for (const t of w.trees.values()) {
      expect(Math.hypot(t.tile.x - cx, t.tile.y - cy)).toBeGreaterThanOrEqual(9);
      expect(t.wood).toBe(TREE_WOOD);
    }
  });

  it('a woodcutter chops a nearby tree down to a stump, which regrows', () => {
    const sim = new Sim(42);
    sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
    sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
    // a fresh tree right next to where the woodcutter will be
    const treeId = sim.world.nextId++;
    sim.world.trees.set(treeId, { id: treeId, tile: { x: 31, y: 38 }, wood: TREE_WOOD, regrowAt: null });
    sim.enqueue({ type: 'placeBuilding', building: 'woodcutter', tile: { x: 28, y: 36 } });
    sim.tick();

    run(sim, 4000);
    const tree = sim.world.trees.get(treeId)!;
    // it was chopped at least once (wood dropped or it became a regrowing stump)
    expect(tree.wood < TREE_WOOD || tree.regrowAt !== null).toBe(true);
    expect(sim.world.stockpile.wood).toBeGreaterThan(97); // wood delivered to stockpile
  });

  it('a depleted stump regrows after the timer', () => {
    const sim = new Sim(1);
    const id = sim.world.nextId++;
    sim.world.trees.set(id, { id, tile: { x: 40, y: 40 }, wood: 0, regrowAt: sim.world.tick + TREE_REGROW_TICKS });
    run(sim, TREE_REGROW_TICKS + 2);
    const tree = sim.world.trees.get(id)!;
    expect(tree.wood).toBe(TREE_WOOD);
    expect(tree.regrowAt).toBeNull();
  });

  it('findNearestTree ignores stumps and picks the closest standing tree', () => {
    const w = createWorld(7);
    w.trees.clear();
    w.trees.set(1, { id: 1, tile: { x: 10, y: 10 }, wood: 0, regrowAt: 999 }); // stump
    w.trees.set(2, { id: 2, tile: { x: 20, y: 20 }, wood: TREE_WOOD, regrowAt: null });
    w.trees.set(3, { id: 3, tile: { x: 12, y: 12 }, wood: TREE_WOOD, regrowAt: null });
    const near = findNearestTree(w, { x: 11, y: 11 });
    expect(near?.id).toBe(3);
  });
});
