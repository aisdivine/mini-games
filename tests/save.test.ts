import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { serializeWorld, deserializeWorld } from '../src/sim/save';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

describe('save/load', () => {
  it('round-trips and stays deterministic: save, load, run both 1000 ticks, identical', () => {
    const sim = new Sim(1234);
    sim.enqueue({ type: 'placeBuilding', building: 'woodcutter', tile: { x: 28, y: 36 } });
    sim.enqueue({ type: 'placeBuilding', building: 'wheatFarm', tile: { x: 26, y: 40 } });
    sim.enqueue({ type: 'placeBuilding', building: 'house', tile: { x: 40, y: 30 } });
    run(sim, 1000);

    const snapshot = serializeWorld(sim.world);
    const loaded = deserializeWorld(snapshot);
    expect(loaded).not.toBeNull();

    const sim2 = new Sim(0, loaded!);
    run(sim, 1000);
    run(sim2, 1000);
    expect(serializeWorld(sim2.world)).toBe(serializeWorld(sim.world));
  });

  it('rejects garbage and wrong versions', () => {
    expect(deserializeWorld('not json')).toBeNull();
    expect(deserializeWorld('{"version":999,"world":{}}')).toBeNull();
  });
});
