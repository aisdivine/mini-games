import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { T_ROCK } from '../src/config';
import { idx } from '../src/sim/grid';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

describe('quarry', () => {
  it('sends a worker to the mountain edge and mines stone into the stockpile', () => {
    const sim = new Sim(42);
    sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
    sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
    // a rock outcrop right beside where the quarry will sit (tight loop)
    sim.world.terrain[idx(31, 38)] = T_ROCK;
    sim.enqueue({ type: 'placeBuilding', building: 'quarry', tile: { x: 28, y: 36 } });
    sim.tick();
    expect(sim.world.stockpile.stone).toBe(0);
    run(sim, 8000);
    expect(sim.world.stockpile.stone).toBeGreaterThan(0);
  });

  it('a quarry with no reachable rock just waits (no crash, no stone)', () => {
    const sim = new Sim(7);
    sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
    sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
    // wipe all rock so there's nothing to mine
    sim.world.terrain.fill(0);
    sim.enqueue({ type: 'placeBuilding', building: 'quarry', tile: { x: 28, y: 36 } });
    sim.tick();
    run(sim, 2000);
    expect(sim.world.stockpile.stone).toBe(0);
  });
});
