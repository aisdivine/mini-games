import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { spawnUnit } from '../src/sim/world';
import { RAIDER_HP, SOLDIERS } from '../src/config';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

/** Take popularity/immigration out of the picture for combat-focused tests. */
function freeze(sim: Sim): void {
  sim.world.nextEatTick = Number.MAX_SAFE_INTEGER;
  sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
  sim.world.granaryFood.bread = 100000;
}

/** Stock the treasury so any support building is affordable. */
function rich(sim: Sim): void {
  sim.world.stockpile.wood = 1000;
  sim.world.stockpile.stone = 1000;
  sim.world.gold = 1000;
}

describe('army support buildings', () => {
  it('Stable unlocks Knight + Camel Lancer for training', () => {
    const sim = new Sim(1);
    rich(sim);
    expect(sim.world.unlocked).not.toContain('knight');
    expect(sim.world.unlocked).not.toContain('camel_lancer');
    sim.enqueue({ type: 'placeBuilding', building: 'stable', tile: { x: 5, y: 5 } });
    sim.tick();
    expect(sim.world.unlocked).toContain('knight');
    expect(sim.world.unlocked).toContain('camel_lancer');

    // ...and they actually train at the barracks now.
    sim.enqueue({ type: 'placeBuilding', building: 'barracks', tile: { x: 15, y: 5 } });
    sim.tick();
    sim.enqueue({ type: 'trainSoldier', soldier: 'knight' });
    sim.tick();
    expect([...sim.world.units.values()].some((u) => u.role === 'knight')).toBe(true);
  });

  it('Siege Workshop unlocks the Mangonel', () => {
    const sim = new Sim(1);
    rich(sim);
    expect(sim.world.unlocked).not.toContain('mangonel');
    sim.enqueue({ type: 'placeBuilding', building: 'siege_workshop', tile: { x: 5, y: 5 } });
    sim.tick();
    expect(sim.world.unlocked).toContain('mangonel');
  });

  it('Blacksmith buffs player soldiers: more damage dealt, less taken', () => {
    // A knight fights a lone raider with and without a Blacksmith standing.
    const fight = (withSmith: boolean): number => {
      const sim = new Sim(7);
      freeze(sim);
      rich(sim);
      if (withSmith) {
        sim.enqueue({ type: 'placeBuilding', building: 'blacksmith', tile: { x: 5, y: 5 } });
        sim.tick();
      }
      const knight = spawnUnit(sim.world, 'knight', { x: 40, y: 40 }, SOLDIERS.knight.hp);
      spawnUnit(sim.world, 'raider', { x: knight.pos.x + 1, y: knight.pos.y }, RAIDER_HP);
      run(sim, 500);
      const loose = [...sim.world.units.values()].filter((u) => u.role === 'raider' && !u.home);
      expect(loose.length, 'knight defeats the raider either way').toBe(0);
      const survivor = sim.world.units.get(knight.id);
      expect(survivor, 'knight survives either way').toBeTruthy();
      return survivor!.hp;
    };
    const hpPlain = fight(false);
    const hpBuffed = fight(true);
    // With a blacksmith the knight kills faster and absorbs less, so it ends with
    // strictly more HP than the unbuffed run.
    expect(hpBuffed).toBeGreaterThan(hpPlain);
  });
});
