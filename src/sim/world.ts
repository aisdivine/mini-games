// The World struct: plain serializable data, no methods, no display objects.
// All sim logic lives in free functions that take the world.

import {
  BUILDINGS,
  EAT_INTERVAL_TICKS,
  IMMIGRATION_INTERVAL_TICKS,
  MAP_W,
  MAP_H,
  POPULARITY_START,
  STARTING_PEASANTS,
  STARTING_WOOD,
  TREE_CLEAR_RADIUS,
  TREE_CLUSTERS,
  TREE_PER_CLUSTER,
  TREE_WOOD,
  type BuildingType,
  type FoodType,
  type Resource,
  type StockResource,
} from '../config';
import { idx } from './grid';
import { nextInt } from './rng';

export interface Vec2 {
  x: number;
  y: number;
}

export type ProductionState =
  | { kind: 'none' } // non-production buildings
  | { kind: 'awaitingWorker' }
  | { kind: 'awaitingInput' }
  | { kind: 'producing'; ticksLeft: number }
  | { kind: 'delivering' };

export interface Building {
  id: number;
  type: BuildingType;
  /** North (min-x, min-y) corner of the footprint. */
  tile: Vec2;
  /** Tile just outside the footprint where workers enter/exit. */
  accessTile: Vec2;
  hp: number;
  level: number; // 1..MAX_BUILDING_LEVEL; higher = faster production
  workerId: number | null;
  state: ProductionState;
}

export type UnitRole = 'peasant' | 'archer' | 'raider';

export type Task =
  | { kind: 'idle' }
  | { kind: 'goTo'; dest: Vec2; then: TaskGoal }
  | { kind: 'workAt'; ticksLeft: number }
  // Standing at the workplace, periodically retrying a failed dispatch
  // (no input in stock, or no depot built yet for the output).
  | { kind: 'waitRetry'; what: 'input' | 'deliver'; cooldown: number };

// What a walking unit does on arrival.
export type TaskGoal =
  | { kind: 'none' }
  | { kind: 'startWork' } // arrived at workplace, begin the production cycle
  | { kind: 'pickup'; reservationId: number } // at stockpile, collect reserved input
  | { kind: 'returnWork' } // back at workplace carrying input
  | { kind: 'workHere' } // arrived at the work spot (tree / field) — start laboring
  | { kind: 'dropoff' } // at depot carrying output
  | { kind: 'despawn' }; // emigrated off the map

export interface Unit {
  id: number;
  role: UnitRole;
  pos: Vec2; // fractional tile coords; (t+0.5, t+0.5) = centered on tile t
  prevPos: Vec2; // last tick's pos, for render interpolation
  path: Vec2[] | null; // remaining integer waypoints, index 0 is next
  pathVersion: number; // world.gridVersion when path was computed
  repathCooldown: number;
  task: Task;
  carrying: { resource: Resource; amount: number } | null;
  workplaceId: number | null;
  insideBuilding: boolean; // hidden while working indoors
  hp: number;
  attackCooldown: number;
  targetId: number | null; // combat target (building id)
}

export interface Reservation {
  id: number;
  resource: StockResource;
  amount: number;
  buildingId: number;
}

export interface Tree {
  id: number;
  tile: Vec2;
  wood: number; // chops remaining; 0 == stump
  regrowAt: number | null; // tick at which a stump becomes a tree again
}

export interface RaidState {
  triggered: boolean;
  spawnedCount: number;
}

export interface World {
  tick: number;
  rngState: number;
  gridVersion: number;
  /** Building id + 1 per tile; 0 = free. Buildings and walls block movement. */
  occupancy: Uint32Array;
  buildings: Map<number, Building>;
  units: Map<number, Unit>;
  trees: Map<number, Tree>;
  stockpile: Record<StockResource, number>;
  granaryFood: Record<FoodType, number>;
  reservations: Reservation[];
  workerWanted: number[]; // building ids waiting for a worker, FIFO
  popularity: number;
  lastFoodDelta: number; // for the HUD ("Food +2")
  nextEatTick: number;
  nextImmigrationTick: number;
  raid: RaidState;
  outcome: 'playing' | 'won' | 'lost';
  outcomeReason: string;
  keepId: number;
  campfireTile: Vec2;
  nextId: number;
}

export function createWorld(seed: number): World {
  const world: World = {
    tick: 0,
    rngState: seed | 0,
    gridVersion: 0,
    occupancy: new Uint32Array(MAP_W * MAP_H),
    buildings: new Map(),
    units: new Map(),
    trees: new Map(),
    stockpile: { wood: STARTING_WOOD, wheat: 0, flour: 0 },
    granaryFood: { bread: 8, apples: 6, meat: 0 },
    reservations: [],
    workerWanted: [],
    popularity: POPULARITY_START,
    lastFoodDelta: 0,
    nextEatTick: EAT_INTERVAL_TICKS,
    nextImmigrationTick: IMMIGRATION_INTERVAL_TICKS,
    raid: { triggered: false, spawnedCount: 0 },
    outcome: 'playing',
    outcomeReason: '',
    keepId: 0,
    campfireTile: { x: 0, y: 0 },
    nextId: 1,
  };

  // Starting layout near map center: keep, stockpile, campfire + idle peasants.
  const cx = MAP_W >> 1;
  const cy = MAP_H >> 1;
  const keep = placeBuildingRaw(world, 'keep', { x: cx - 5, y: cy - 2 });
  world.keepId = keep.id;
  placeBuildingRaw(world, 'stockpile', { x: cx + 2, y: cy - 2 });
  const fire = placeBuildingRaw(world, 'campfire', { x: cx - 1, y: cy + 3 });
  world.campfireTile = { ...fire.accessTile };
  for (let i = 0; i < STARTING_PEASANTS; i++) {
    spawnUnit(world, 'peasant', { x: world.campfireTile.x + (i % 2), y: world.campfireTile.y + (i >> 1) }, 50);
  }

  scatterTrees(world, cx, cy);
  return world;
}

