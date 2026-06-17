// Input -> sim boundary. Handlers enqueue commands; they are validated and
// applied at the top of the next tick. Every player-driven world mutation
// happens here.

import {
  ARCHER_COST_WOOD,
  ARCHER_HP,
  BUILDINGS,
  DEMOLISH_REFUND,
  ELITE_SOLDIERS,
  FOOD_TYPES,
  isSoldier,
  MARKET_GOODS,
  MAX_BUILDING_LEVEL,
  RAID_AT_TICK,
  SOLDIERS,
  upgradeWoodCost,
  type BuildingType,
  type Resource,
  type SoldierType,
  type TrainCost,
} from '../config';
import type { SimEvent } from './events';
import { deposit, resourceCount } from './economy';
import { canPlace } from './grid';
import { totalFood } from './population';
import {
  placeBuildingRaw,
  removeBuilding,
  spawnUnit,
  type Vec2,
  type World,
} from './world';

export type Command =
  | { type: 'placeBuilding'; building: BuildingType; tile: Vec2 }
  | { type: 'placeWalls'; tiles: Vec2[] }
  | { type: 'demolish'; buildingId: number }
  | { type: 'upgrade'; buildingId: number }
  | { type: 'moveUnit'; unitId: number; dest: Vec2 }
  | { type: 'recruitArcher' }
  | { type: 'trainSoldier'; soldier: SoldierType }
  | { type: 'startRaid' }
  | { type: 'setRaids'; on: boolean }
  | { type: 'trade'; resource: Resource; dir: 'buy' | 'sell' }
  | { type: 'spawnPeasant' } // debug
  | { type: 'cheatWood'; amount: number }; // debug

const PROTECTED: BuildingType[] = ['keep', 'campfire', 'stockpile'];

