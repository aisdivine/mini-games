import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import {
  EAT_INTERVAL_TICKS,
  POPULARITY_FED_DELTA,
  POPULARITY_HUNGRY_DELTA,
  POPULARITY_START,
  POPULARITY_VARIETY_BONUS_MAX,
} from '../src/config';
import { populationCount, totalFood } from '../src/sim/population';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

describe('population & popularity', () => {
  it('popularity rises when fed (single food type, no variety bonus)', () => {
    const sim = new Sim(9);
    sim.world.granaryFood = { bread: 1000, apples: 0, meat: 0, fish: 0 };
    run(sim, EAT_INTERVAL_TICKS * 3 + 5);
    expect(sim.world.popularity).toBe(POPULARITY_START + 3 * POPULARITY_FED_DELTA);
    expect(sim.world.granaryFood.bread).toBeLessThan(1000);
  });

  it('a varied diet gives a bigger popularity boost', () => {
    const sim = new Sim(9);
    sim.world.granaryFood = { bread: 1000, apples: 1000, meat: 1000, fish: 0 };
    run(sim, EAT_INTERVAL_TICKS + 5);
    // fed delta + variety bonus (3 food types -> +2, capped)
    expect(sim.world.popularity).toBe(
      POPULARITY_START + POPULARITY_FED_DELTA + POPULARITY_VARIETY_BONUS_MAX,
    );
  });

  it('popularity falls when the granary is empty', () => {
    const sim = new Sim(9);
    sim.world.granaryFood = { bread: 0, apples: 0, meat: 0, fish: 0 };
    run(sim, EAT_INTERVAL_TICKS * 2 + 5);
    expect(sim.world.popularity).toBe(POPULARITY_START + 2 * POPULARITY_HUNGRY_DELTA);
  });

  it('starvation collapses popularity and loses the game', () => {
    const sim = new Sim(9);
    sim.world.granaryFood = { bread: 0, apples: 0, meat: 0, fish: 0 };
    run(sim, EAT_INTERVAL_TICKS * 16);
    expect(sim.world.outcome).toBe('lost');
  });

  it('eats from multiple food types, drawing down the total', () => {
    const sim = new Sim(9);
    sim.world.granaryFood = { bread: 5, apples: 5, meat: 5, fish: 0 };
    const before = totalFood(sim.world);
    run(sim, EAT_INTERVAL_TICKS + 5);
    expect(totalFood(sim.world)).toBeLessThan(before);
  });

  it('immigration grows population while popular with free housing', () => {
    const sim = new Sim(9);
    sim.world.granaryFood = { bread: 10000, apples: 0, meat: 0, fish: 0 };
    sim.enqueue({ type: 'placeBuilding', building: 'house', tile: { x: 20, y: 20 } });
    sim.tick();
    const before = populationCount(sim.world);
    run(sim, 3000);
    expect(populationCount(sim.world)).toBeGreaterThan(before);
  });

  it('peasants emigrate when popularity is low', () => {
    const sim = new Sim(9);
    sim.world.granaryFood = { bread: 0, apples: 0, meat: 0, fish: 0 };
    sim.world.popularity = 25;
    const before = populationCount(sim.world);
    run(sim, 2500);
    expect(populationCount(sim.world)).toBeLessThan(before);
  });
});
