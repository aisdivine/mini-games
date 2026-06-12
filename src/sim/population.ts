// Food consumption, popularity, immigration/emigration, and the
// popularity-collapse lose condition.

import {
  BUILDINGS,
  EAT_INTERVAL_TICKS,
  EMIGRATION_MAX_POPULARITY,
  IMMIGRATION_INTERVAL_TICKS,
  IMMIGRATION_MIN_POPULARITY,
  POPULARITY_FED_DELTA,
  POPULARITY_HUNGRY_DELTA,
} from '../config';
import type { SimEvent } from './events';
import { spawnUnit, unbindFromWorkplace, type Unit, type World } from './world';
import { edgeTileNear } from './units';

export function populationCount(world: World): number {
  let n = 0;
  for (const u of world.units.values()) {
    if (u.role === 'peasant' || u.role === 'archer') n++;
  }
  return n;
}

export function housingCapacity(world: World): number {
  let cap = 0;
  for (const b of world.buildings.values()) {
    cap += BUILDINGS[b.type].housing ?? 0;
  }
  return cap;
}

export function updatePopulation(world: World, events: SimEvent[]): void {
  const pop = populationCount(world);

  // Eating: abstract rations from the granary, no walking trips.
  if (world.tick >= world.nextEatTick) {
    world.nextEatTick = world.tick + EAT_INTERVAL_TICKS;
    if (pop > 0) {
      const need = Math.ceil(pop / 4);
      if (world.granaryBread >= need) {
        world.granaryBread -= need;
        world.popularity = Math.min(100, world.popularity + POPULARITY_FED_DELTA);
        world.lastFoodDelta = POPULARITY_FED_DELTA;
      } else {
        world.granaryBread = 0;
        world.popularity = Math.max(0, world.popularity + POPULARITY_HUNGRY_DELTA);
        world.lastFoodDelta = POPULARITY_HUNGRY_DELTA;
        events.push({ type: 'message', text: 'Not enough bread — popularity falling!' });
      }
    }
  }

  // Immigration / emigration.
  if (world.tick >= world.nextImmigrationTick) {
    world.nextImmigrationTick = world.tick + IMMIGRATION_INTERVAL_TICKS;
    const housing = housingCapacity(world);
    if (world.popularity > IMMIGRATION_MIN_POPULARITY && pop < housing) {
      const spawnAt = edgeTileNear(world, world.campfireTile.y);
      const unit = spawnUnit(world, 'peasant', spawnAt, 50);
      unit.task = { kind: 'goTo', dest: { ...world.campfireTile }, then: { kind: 'none' } };
    } else if (world.popularity < EMIGRATION_MAX_POPULARITY && pop > 0) {
      const leaver = pickEmigrant(world);
      if (leaver) {
        unbindFromWorkplace(world, leaver);
        leaver.carrying = null;
        leaver.insideBuilding = false;
        leaver.path = null;
        leaver.task = {
          kind: 'goTo',
          dest: edgeTileNear(world, leaver.pos.y),
          then: { kind: 'despawn' },
        };
        events.push({ type: 'message', text: 'A peasant has left your city' });
      }
    }
  }

  // Lose conditions.
  if (world.outcome === 'playing') {
    if (world.popularity <= 0) {
      setOutcome(world, 'lost', 'Your popularity collapsed — the people abandoned you', events);
    } else if (pop === 0 && world.tick > EAT_INTERVAL_TICKS) {
      setOutcome(world, 'lost', 'Everyone has left your city', events);
    }
  }
}

function pickEmigrant(world: World): Unit | null {
  let fallback: Unit | null = null;
  for (const u of world.units.values()) {
    if (u.role !== 'peasant') continue;
    if (u.task.kind === 'goTo' && u.task.then.kind === 'despawn') continue; // already leaving
    if (u.task.kind === 'idle') return u; // idle first
    fallback ??= u;
  }
  return fallback;
}

export function setOutcome(
  world: World,
  outcome: 'won' | 'lost',
  reason: string,
  events: SimEvent[],
): void {
  if (world.outcome !== 'playing') return;
  world.outcome = outcome;
  world.outcomeReason = reason;
  events.push({ type: 'gameOver', outcome, reason });
}
