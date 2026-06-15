// Unit movement and the peasant production cycle. Units pass through each
// other (Stronghold-style) — only buildings and walls block.

import {
  BUILDINGS,
  MAP_W,
  MAP_H,
  REPATH_COOLDOWN_TICKS,
  UNIT_SPEED,
} from '../config';
import { FISH_REGROW_TICKS, TREE_REGROW_TICKS, workTicksAtLevel } from '../config';
import { reserve, commitReservation, deposit, findDepot } from './economy';
import type { SimEvent } from './events';
import { inBounds, isPassable } from './grid';
import { findPath } from './pathfinding';
import { nextRand, nextInt } from './rng';
import {
  findNearestFish,
  findNearestRockShore,
  findNearestTree,
  resetToIdle,
  shoreTileNear,
  unbindFromWorkplace,
  type Building,
  type TaskGoal,
  type Unit,
  type Vec2,
  type World,
} from './world';

const WAIT_RETRY_TICKS = 20;

export function updateUnits(world: World, events: SimEvent[]): void {
  for (const unit of world.units.values()) {
    unit.prevPos = { ...unit.pos };
    if (unit.attackCooldown > 0) unit.attackCooldown--;
    if (unit.repathCooldown > 0) unit.repathCooldown--;
    unstickIfBuried(world, unit);
    if (unit.role === 'peasant') updatePeasant(world, unit, events);
    else if (unit.role === 'archer') updateArcherMovement(world, unit);
    // Raiders are driven by combat.ts (which runs after units this tick).
  }
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

export type MoveStatus = 'moving' | 'arrived' | 'blocked';

/** Advance one tick toward dest. Handles pathing, invalidation on grid
 *  change, and repath cooldown. 'blocked' means a repath just failed —
 *  the destination is currently unreachable. */
export function moveToward(world: World, unit: Unit, dest: Vec2): MoveStatus {
  const destX = Math.floor(dest.x);
  const destY = Math.floor(dest.y);

  // Grid changed since this path was computed: keep it only if still clear.
  if (unit.path && unit.pathVersion !== world.gridVersion) {
    if (unit.path.some((t) => !isPassable(world, t.x, t.y))) unit.path = null;
    unit.pathVersion = world.gridVersion;
  }

  if (!unit.path) {
    if (Math.floor(unit.pos.x) === destX && Math.floor(unit.pos.y) === destY) {
      unit.pos = { x: destX + 0.5, y: destY + 0.5 };
      return 'arrived';
    }
    if (unit.repathCooldown > 0) return 'moving'; // stand and wait
    const path = findPath(world, unit.pos, dest);
    if (!path) {
      unit.repathCooldown = REPATH_COOLDOWN_TICKS;
      return 'blocked';
    }
    unit.path = path;
    unit.pathVersion = world.gridVersion;
  }

  let budget = UNIT_SPEED;
  while (budget > 0 && unit.path && unit.path.length > 0) {
    const wp = unit.path[0];
    const cx = wp.x + 0.5;
    const cy = wp.y + 0.5;
    const dx = cx - unit.pos.x;
    const dy = cy - unit.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= budget) {
      unit.pos = { x: cx, y: cy };
      budget -= dist;
      unit.path.shift();
    } else {
      unit.pos.x += (dx / dist) * budget;
      unit.pos.y += (dy / dist) * budget;
      budget = 0;
    }
  }
  if (unit.path && unit.path.length === 0) {
    unit.path = null;
    return 'arrived';
  }
  return 'moving';
}

/** A building was placed on top of a standing unit: nudge it to the nearest
 *  free tile (rare; placement doesn't check units). */
