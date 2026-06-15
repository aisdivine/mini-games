import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { canPlace } from '../src/sim/grid';
import { BUILDINGS, MAP_W, MAP_H } from '../src/config';

describe('building placement', () => {
  it('rejects out-of-bounds and overlapping footprints', () => {
    const sim = new Sim(7);
    const w = sim.world;
    expect(canPlace(w, BUILDINGS.house, { x: -1, y: 5 })).toBe(false);
    expect(canPlace(w, BUILDINGS.house, { x: MAP_W - 1, y: MAP_H - 1 })).toBe(false);
    // overlapping the pre-placed keep
    const keep = w.buildings.get(w.keepId)!;
    expect(canPlace(w, BUILDINGS.house, { ...keep.tile })).toBe(false);
    expect(canPlace(w, BUILDINGS.house, { x: 5, y: 5 })).toBe(true);
  });

  it('deducts wood on placement and refunds half on demolish', () => {
    const sim = new Sim(7);
    const woodBefore = sim.world.stockpile.wood;
    sim.enqueue({ type: 'placeBuilding', building: 'house', tile: { x: 5, y: 5 } });
    sim.tick();
    expect(sim.world.stockpile.wood).toBe(woodBefore - BUILDINGS.house.costWood);
    const house = [...sim.world.buildings.values()].find((b) => b.type === 'house')!;
    sim.enqueue({ type: 'demolish', buildingId: house.id });
    sim.tick();
    expect(sim.world.buildings.has(house.id)).toBe(false);
    expect(sim.world.stockpile.wood).toBe(
      woodBefore - BUILDINGS.house.costWood + Math.floor(BUILDINGS.house.costWood * 0.5),
    );
  });

  it('rejects placement when wood is short', () => {
    const sim = new Sim(7);
    sim.world.stockpile.wood = 0;
    sim.enqueue({ type: 'placeBuilding', building: 'house', tile: { x: 5, y: 5 } });
    sim.tick();
    const events = sim.drainEvents();
    expect(events.some((e) => e.type === 'rejected')).toBe(true);
    expect([...sim.world.buildings.values()].some((b) => b.type === 'house')).toBe(false);
  });

  it('cannot demolish the keep', () => {
    const sim = new Sim(7);
    sim.enqueue({ type: 'demolish', buildingId: sim.world.keepId });
    sim.tick();
    expect(sim.world.buildings.has(sim.world.keepId)).toBe(true);
  });
});