export function applyCommand(world: World, cmd: Command, events: SimEvent[]): void {
  switch (cmd.type) {
    case 'placeBuilding': {
      const def = BUILDINGS[cmd.building];
      if (!def.buildable) return;
      if (!canPlace(world, def, cmd.tile)) {
        events.push({ type: 'rejected', reason: `Cannot place ${def.label} there` });
        return;
      }
      if (world.stockpile.wood < def.costWood) {
        events.push({ type: 'rejected', reason: `Not enough wood (need ${def.costWood})` });
        return;
      }
      world.stockpile.wood -= def.costWood;
      const b = placeBuildingRaw(world, cmd.building, cmd.tile);
      events.push({ type: 'buildingPlaced', id: b.id });
      return;
    }

    case 'placeWalls': {
      const def = BUILDINGS.wall;
      const placeable = cmd.tiles.filter((t) => canPlace(world, def, t));
      const affordable = Math.min(
        placeable.length,
        Math.floor(world.stockpile.wood / def.costWood),
      );
      for (let i = 0; i < affordable; i++) {
        world.stockpile.wood -= def.costWood;
        const b = placeBuildingRaw(world, 'wall', placeable[i]);
        events.push({ type: 'buildingPlaced', id: b.id });
      }
      if (affordable < cmd.tiles.length) {
        events.push({
          type: 'rejected',
          reason: `Placed ${affordable}/${cmd.tiles.length} wall segments`,
        });
      }
      return;
    }

    case 'demolish': {
      const b = world.buildings.get(cmd.buildingId);
      if (!b) return;
      if (PROTECTED.includes(b.type)) {
        events.push({ type: 'rejected', reason: `Cannot demolish the ${BUILDINGS[b.type].label}` });
        return;
      }
      world.stockpile.wood += Math.floor(BUILDINGS[b.type].costWood * DEMOLISH_REFUND);
      removeBuilding(world, b);
      events.push({ type: 'buildingRemoved', id: b.id });
      return;
    }

    case 'upgrade': {
      const b = world.buildings.get(cmd.buildingId);
      if (!b) return;
      if (!BUILDINGS[b.type].recipe) {
        events.push({ type: 'rejected', reason: `${BUILDINGS[b.type].label} can't be upgraded` });
        return;
      }
      if (b.level >= MAX_BUILDING_LEVEL) {
        events.push({ type: 'rejected', reason: `${BUILDINGS[b.type].label} is already max level` });
        return;
      }
      const cost = upgradeWoodCost(b.type, b.level);
      if (world.stockpile.wood < cost) {
        events.push({ type: 'rejected', reason: `Need ${cost} wood to upgrade` });
        return;
      }
      world.stockpile.wood -= cost;
      b.level++;
      events.push({ type: 'upgraded', id: b.id });
      events.push({ type: 'message', text: `${BUILDINGS[b.type].label} upgraded to Lv ${b.level} — faster production!` });
      return;
    }

    case 'moveUnit': {
      // Soldiers only: ordering a bound peasant around would orphan its
      // workplace (workerId stays set but the cycle never resumes).
      const unit = world.units.get(cmd.unitId);
      if (!unit || !isSoldier(unit.role)) return;
      unit.task = { kind: 'goTo', dest: { ...cmd.dest }, then: { kind: 'none' } };
      unit.path = null; // force repath next tick
      unit.targetId = null;
      return;
    }

    case 'recruitArcher': {
      if (world.stockpile.wood < ARCHER_COST_WOOD) {
        events.push({ type: 'rejected', reason: `Not enough wood (need ${ARCHER_COST_WOOD})` });
        return;
      }
      const keep = world.buildings.get(world.keepId);
      if (!keep) return;
      world.stockpile.wood -= ARCHER_COST_WOOD;
      spawnUnit(world, 'archer', { ...keep.accessTile }, ARCHER_HP);
      return;
    }

    case 'trainSoldier': {
      const def = SOLDIERS[cmd.soldier];
      const barracks = [...world.buildings.values()].find((b) => b.type === 'barracks');
      if (!barracks) {
        events.push({ type: 'rejected', reason: 'Build a Barracks to train soldiers' });
        return;
      }
      if (ELITE_SOLDIERS.includes(cmd.soldier) && !world.unlocked.includes(cmd.soldier)) {
        events.push({ type: 'rejected', reason: `${def.label} is locked — conquer its village to unlock` });
        return;
      }
      if (!canAfford(world, def.cost)) {
        events.push({ type: 'rejected', reason: `Can't afford ${def.label}` });
        return;
      }
      payCost(world, def.cost);
      spawnUnit(world, cmd.soldier, { ...barracks.accessTile }, def.hp);
      events.push({ type: 'message', text: `${def.label} trained` });
      return;
    }

    case 'startRaid': {
      world.raid.triggered = true;
      return;
    }

    case 'setRaids': {
      world.raidsEnabled = cmd.on;
      if (cmd.on) {
        // fresh countdown from now (unless a raid is already underway)
        if (!world.raid.triggered) world.nextRaidTick = world.tick + RAID_AT_TICK;
        events.push({ type: 'message', text: '⚔ Raids ON — defend your keep!' });
      } else {
        // back to peace: clear any active raiders and reset the wave
        for (const u of [...world.units.values()]) {
          if (u.role === 'raider') world.units.delete(u.id);
        }
        world.raid = { triggered: false, spawnedCount: 0 };
        world.nextRaidTick = world.tick + RAID_AT_TICK;
        events.push({ type: 'message', text: '☮ Raids OFF — peaceful sandbox' });
      }
      return;
    }

    case 'trade': {
      const hasMarket = [...world.buildings.values()].some((b) => b.type === 'market');
      if (!hasMarket) {
        events.push({ type: 'rejected', reason: 'Build a Market to trade' });
        return;
      }
      const good = MARKET_GOODS.find((g) => g.resource === cmd.resource);
      if (!good) return;
      if (cmd.dir === 'sell') {
        if (resourceCount(world, cmd.resource) < 1) {
          events.push({ type: 'rejected', reason: `No ${cmd.resource} to sell` });
          return;
        }
        deposit(world, cmd.resource, -1);
        world.gold += good.sell;
      } else {
        if (world.gold < good.buy) {
          events.push({ type: 'rejected', reason: `Need ${good.buy} gold` });
          return;
        }
        world.gold -= good.buy;
        deposit(world, cmd.resource, 1);
      }
      return;
    }

    case 'spawnPeasant': {
      spawnUnit(world, 'peasant', { ...world.campfireTile }, 50);
      return;
    }

    case 'cheatWood': {
      world.stockpile.wood += cmd.amount;
      return;
    }
  }
}

function canAfford(world: World, cost: TrainCost): boolean {
  if ((cost.wood ?? 0) > world.stockpile.wood) return false;
  if ((cost.stone ?? 0) > world.stockpile.stone) return false;
  if ((cost.gold ?? 0) > world.gold) return false;
  if ((cost.food ?? 0) > totalFood(world)) return false;
  return true;
}

function payCost(world: World, cost: TrainCost): void {
  if (cost.wood) world.stockpile.wood -= cost.wood;
  if (cost.stone) world.stockpile.stone -= cost.stone;
  if (cost.gold) world.gold -= cost.gold;
  if (cost.food) consumeGranary(world, cost.food);
}

/** Spend `n` food from the granary, drawing from the most-abundant type first. */
function consumeGranary(world: World, n: number): void {
  let left = n;
  while (left > 0) {
    let best: (typeof FOOD_TYPES)[number] | null = null;
    for (const f of FOOD_TYPES) {
      if (world.granaryFood[f] > 0 && (best === null || world.granaryFood[f] > world.granaryFood[best])) best = f;
    }
    if (best === null) break;
    world.granaryFood[best]--;
    left--;
  }
}