function unstickIfBuried(world: World, unit: Unit): void {
  if (unit.insideBuilding) return;
  const tx = Math.floor(unit.pos.x);
  const ty = Math.floor(unit.pos.y);
  if (isPassable(world, tx, ty)) return;
  for (let radius = 1; radius < 8; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        if (isPassable(world, tx + dx, ty + dy)) {
          unit.pos = { x: tx + dx + 0.5, y: ty + dy + 0.5 };
          unit.prevPos = { ...unit.pos };
          unit.path = null;
          return;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Peasants: idle pool + production cycle
// ---------------------------------------------------------------------------

function updatePeasant(world: World, unit: Unit, events: SimEvent[]): void {
  // Workplace vanished while we were mid-cycle (defensive; removeBuilding
  // normally resets us).
  if (unit.workplaceId !== null && !world.buildings.has(unit.workplaceId)) {
    resetToIdle(unit);
  }

  const task = unit.task;
  switch (task.kind) {
    case 'idle': {
      // Loiter near the campfire so the idle pool is visible.
      if (nextRand(world) < 0.005) {
        const t = {
          x: world.campfireTile.x + nextInt(world, 7) - 3,
          y: world.campfireTile.y + nextInt(world, 7) - 3,
        };
        if (inBounds(t.x, t.y) && isPassable(world, t.x, t.y)) {
          unit.task = { kind: 'goTo', dest: t, then: { kind: 'none' } };
        }
      }
      return;
    }

    case 'goTo': {
      const status = moveToward(world, unit, task.dest);
      if (status === 'arrived') handleArrival(world, unit, task.then, events);
      else if (status === 'blocked') handleBlocked(world, unit);
      return;
    }

    case 'workAt': {
      task.ticksLeft--;
      if (task.ticksLeft > 0) return;
      const workplace = getWorkplace(world, unit);
      if (!workplace) return;
      const recipe = BUILDINGS[workplace.type].recipe!;
      // Woodcutter: the wood comes off the tree it was chopping.
      if (workplace.type === 'woodcutter' && unit.targetId !== null) {
        const tree = world.trees.get(unit.targetId);
        if (tree && tree.wood > 0) {
          tree.wood--;
          if (tree.wood <= 0) tree.regrowAt = world.tick + TREE_REGROW_TICKS;
        }
        unit.targetId = null;
      }
      // Fishery: the catch comes off the shoal it was fishing.
      if (workplace.type === 'fishery' && unit.targetId !== null) {
        const shoal = world.fish.get(unit.targetId);
        if (shoal && shoal.fish > 0) {
          shoal.fish--;
          if (shoal.fish <= 0) shoal.regrowAt = world.tick + FISH_REGROW_TICKS;
        }
        unit.targetId = null;
      }
      unit.carrying = { resource: recipe.output.resource, amount: recipe.output.amount };
      dispatchDeliver(world, unit, workplace);
      return;
    }

    case 'waitRetry': {
      task.cooldown--;
      if (task.cooldown > 0) return;
      const workplace = getWorkplace(world, unit);
      if (!workplace) return;
      if (task.what === 'input') dispatchFetchOrWork(world, unit, workplace);
      else dispatchDeliver(world, unit, workplace);
      return;
    }
  }
}

function getWorkplace(world: World, unit: Unit): Building | null {
  if (unit.workplaceId === null) {
    resetToIdle(unit);
    return null;
  }
  const b = world.buildings.get(unit.workplaceId);
  if (!b) {
    resetToIdle(unit);
    return null;
  }
  return b;
}

function handleArrival(world: World, unit: Unit, goal: TaskGoal, events: SimEvent[]): void {
  switch (goal.kind) {
    case 'none':
      unit.task = { kind: 'idle' };
      return;

    case 'startWork': {
      const workplace = getWorkplace(world, unit);
      if (!workplace) return;
      dispatchFetchOrWork(world, unit, workplace);
      return;
    }

    case 'pickup': {
      const workplace = getWorkplace(world, unit);
      if (!workplace) return;
      const r = commitReservation(world, goal.reservationId);
      if (!r) {
        // Reservation vanished (shouldn't happen while bound) — restart cycle.
        unit.task = { kind: 'goTo', dest: { ...workplace.accessTile }, then: { kind: 'startWork' } };
        return;
      }
      unit.carrying = { resource: r.resource, amount: r.amount };
      unit.task = { kind: 'goTo', dest: { ...workplace.accessTile }, then: { kind: 'returnWork' } };
      return;
    }

    case 'returnWork': {
      const workplace = getWorkplace(world, unit);
      if (!workplace) return;
      unit.carrying = null; // input consumed
      beginWork(unit, workplace); // grind/bake at the building, visibly
      return;
    }

    case 'workHere': {
      // Arrived at the work spot (a tree, or a field tile) — start laboring.
      const workplace = getWorkplace(world, unit);
      if (!workplace) return;
      beginWork(unit, workplace);
      return;
    }

    case 'dropoff': {
      const workplace = getWorkplace(world, unit);
      if (!unit.carrying) {
        resetToIdle(unit);
        return;
      }
      deposit(world, unit.carrying.resource, unit.carrying.amount);
      unit.carrying = null;
      if (!workplace) return;
      unit.task = { kind: 'goTo', dest: { ...workplace.accessTile }, then: { kind: 'startWork' } };
      return;
    }

    case 'despawn': {
      world.units.delete(unit.id);
      events.push({ type: 'unitDied', id: unit.id, role: unit.role });
      return;
    }
  }
}

/** At the workplace: fetch input if the recipe needs one, else head to the
 *  work spot (a tree for woodcutters, the field for farms). */
function dispatchFetchOrWork(world: World, unit: Unit, workplace: Building): void {
  const recipe = BUILDINGS[workplace.type].recipe;
  if (!recipe) {
    resetToIdle(unit);
    return;
  }

  if (recipe.input) {
    const stockpileB = findDepot(world, 'stockpile');
    const reservationId = stockpileB
      ? reserve(world, recipe.input.resource, recipe.input.amount, workplace.id)
      : null;
    if (reservationId === null || !stockpileB) {
      workplace.state = { kind: 'awaitingInput' };
      unit.task = { kind: 'waitRetry', what: 'input', cooldown: WAIT_RETRY_TICKS };
      return;
    }
    workplace.state = { kind: 'awaitingInput' };
    unit.task = {
      kind: 'goTo',
      dest: { ...stockpileB.accessTile },
      then: { kind: 'pickup', reservationId },
    };
    return;
  }

  // Woodcutter: walk to the nearest standing tree and chop it there.
  if (workplace.type === 'woodcutter') {
    const tree = findNearestTree(world, unit.pos);
    if (!tree) {
      workplace.state = { kind: 'awaitingInput' }; // forest exhausted; retry
      unit.task = { kind: 'waitRetry', what: 'input', cooldown: WAIT_RETRY_TICKS };
      return;
    }
    unit.targetId = tree.id;
    workplace.state = { kind: 'producing', ticksLeft: workTicksAtLevel(recipe.workTicks, workplace.level) };
    unit.task = { kind: 'goTo', dest: workSpotNear(world, tree.tile), then: { kind: 'workHere' } };
    return;
  }

  // Fishery: walk to the shore beside the nearest shoal and cast from there.
  if (workplace.type === 'fishery') {
    const shoal = findNearestFish(world, unit.pos);
    const shore = shoal ? shoreTileNear(world, shoal.tile) : null;
    if (!shoal || !shore) {
      workplace.state = { kind: 'awaitingInput' }; // no reachable fish; retry
      unit.task = { kind: 'waitRetry', what: 'input', cooldown: WAIT_RETRY_TICKS };
      return;
    }
    unit.targetId = shoal.id;
    workplace.state = { kind: 'producing', ticksLeft: workTicksAtLevel(recipe.workTicks, workplace.level) };
    unit.task = { kind: 'goTo', dest: shore, then: { kind: 'workHere' } };
    return;
  }

  // Quarry: walk to the mountain's edge and mine stone (inexhaustible).
  if (workplace.type === 'quarry') {
    const spot = findNearestRockShore(world, unit.pos);
    if (!spot) {
      workplace.state = { kind: 'awaitingInput' }; // no reachable rock; retry
      unit.task = { kind: 'waitRetry', what: 'input', cooldown: WAIT_RETRY_TICKS };
      return;
    }
    workplace.state = { kind: 'producing', ticksLeft: workTicksAtLevel(recipe.workTicks, workplace.level) };
    unit.task = { kind: 'goTo', dest: spot, then: { kind: 'workHere' } };
    return;
  }

  // Field/craft jobs (wheat farm, etc.): labor at the building, visibly.
  // The worker is already standing at the access tile.
  beginWork(unit, workplace);
}

/** Stand just south of a target tile if possible (so the worker draws in
 *  front of the tree), else on the tile itself. */
function workSpotNear(world: World, tile: Vec2): Vec2 {
  const south = { x: tile.x, y: tile.y + 1 };
  if (isPassable(world, south.x, south.y)) return south;
  return { ...tile };
}

function beginWork(unit: Unit, workplace: Building): void {
  const recipe = BUILDINGS[workplace.type].recipe!;
  const ticks = workTicksAtLevel(recipe.workTicks, workplace.level);
  unit.insideBuilding = false; // workers stay visible while laboring
  unit.task = { kind: 'workAt', ticksLeft: ticks };
  workplace.state = { kind: 'producing', ticksLeft: ticks };
}

function dispatchDeliver(world: World, unit: Unit, workplace: Building): void {
  const recipe = BUILDINGS[workplace.type].recipe!;
  const depot = findDepot(world, recipe.output.dest);
  if (!depot) {
    workplace.state = { kind: 'delivering' };
    unit.task = { kind: 'waitRetry', what: 'deliver', cooldown: WAIT_RETRY_TICKS };
    return;
  }
  workplace.state = { kind: 'delivering' };
  unit.task = { kind: 'goTo', dest: { ...depot.accessTile }, then: { kind: 'dropoff' } };
}

/** Destination unreachable (walled off). Free the worker so the economy
 *  degrades gracefully; the building re-queues and is retried later. */
function handleBlocked(world: World, unit: Unit): void {
  if (unit.carrying) {
    // Goods are lost with the failed trip — acceptable for the slice.
    unit.carrying = null;
  }
  unbindFromWorkplace(world, unit);
  resetToIdle(unit);
  unit.repathCooldown = REPATH_COOLDOWN_TICKS;
}

// ---------------------------------------------------------------------------
// Archers: player-directed movement only (firing lives in combat.ts)
// ---------------------------------------------------------------------------

function updateArcherMovement(world: World, unit: Unit): void {
  if (unit.task.kind !== 'goTo') return;
  const status = moveToward(world, unit, unit.task.dest);
  if (status !== 'moving') unit.task = { kind: 'idle' };
}

/** Spawn position helpers shared with population/combat. */
export function edgeTileNear(world: World, y: number): Vec2 {
  const ty = Math.max(0, Math.min(MAP_H - 1, Math.floor(y)));
  for (let tx = 0; tx < MAP_W; tx++) {
    if (isPassable(world, tx, ty)) return { x: tx, y: ty };
  }
  return { x: 0, y: ty };
}
