import { describe, it, expect } from 'vitest';
import { createWorld, idx, isMature, type World } from '../src/sim/world';
import {
  applyTile,
  buySeed,
  giftHelper,
  plant,
  sellHarvest,
  sleep,
  till,
  water,
} from '../src/sim/actions';
import { serialize, deserialize } from '../src/sim/save';
import { CROPS, MAX_ENERGY, TILL_ENERGY } from '../src/config';

// A known grass tile (createWorld keeps the field clear except the pond / path).
const G = { x: 6, y: 5 };
const crop = (w: World, x: number, y: number) => w.crops[idx(x, y)];

/** Plant a parsnip on freshly tilled soil at G. */
function planted(): World {
  const w = createWorld();
  till(w, G.x, G.y);
  plant(w, G.x, G.y, 'parsnip');
  return w;
}

describe('tools', () => {
  it('hoe turns grass into soil and costs energy', () => {
    const w = createWorld();
    const e0 = w.energy;
    expect(till(w, G.x, G.y).ok).toBe(true);
    expect(w.terrain[idx(G.x, G.y)]).toBe(1); // T_SOIL
    expect(w.energy).toBe(e0 - TILL_ENERGY);
    expect(till(w, G.x, G.y).ok).toBe(false); // already tilled
  });

  it('cannot till the pond', () => {
    const w = createWorld();
    expect(till(w, w.w - 4, w.h - 3).ok).toBe(false); // a water tile
  });

  it('planting needs tilled soil and a seed; consumes one', () => {
    const w = createWorld();
    expect(plant(w, G.x, G.y, 'parsnip').ok).toBe(false); // grass, not tilled
    till(w, G.x, G.y);
    const s0 = w.seeds.parsnip;
    expect(plant(w, G.x, G.y, 'parsnip').ok).toBe(true);
    expect(w.seeds.parsnip).toBe(s0 - 1);
    expect(crop(w, G.x, G.y)?.type).toBe('parsnip');
    // no seeds of a type you don't own
    till(w, G.x + 1, G.y);
    expect(plant(w, G.x + 1, G.y, 'pumpkin').ok).toBe(false);
  });

  it('watering requires a planted crop', () => {
    const w = createWorld();
    till(w, G.x, G.y);
    expect(water(w, G.x, G.y).ok).toBe(false); // nothing planted
    plant(w, G.x, G.y, 'parsnip');
    expect(water(w, G.x, G.y).ok).toBe(true);
    expect(crop(w, G.x, G.y)?.watered).toBe(true);
  });

  it('too tired to act', () => {
    const w = createWorld();
    w.energy = 1;
    expect(till(w, G.x, G.y).ok).toBe(false);
  });
});

describe('growth & harvest', () => {
  it('watered crops grow overnight and dry out; unwatered ones wait', () => {
    const w = createWorld();
    // Two decoys soak up the farmhand's morning watering (budget is 2 at 0
    // hearts), so our higher-index test crop is left for us to prove the rule.
    till(w, G.x, G.y); plant(w, G.x, G.y, 'parsnip');
    till(w, G.x + 1, G.y); plant(w, G.x + 1, G.y, 'parsnip');
    till(w, G.x + 2, G.y); plant(w, G.x + 2, G.y, 'parsnip');
    sleep(w);
    expect(crop(w, G.x + 2, G.y)?.stage).toBe(0); // unwatered → no growth
    water(w, G.x + 2, G.y);
    sleep(w);
    expect(crop(w, G.x + 2, G.y)?.stage).toBe(1); // watered → grew
    expect(crop(w, G.x + 2, G.y)?.watered).toBe(false); // dried out
  });

  it('matures after its day count, then harvests for inventory', () => {
    const w = planted();
    const days = CROPS.parsnip.days;
    for (let i = 0; i < days; i++) {
      water(w, G.x, G.y);
      sleep(w);
    }
    expect(isMature(w, G.x, G.y)).toBe(true);
    // applyTile harvests a ready crop regardless of the held tool
    const r = applyTile(w, G.x, G.y, 'hoe', 'parsnip');
    expect(r.ok).toBe(true);
    expect(w.harvest.parsnip).toBe(1);
    expect(crop(w, G.x, G.y)).toBeNull();
    expect(w.terrain[idx(G.x, G.y)]).toBe(1); // stays tilled for replant
  });

  it('sleep refills energy and advances the day', () => {
    const w = planted();
    w.energy = 5;
    const d0 = w.day;
    sleep(w);
    expect(w.energy).toBe(MAX_ENERGY);
    expect(w.day).toBe(d0 + 1);
  });
});

describe('economy', () => {
  it('buys seeds and sells harvest', () => {
    const w = createWorld();
    const g0 = w.gold;
    expect(buySeed(w, 'potato').ok).toBe(true);
    expect(w.gold).toBe(g0 - CROPS.potato.seedCost);
    expect(w.seeds.potato).toBe(1);

    w.harvest.parsnip = 3;
    expect(sellHarvest(w, 'parsnip').ok).toBe(true);
    expect(w.harvest.parsnip).toBe(0);
    expect(w.gold).toBe(g0 - CROPS.potato.seedCost + 3 * CROPS.parsnip.sell);
  });

  it('rejects unaffordable buys and empty sells', () => {
    const w = createWorld();
    w.gold = 0;
    expect(buySeed(w, 'pumpkin').ok).toBe(false);
    expect(sellHarvest(w, 'parsnip').ok).toBe(false);
  });
});

describe('farmhand', () => {
  it('gifting raises mood, once per day, and needs a harvested crop', () => {
    const w = createWorld();
    expect(giftHelper(w).ok).toBe(false); // nothing to gift
    w.harvest.parsnip = 2;
    const a0 = w.helperMood;
    expect(giftHelper(w).ok).toBe(true);
    expect(w.helperMood).toBeGreaterThan(a0);
    expect(w.harvest.parsnip).toBe(1);
    expect(giftHelper(w).ok).toBe(false); // already gifted today
    sleep(w);
    expect(giftHelper(w).ok).toBe(true); // new day, gift again
  });

  it('waters your unwatered crops each morning, up to the budget', () => {
    const w = createWorld();
    // three unwatered crops; with 0 hearts the farmhand waters exactly 2
    for (let i = 0; i < 3; i++) {
      till(w, G.x + i, G.y);
      plant(w, G.x + i, G.y, 'parsnip');
    }
    w.energy = MAX_ENERGY;
    sleep(w);
    const grown = [0, 1, 2].map((i) => crop(w, G.x + i, G.y)?.stage ?? 0);
    expect(grown.filter((s) => s === 1).length).toBe(2); // watered 2 → 2 grew
    expect(grown.filter((s) => s === 0).length).toBe(1);
  });
});

describe('save', () => {
  it('round-trips the world', () => {
    const w = planted();
    water(w, G.x, G.y);
    sleep(w);
    w.gold = 999;
    w.helperMood = 40;
    const back = deserialize(serialize(w))!;
    expect(back).not.toBeNull();
    expect(back.gold).toBe(999);
    expect(back.day).toBe(w.day);
    expect(back.helperMood).toBe(40);
    expect(crop(back, G.x, G.y)?.stage).toBe(1);
  });

  it('rejects a version mismatch', () => {
    expect(deserialize('{"version":999,"world":{}}')).toBeNull();
  });
});
