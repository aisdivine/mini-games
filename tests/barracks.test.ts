import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { RAIDER_HP } from '../src/config';
import { spawnUnit, type Unit } from '../src/sim/world';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}
function placeBarracks(sim: Sim): void {
  sim.world.unlocked = ['knight', 'crossbowman', 'camel_lancer', 'mangonel']; // ungate elites for tests
  sim.enqueue({ type: 'placeBuilding', building: 'barracks', tile: { x: 5, y: 5 } });
  sim.tick();
}
const soldiers = (sim: Sim, role: string): Unit[] =>
  [...sim.world.units.values()].filter((u) => u.role === role);

describe('barracks & soldiers', () => {
  it('refuses to train without a barracks', () => {
    const sim = new Sim(1);
    sim.enqueue({ type: 'trainSoldier', soldier: 'spearman' });
    sim.tick();
    expect(sim.drainEvents().some((e) => e.type === 'rejected')).toBe(true);
    expect(soldiers(sim, 'spearman').length).toBe(0);
  });

  it('trains a soldier and deducts its cost', () => {
    const sim = new Sim(1);
    placeBarracks(sim);
    const wood0 = sim.world.stockpile.wood;
    sim.enqueue({ type: 'trainSoldier', soldier: 'spearman' });
    sim.tick();
    expect(soldiers(sim, 'spearman').length).toBe(1);
    expect(sim.world.stockpile.wood).toBe(wood0 - 6); // spearman costs 6 wood
  });

  it('soldiers obey a right-click move order (not just archers)', () => {
    const sim = new Sim(1);
    sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
    sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
    placeBarracks(sim);
    for (const role of ['spearman', 'knight'] as const) {
      sim.enqueue({ type: 'trainSoldier', soldier: role });
    }
    sim.world.gold = 100;
    sim.world.stockpile.stone = 50;
    sim.tick();
    for (const role of ['spearman', 'knight'] as const) {
      const u = soldiers(sim, role)[0];
      expect(u, `${role} trained`).toBeTruthy();
      const startX = u.pos.x;
      const dest = { x: Math.floor(u.pos.x) + 12, y: Math.floor(u.pos.y) };
      sim.enqueue({ type: 'moveUnit', unitId: u.id, dest });
      run(sim, 400);
      expect(Math.abs(u.pos.x - startX), `${role} moved`).toBeGreaterThan(3);
    }
  });

  it('a trained knight cuts down a lone raider', () => {
    const sim = new Sim(1);
    sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
    sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
    sim.world.gold = 100;
    sim.world.stockpile.stone = 50;
    placeBarracks(sim);
    sim.enqueue({ type: 'trainSoldier', soldier: 'knight' });
    sim.tick();
    const knight = soldiers(sim, 'knight')[0];
    expect(knight).toBeTruthy();
    // a lone (non-village) raider right next to the knight
    const loose = (): Unit[] =>
      [...sim.world.units.values()].filter((u) => u.role === 'raider');
    spawnUnit(sim.world, 'raider', { x: knight.pos.x + 1, y: knight.pos.y }, RAIDER_HP);
    expect(loose().length).toBe(1);
    run(sim, 500);
    expect(loose().length).toBe(0); // raider defeated
    expect(soldiers(sim, 'knight').length).toBe(1); // knight survives
  });
});
