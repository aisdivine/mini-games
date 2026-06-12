import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { EAT_INTERVAL_TICKS, POPULARITY_FED_DELTA, POPULARITY_HUNGRY_DELTA, POPULARITY_START } from '../src/config';
import { populationCount } from '../src/sim/population';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

describe('population & popularity', () => {
  it('popularity rises when fed', () => {
    const sim = new Sim(9);
    sim.world.granaryBread = 1000;
    run(sim, EAT_INTERVAL_TICKS * 3 + 5);
    expect(sim.world.popularity).toBe(POPULARITY_START + 3 * POPULARITY_FED_DELTA);
    expect(sim.world.granaryBread).toBeLessThan(1000);
  });

  it('popularity falls when the granary is empty', () => {
    const sim = new Sim(9);
    sim.world.granaryBread = 0;
    run(sim, EAT_INTERVAL_TICKS * 2 + 5);
    expect(sim.world.popularity).toBe(POPULARITY_START + 2 * POPULARITY_HUNGRY_DELTA);
  });

  it('starvation collapses popularity and loses the game', () => {
    const sim = new Sim(9);
    sim.world.granaryBread = 0;
    run(sim, EAT_INTERVAL_TICKS * 12);
    expect(sim.world.outcome).toBe('lost');
  });

  it('immigration grows population while popular with free housing', () => {
    const sim = new Sim(9);
    sim.world.granaryBread = 10000;
    sim.enqueue({ type: 'placeBuilding', building: 'house', tile: { x: 20, y: 20 } });
    sim.tick();
    const before = populationCount(sim.world);
    run(sim, 3000);
    expect(populationCount(sim.world)).toBeGreaterThan(before);
  });

  it('peasants emigrate when popularity is low', () => {
    const sim = new Sim(9);
    sim.world.granaryBread = 0;
    sim.world.popularity = 25;
    const before = populationCount(sim.world);
    run(sim, 2500);
    expect(populationCount(sim.world)).toBeLessThan(before);
  });
});
