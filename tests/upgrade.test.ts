import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { MAX_BUILDING_LEVEL, upgradeWoodCost, workTicksAtLevel, BUILDINGS } from '../src/config';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

describe('building upgrades', () => {
  it('spends wood and raises the level', () => {
    const sim = new Sim(5);
    sim.world.stockpile.wood = 1000;
    sim.enqueue({ type: 'placeBuilding', building: 'bakery', tile: { x: 38, y: 28 } });
    sim.tick();
    const b = [...sim.world.buildings.values()].find((x) => x.type === 'bakery')!;
    expect(b.level).toBe(1);
    const woodBefore = sim.world.stockpile.wood;
    const cost = upgradeWoodCost('bakery', 1);
    sim.enqueue({ type: 'upgrade', buildingId: b.id });
    sim.tick();
    expect(b.level).toBe(2);
    expect(sim.world.stockpile.wood).toBe(woodBefore - cost);
  });

  it('rejects upgrade when wood is short, and caps at max level', () => {
    const sim = new Sim(5);
    sim.world.stockpile.wood = 50;
    sim.enqueue({ type: 'placeBuilding', building: 'mill', tile: { x: 38, y: 28 } });
    sim.tick();
    const b = [...sim.world.buildings.values()].find((x) => x.type === 'mill')!;
    sim.world.stockpile.wood = 0; // now too poor to upgrade
    sim.enqueue({ type: 'upgrade', buildingId: b.id });
    sim.tick();
    expect(b.level).toBe(1); // too poor

    sim.world.stockpile.wood = 100000;
    for (let i = 0; i < MAX_BUILDING_LEVEL + 3; i++) {
      sim.enqueue({ type: 'upgrade', buildingId: b.id });
      sim.tick();
    }
    expect(b.level).toBe(MAX_BUILDING_LEVEL);
  });

  it('non-production buildings cannot be upgraded', () => {
    const sim = new Sim(5);
    sim.world.stockpile.wood = 1000;
    sim.enqueue({ type: 'placeBuilding', building: 'house', tile: { x: 38, y: 28 } });
    sim.tick();
    const h = [...sim.world.buildings.values()].find((x) => x.type === 'house')!;
    sim.enqueue({ type: 'upgrade', buildingId: h.id });
    sim.tick();
    expect(h.level).toBe(1);
  });

  it('higher level means a shorter craft time', () => {
    const base = BUILDINGS.bakery.recipe!.workTicks;
    expect(workTicksAtLevel(base, 2)).toBeLessThan(workTicksAtLevel(base, 1));
    expect(workTicksAtLevel(base, 3)).toBeLessThan(workTicksAtLevel(base, 2));
  });

  it('an upgraded woodcutter out-produces a level-1 one', () => {
    const make = (level: number): number => {
      const sim = new Sim(42);
      sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
      sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
      sim.world.stockpile.wood = 1000;
      // a tree right next to the woodcutter for a tight, comparable loop
      const t = sim.world.nextId++;
      sim.world.trees.set(t, { id: t, tile: { x: 31, y: 38 }, wood: 9999, regrowAt: null });
      sim.enqueue({ type: 'placeBuilding', building: 'woodcutter', tile: { x: 28, y: 36 } });
      sim.tick();
      const b = [...sim.world.buildings.values()].find((x) => x.type === 'woodcutter')!;
      for (let i = 1; i < level; i++) {
        sim.enqueue({ type: 'upgrade', buildingId: b.id });
        sim.tick();
      }
      const before = sim.world.stockpile.wood;
      run(sim, 3000);
      return sim.world.stockpile.wood - before;
    };
    expect(make(MAX_BUILDING_LEVEL)).toBeGreaterThan(make(1));
  });
});
