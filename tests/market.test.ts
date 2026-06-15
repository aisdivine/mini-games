import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { MARKET_GOODS, STARTING_GOLD } from '../src/config';

function place(sim: Sim, building: 'market', x: number, y: number): void {
  sim.enqueue({ type: 'placeBuilding', building, tile: { x, y } });
  sim.tick();
}

describe('market & gold', () => {
  it('starts with gold', () => {
    expect(new Sim(1).world.gold).toBe(STARTING_GOLD);
  });

  it('refuses to trade without a market', () => {
    const sim = new Sim(1);
    sim.enqueue({ type: 'trade', resource: 'wood', dir: 'sell' });
    sim.tick();
    expect(sim.drainEvents().some((e) => e.type === 'rejected')).toBe(true);
    expect(sim.world.gold).toBe(STARTING_GOLD);
  });

  it('sells goods for gold and buys goods with gold', () => {
    const sim = new Sim(1);
    place(sim, 'market', 5, 5);
    const wood0 = sim.world.stockpile.wood;
    const gold0 = sim.world.gold;
    const g = MARKET_GOODS.find((x) => x.resource === 'wood')!;

    sim.enqueue({ type: 'trade', resource: 'wood', dir: 'sell' });
    sim.tick();
    expect(sim.world.stockpile.wood).toBe(wood0 - 1);
    expect(sim.world.gold).toBe(gold0 + g.sell);

    sim.enqueue({ type: 'trade', resource: 'wood', dir: 'buy' });
    sim.tick();
    expect(sim.world.stockpile.wood).toBe(wood0); // bought it back
    expect(sim.world.gold).toBe(gold0 + g.sell - g.buy);
  });

  it('cannot buy without enough gold, or sell what you do not have', () => {
    const sim = new Sim(1);
    place(sim, 'market', 5, 5);
    sim.world.gold = 0;
    sim.enqueue({ type: 'trade', resource: 'meat', dir: 'buy' }); // can't afford
    sim.enqueue({ type: 'trade', resource: 'fish', dir: 'sell' }); // none on hand
    sim.tick();
    expect(sim.world.gold).toBe(0);
    expect(sim.world.granaryFood.meat).toBe(0);
    expect(sim.world.granaryFood.fish).toBe(0);
  });
});
