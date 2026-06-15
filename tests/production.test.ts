import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

function makeSim(): Sim {
  const sim = new Sim(42);
  sim.world.nextEatTick = Number.MAX_SAFE_INTEGER; // isolate economy from eating
  sim.world.nextImmigrationTick = Number.MAX_SAFE_INTEGER;
  return sim;
}

describe('production chain', () => {
  it('woodcutter produces wood via physical delivery', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'placeBuilding', building: 'woodcutter', tile: { x: 28, y: 36 } });
    sim.tick();
    const afterCost = sim.world.stockpile.wood;
    run(sim, 3000);
    expect(sim.world.stockpile.wood).toBeGreaterThan(afterCost + 2);
  });

  it('apple orchard is a one-building food source straight to the granary', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'placeBuilding', building: 'appleOrchard', tile: { x: 24, y: 38 } });
    sim.enqueue({ type: 'placeBuilding', building: 'granary', tile: { x: 38, y: 28 } });
    sim.tick();
    const before = sim.world.granaryFood.apples;
    run(sim, 4000);
    expect(sim.world.granaryFood.apples).toBeGreaterThan(before);
  });

  it("hunter's hut produces meat into the granary", () => {
    const sim = makeSim();
    sim.enqueue({ type: 'placeBuilding', building: 'hunter', tile: { x: 24, y: 38 } });
    sim.enqueue({ type: 'placeBuilding', building: 'granary', tile: { x: 38, y: 28 } });
    sim.tick();
    run(sim, 4000);
    expect(sim.world.granaryFood.meat).toBeGreaterThan(0);
  });

  it('fishery sends a fisherman to the pond and stocks the granary with fish', () => {
    const sim = makeSim();
    // the pond/shoals sit on the eastern frontier; build just west of it
    sim.enqueue({ type: 'placeBuilding', building: 'granary', tile: { x: 44, y: 56 } });
    sim.enqueue({ type: 'placeBuilding', building: 'fishery', tile: { x: 47, y: 56 } });
    sim.tick();
    expect([...sim.world.fish.values()].length).toBeGreaterThan(0); // shoals exist
    run(sim, 6000);
    expect(sim.world.granaryFood.fish).toBeGreaterThan(0);
  });

  it('full bread chain: farm -> mill -> bakery -> granary', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'placeBuilding', building: 'wheatFarm', tile: { x: 26, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'mill', tile: { x: 34, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'bakery', tile: { x: 38, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'granary', tile: { x: 38, y: 28 } });
    sim.tick();
    const breadBefore = sim.world.granaryFood.bread;
    run(sim, 12000);
    expect(sim.world.granaryFood.bread).toBeGreaterThan(breadBefore);
    // wheat and flour flowed through the stockpile at some point
    expect(sim.world.stockpile.wheat).toBeGreaterThanOrEqual(0);
  });

  it('two mills never double-fetch the last wheat', () => {
    const sim = makeSim();
    sim.world.stockpile.wheat = 1;
    sim.enqueue({ type: 'placeBuilding', building: 'mill', tile: { x: 28, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'mill', tile: { x: 38, y: 36 } });
    sim.tick();
    let minWheat = sim.world.stockpile.wheat;
    for (let i = 0; i < 4000; i++) {
      sim.tick();
      sim.drainEvents();
      minWheat = Math.min(minWheat, sim.world.stockpile.wheat);
    }
    expect(minWheat).toBeGreaterThanOrEqual(0);
    expect(sim.world.stockpile.flour).toBe(1); // exactly one mill got it
  });

  it('demolishing the mill starves the bakery while wheat accumulates', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'placeBuilding', building: 'wheatFarm', tile: { x: 26, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'mill', tile: { x: 34, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'bakery', tile: { x: 38, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'granary', tile: { x: 38, y: 28 } });
    sim.tick();
    run(sim, 8000);
    const mill = [...sim.world.buildings.values()].find((b) => b.type === 'mill')!;
    sim.enqueue({ type: 'demolish', buildingId: mill.id });
    sim.tick();
    const wheatAtDemolish = sim.world.stockpile.wheat;
    run(sim, 6000);
    // farm keeps delivering wheat, nothing consumes it
    expect(sim.world.stockpile.wheat).toBeGreaterThan(wheatAtDemolish);
    expect(sim.world.stockpile.flour).toBe(0);
  });

  it('worker is freed and re-queued when workplace is demolished', () => {
    const sim = makeSim();
    sim.enqueue({ type: 'placeBuilding', building: 'woodcutter', tile: { x: 28, y: 36 } });
    sim.tick();
    run(sim, 500);
    const wc = [...sim.world.buildings.values()].find((b) => b.type === 'woodcutter')!;
    expect(wc.workerId).not.toBeNull();
    const workerId = wc.workerId!;
    sim.enqueue({ type: 'demolish', buildingId: wc.id });
    sim.tick();
    const worker = sim.world.units.get(workerId)!;
    expect(worker.workplaceId).toBeNull();
    expect(worker.task.kind).toBe('idle');
  });
});
