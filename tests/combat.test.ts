import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { MAP_H, RAID_AT_TICK } from '../src/config';

function raiderCount(sim: Sim): number {
  return [...sim.world.units.values()].filter((u) => u.role === 'raider').length;
}

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

function makeSim(): Sim {
  const sim = new Sim(3);
  sim.world.granaryFood.bread = 100000; // keep popularity out of the picture
  sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
  return sim;
}

describe('combat', () => {
  it('undefended raid destroys the keep -> lose', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'startRaid' });
    run(sim, 8000);
    expect(sim.world.outcome).toBe('lost');
    expect(sim.world.buildings.has(sim.world.keepId)).toBe(false);
  });

  it('enough archers defeat the raid -> win', () => {
    const sim = makeSim();
    sim.world.stockpile.wood = 1000;
    for (let i = 0; i < 10; i++) sim.enqueue({ type: 'recruitArcher' });
    sim.tick();
    // station archers right beside the keep so raiders besieging it stay in range
    const keep = sim.world.buildings.get(sim.world.keepId)!;
    let i = 0;
    for (const u of sim.world.units.values()) {
      if (u.role !== 'archer') continue;
      sim.enqueue({ type: 'moveUnit', unitId: u.id, dest: { x: keep.tile.x + 4, y: keep.tile.y - 3 + i } });
      i++;
    }
    run(sim, 200);
    sim.enqueue({ type: 'startRaid' });
    run(sim, 10000);
    expect(sim.world.outcome).toBe('won');
  });

  it('raids are off by default — none auto-trigger', () => {
    const sim = makeSim();
    expect(sim.world.raidsEnabled).toBe(false);
    run(sim, RAID_AT_TICK + 100);
    expect(raiderCount(sim)).toBe(0);
    expect(sim.world.raid.triggered).toBe(false);
  });

  it('toggling raids on schedules a wave; toggling off clears it', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'setRaids', on: true });
    sim.tick();
    expect(sim.world.raidsEnabled).toBe(true);
    run(sim, RAID_AT_TICK + 100); // countdown elapses → wave spawns
    expect(raiderCount(sim)).toBeGreaterThan(0);

    sim.enqueue({ type: 'setRaids', on: false });
    sim.tick();
    expect(sim.world.raidsEnabled).toBe(false);
    expect(raiderCount(sim)).toBe(0); // back to peace
    expect(sim.world.raid.triggered).toBe(false);
  });

  it('walled-out raiders attack walls instead of freezing', () => {
    const sim = makeSim();
    sim.world.stockpile.wood = 10000;
    // vertical wall sealing the east approach... full column
    const tiles = [];
    for (let y = 0; y < MAP_H; y++) tiles.push({ x: 46, y });
    sim.enqueue({ type: 'placeWalls', tiles });
    sim.tick();
    const wallCount = [...sim.world.buildings.values()].filter((b) => b.type === 'wall').length;
    expect(wallCount).toBe(MAP_H);
    sim.enqueue({ type: 'startRaid' });
    run(sim, 4000);
    // raiders must have chewed through at least one wall segment
    const wallsAfter = [...sim.world.buildings.values()].filter((b) => b.type === 'wall').length;
    expect(wallsAfter).toBeLessThan(wallCount);
  });
});
