import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { createWorld } from '../src/sim/world';
import { canPlace, idx } from '../src/sim/grid';
import { BUILDINGS, T_GRASS, VILLAGE_GROW_INTERVAL, VILLAGE_INCOME_INTERVAL, VILLAGE_RADIUS, VILLAGE_TYPES, MAP_W } from '../src/config';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

describe('enemy villages & conquest', () => {
  it('worldgen places enemy villages with enemy buildings and guards', () => {
    const w = createWorld(5);
    expect(w.villages.length).toBeGreaterThan(0);
    for (const v of w.villages) {
      expect(v.captured).toBe(false);
      expect(v.defenderIds.length).toBeGreaterThan(0);
      for (const id of v.buildingIds) expect(w.buildings.get(id)?.owner).toBe('enemy');
      for (const id of v.defenderIds) expect(w.units.get(id)?.home).not.toBeNull();
    }
  });

  it('defeating all defenders captures the village: buildings flip, unit unlocks', () => {
    const sim = new Sim(5);
    const v = sim.world.villages[0];
    const type = VILLAGE_TYPES.find((t) => t.key === v.typeKey)!;
    expect(sim.world.unlocked).not.toContain(type.unlock);
    for (const id of v.defenderIds) sim.world.units.delete(id); // wipe the garrison
    sim.tick(); // checkCaptures runs in combat
    expect(v.captured).toBe(true);
    for (const id of v.buildingIds) expect(sim.world.buildings.get(id)?.owner).toBe('player');
    expect(sim.world.unlocked).toContain(type.unlock);
  });

  it('living rivals: an uncaptured village builds up over time', () => {
    const sim = new Sim(5);
    const v = sim.world.villages[0];
    const b0 = v.buildingIds.length;
    const g0 = v.defenderIds.length;
    run(sim, VILLAGE_GROW_INTERVAL * 3 + 5);
    expect(v.captured).toBe(false);
    expect(v.buildingIds.length).toBeGreaterThan(b0); // raised more buildings
    expect(v.defenderIds.length).toBeGreaterThan(g0); // posted more guards
  });

  it('captured villages pay passive income', () => {
    const sim = new Sim(5);
    sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
    sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
    for (const v of sim.world.villages) for (const id of v.defenderIds) sim.world.units.delete(id);
    sim.tick();
    expect(sim.world.villages.every((v) => v.captured)).toBe(true);
    const wealth = (): number =>
      sim.world.gold + sim.world.stockpile.wood + sim.world.stockpile.stone + sim.world.granaryFood.bread;
    const before = wealth();
    run(sim, VILLAGE_INCOME_INTERVAL + 2);
    expect(wealth()).toBeGreaterThan(before);
  });

  it('enemy territory blocks building until the village is captured', () => {
    const sim = new Sim(5);
    const v = sim.world.villages[0];
    // find a free grass tile inside the no-build zone
    let spot: { x: number; y: number } | null = null;
    for (let r = 2; r <= VILLAGE_RADIUS - 1 && !spot; r++) {
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]] as const) {
        const x = v.center.x + dx, y = v.center.y + dy;
        if (x < 1 || y < 1 || x >= MAP_W - 1) continue;
        const i = idx(x, y);
        if (sim.world.terrain[i] === T_GRASS && sim.world.occupancy[i] === 0 &&
            sim.world.occupancy[idx(x + 1, y)] === 0 && sim.world.occupancy[idx(x, y + 1)] === 0) {
          spot = { x, y };
        }
      }
    }
    expect(spot).not.toBeNull();
    expect(canPlace(sim.world, BUILDINGS.house, spot!)).toBe(false); // enemy land
    for (const id of v.defenderIds) sim.world.units.delete(id);
    sim.tick();
    expect(canPlace(sim.world, BUILDINGS.house, spot!)).toBe(true); // ours now
  });
});
