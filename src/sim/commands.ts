// Input -> sim boundary. Handlers enqueue commands; they are validated and
// applied at the top of the next tick. Every player-driven world mutation
// happens here.

import {
  ARCHER_COST_WOOD,
  ARCHER_HP,
  BUILDINGS,
  DEMOLISH_REFUND,
  type BuildingType,
} from '../config';
import type { SimEvent } from './events';
import { canPlace } from './grid';
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
  | { type: 'moveUnit'; unitId: number; dest: Vec2 }
  | { type: 'recruitArcher' }
  | { type: 'startRaid' }
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

    case 'moveUnit': {
      const unit = world.units.get(cmd.unitId);
      if (!unit || unit.role === 'raider') return;
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

    case 'startRaid': {
      world.raid.triggered = true;
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