/** Sprinkle clusters of trees across the map, keeping the start area clear. */
function scatterTrees(world: World, cx: number, cy: number): void {
  const margin = 2;
  const occupied = new Set<number>(); // tile index -> taken by a tree
  for (let c = 0; c < TREE_CLUSTERS; c++) {
    // cluster center, retried a few times to land outside the keep's clearing
    let gx = 0;
    let gy = 0;
    for (let tries = 0; tries < 8; tries++) {
      gx = margin + nextInt(world, MAP_W - margin * 2);
      gy = margin + nextInt(world, MAP_H - margin * 2);
      if (Math.hypot(gx - cx, gy - cy) >= TREE_CLEAR_RADIUS) break;
    }
    if (Math.hypot(gx - cx, gy - cy) < TREE_CLEAR_RADIUS) continue;
    for (let t = 0; t < TREE_PER_CLUSTER; t++) {
      const tx = gx + nextInt(world, 5) - 2;
      const ty = gy + nextInt(world, 5) - 2;
      if (tx < margin || ty < margin || tx >= MAP_W - margin || ty >= MAP_H - margin) continue;
      const key = ty * MAP_W + tx;
      if (occupied.has(key) || world.occupancy[key] !== 0) continue;
      if (Math.hypot(tx - cx, ty - cy) < TREE_CLEAR_RADIUS) continue;
      occupied.add(key);
      const id = world.nextId++;
      world.trees.set(id, { id, tile: { x: tx, y: ty }, wood: TREE_WOOD, regrowAt: null });
    }
  }
}

/** Nearest standing (non-stump) tree to a point. Tiebreak by id for
 *  deterministic worker behavior. Null if the forest is exhausted. */
export function findNearestTree(world: World, from: Vec2): Tree | null {
  let best: Tree | null = null;
  let bestDist = Infinity;
  for (const tree of world.trees.values()) {
    if (tree.wood <= 0) continue;
    const d = Math.abs(tree.tile.x - from.x) + Math.abs(tree.tile.y - from.y);
    if (d < bestDist || (d === bestDist && best && tree.id < best.id)) {
      bestDist = d;
      best = tree;
    }
  }
  return best;
}

/** Place without validation/cost — callers validate first. Bumps gridVersion. */
export function placeBuildingRaw(world: World, type: BuildingType, tile: Vec2): Building {
  const def = BUILDINGS[type];
  const building: Building = {
    id: world.nextId++,
    type,
    tile: { ...tile },
    accessTile: { x: tile.x + def.size.w, y: tile.y + def.size.h - 1 },
    hp: def.hp,
    level: 1,
    workerId: null,
    state: def.recipe ? { kind: 'awaitingWorker' } : { kind: 'none' },
  };
  for (let dy = 0; dy < def.size.h; dy++) {
    for (let dx = 0; dx < def.size.w; dx++) {
      world.occupancy[idx(tile.x + dx, tile.y + dy)] = building.id + 1;
    }
  }
  world.buildings.set(building.id, building);
  world.gridVersion++;
  if (def.recipe) world.workerWanted.push(building.id);
  return building;
}

/** Remove a building with full cleanup: occupancy, worker, reservations,
 *  recruitment queue. Used by both demolish and combat destruction. */
export function removeBuilding(world: World, building: Building): void {
  const def = BUILDINGS[building.type];
  for (let dy = 0; dy < def.size.h; dy++) {
    for (let dx = 0; dx < def.size.w; dx++) {
      world.occupancy[idx(building.tile.x + dx, building.tile.y + dy)] = 0;
    }
  }
  world.buildings.delete(building.id);
  world.gridVersion++;
  const qi = world.workerWanted.indexOf(building.id);
  if (qi >= 0) world.workerWanted.splice(qi, 1);
  world.reservations = world.reservations.filter((r) => r.buildingId !== building.id);
  if (building.workerId !== null) {
    const worker = world.units.get(building.workerId);
    if (worker) resetToIdle(worker);
  }
}

export function buildingAt(world: World, tx: number, ty: number): Building | null {
  const id = world.occupancy[idx(tx, ty)];
  return id ? (world.buildings.get(id - 1) ?? null) : null;
}

export function spawnUnit(world: World, role: UnitRole, pos: Vec2, hp: number): Unit {
  const center = { x: Math.floor(pos.x) + 0.5, y: Math.floor(pos.y) + 0.5 };
  const unit: Unit = {
    id: world.nextId++,
    role,
    pos: { ...center },
    prevPos: { ...center },
    path: null,
    pathVersion: -1,
    repathCooldown: 0,
    task: { kind: 'idle' },
    carrying: null,
    workplaceId: null,
    insideBuilding: false,
    hp,
    attackCooldown: 0,
    targetId: null,
  };
  world.units.set(unit.id, unit);
  return unit;
}

export function resetToIdle(unit: Unit): void {
  unit.task = { kind: 'idle' };
  unit.path = null;
  unit.workplaceId = null;
  unit.insideBuilding = false;
  unit.carrying = null;
  unit.targetId = null;
}

/** Worker leaves (emigration/death): free its building and re-queue it. */
export function unbindFromWorkplace(world: World, unit: Unit): void {
  if (unit.workplaceId === null) return;
  const b = world.buildings.get(unit.workplaceId);
  if (b) {
    b.workerId = null;
    b.state = { kind: 'awaitingWorker' };
    world.workerWanted.push(b.id);
    world.reservations = world.reservations.filter((r) => r.buildingId !== b.id);
  }
  unit.workplaceId = null;
}
