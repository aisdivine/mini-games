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
  | { type: 'startRaid' } // debug/testing only — not exposed in the UI
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
      const cost: TrainCost = def.cost ?? { wood: def.costWood };
      if (!canAfford(world, cost)) {
        events.push({ type: 'rejected', reason: `Can't afford ${def.label}` });
        return;
      }
      payCost(world, cost);
      const b = placeBuildingRaw(world, cmd.building, cmd.tile);
      applyBuildingUnlocks(world, cmd.building, events);
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
      // Debug/testing hook — force-spawn one raider wave (no longer player-facing;
      // the home is peaceful). Used by combat tests to exercise the raider AI.
      world.raid.triggered = true;
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

/** Support buildings grant permanent training unlocks the moment they're built
 *  (buildings are placed instantly — there's no construction phase). Idempotent:
 *  re-placing a Stable does nothing if the unit is already unlocked. */
function applyBuildingUnlocks(world: World, type: BuildingType, events: SimEvent[]): void {
  const grants: SoldierType[] =
    type === 'stable' ? ['knight', 'camel_lancer'] : type === 'siege_workshop' ? ['mangonel'] : [];
  let unlockedAny = false;
  for (const s of grants) {
    if (!world.unlocked.includes(s)) {
      world.unlocked.push(s);
      unlockedAny = true;
    }
  }
  if (unlockedAny) {
    const labels = grants.map((s) => SOLDIERS[s].label).join(' & ');
    events.push({ type: 'message', text: `🔓 ${BUILDINGS[type].label} built — ${labels} can now be trained!` });
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
