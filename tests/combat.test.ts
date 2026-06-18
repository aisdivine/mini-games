import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { removeBuilding } from '../src/sim/world';
import { MAP_H, RAID_AT_TICK } from '../src/config';

// Only count raid raiders (village guards have a home and stay put).
function raiderCount(sim: Sim): number {
  return [...sim.world.units.values()].filter((u) => u.role === 'raider' && !u.home).length;
}

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

/** Remove enemy villages so combat tests run on a clean field. */
function clearVillages(sim: Sim): void {
  for (const v of sim.world.villages) {
    for (const id of [...v.buildingIds]) {
      const b = sim.world.buildings.get(id);
      if (b) removeBuilding(sim.world, b);
    }
    for (const id of v.defenderIds) sim.world.units.delete(id);
  }
  sim.world.villages = [];
}

function makeSim(): Sim {
  const sim = new Sim(3);
  sim.world.granaryFood.bread = 100000; // keep popularity out of the picture
  sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
  clearVillages(sim);
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

  it('enough archers defeat the raid — keep survives, game keeps playing (no win game-over)', () => {
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
    // Defeating a raid no longer ends the game — it just stays in play.
    expect(raiderCount(sim)).toBe(0);
    expect(sim.world.buildings.has(sim.world.keepId)).toBe(true);
    expect(sim.world.outcome).toBe('playing');
  });

  it('home is peaceful — raids never auto-trigger', () => {
    const sim = makeSim();
    expect(sim.world.raidsEnabled).toBe(false);
    run(sim, RAID_AT_TICK + 100);
    expect(raiderCount(sim)).toBe(0);
    expect(sim.world.raid.triggered).toBe(false);
  });

  it('walled-out raiders attack walls instead of freezing', () => {
    const sim = makeSim();
    sim.world.stockpile.wood = 10000;
    sim.world.terrain.fill(0); // flatten so the test column is unobstructed
    // vertical wall east of the keep, sealing the raiders' approach from the
    // east edge. (Keep ≈ x59-61, stockpile ≈ x66-68, so x=72 is clear.)
    const tiles = [];
    for (let y = 0; y < MAP_H; y++) tiles.push({ x: 72, y });
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
