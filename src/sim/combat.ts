// Minimal combat: a scripted raid wave, anti-building raiders, and archers
// that auto-fire. Raiders attack the keep if reachable, otherwise the nearest
// blocking structure on the line to the keep — that one rule makes walls
// meaningful without any siege AI.

import {
  ARCHER_COOLDOWN_TICKS,
  ARCHER_DAMAGE,
  ARCHER_RANGE,
  ARCHER_TOWER_RANGE_BONUS,
  BUILDINGS,
  MAP_W,
  RAID_AT_TICK,
  RAIDS_ENABLED,
  RAIDER_COOLDOWN_TICKS,
  RAIDER_COUNT,
  RAIDER_DAMAGE,
  RAIDER_HP,
} from '../config';
import type { SimEvent } from './events';
import { isPassable } from './grid';
import { findPathToBuilding } from './pathfinding';
import { moveToward } from './units';
import { setOutcome } from './population';
import {
  buildingAt,
  removeBuilding,
  spawnUnit,
  type Building,
  type Unit,
  type World,
} from './world';

export function updateCombat(world: World, events: SimEvent[]): void {
  if (RAIDS_ENABLED && !world.raid.triggered && world.tick >= RAID_AT_TICK) {
    world.raid.triggered = true;
  }
  if (world.raid.triggered && world.raid.spawnedCount === 0) {
    spawnRaid(world, events);
  }

  let raidersAlive = 0;
  for (const unit of world.units.values()) {
    if (unit.role === 'archer') updateArcherFire(world, unit, events);
    else if (unit.role === 'raider') {
      raidersAlive++;
      updateRaider(world, unit, events);
    }
  }

  // Cull dead raiders (archers/peasants take no damage in the slice).
  for (const unit of [...world.units.values()]) {
    if (unit.hp <= 0) {
      world.units.delete(unit.id);
      events.push({ type: 'unitDied', id: unit.id, role: unit.role });
      if (unit.role === 'raider') raidersAlive--;
    }
  }

  if (world.raid.spawnedCount > 0 && raidersAlive === 0 && world.outcome === 'playing') {
    setOutcome(world, 'won', 'The raid is defeated — your city stands!', events);
  }
}

function spawnRaid(world: World, events: SimEvent[]): void {
  const keep = world.buildings.get(world.keepId);
  const cy = keep ? keep.tile.y : 32;
  for (let i = 0; i < RAIDER_COUNT; i++) {
    const ty = cy - 4 + i;
    if (!isPassable(world, MAP_W - 1, ty)) continue;
    spawnUnit(world, 'raider', { x: MAP_W - 1, y: ty }, RAIDER_HP);
    world.raid.spawnedCount++;
  }
  events.push({ type: 'raidStarted' });
  events.push({ type: 'message', text: '⚔ RAID! Enemies approach from the east!' });
}

// ---------------------------------------------------------------------------
// Archers
// ---------------------------------------------------------------------------

function updateArcherFire(world: World, archer: Unit, events: SimEvent[]): void {
  if (archer.attackCooldown > 0) return;
  const range = ARCHER_RANGE + (nearTower(world, archer) ? ARCHER_TOWER_RANGE_BONUS : 0);
  let target: Unit | null = null;
  let bestDist = range;
  for (const u of world.units.values()) {
    if (u.role !== 'raider' || u.hp <= 0) continue;
    const d = Math.hypot(u.pos.x - archer.pos.x, u.pos.y - archer.pos.y);
    if (d <= bestDist) {
      bestDist = d;
      target = u;
    }
  }
  if (!target) return;
  archer.attackCooldown = ARCHER_COOLDOWN_TICKS;
  target.hp -= ARCHER_DAMAGE;
  events.push({ type: 'arrow', from: { ...archer.pos }, to: { ...target.pos } });
}

function nearTower(world: World, archer: Unit): boolean {
  const tx = Math.floor(archer.pos.x);
  const ty = Math.floor(archer.pos.y);
  for (const b of world.buildings.values()) {
    if (b.type !== 'tower') continue;
    const def = BUILDINGS.tower;
    const withinX = tx >= b.tile.x - 1 && tx <= b.tile.x + def.size.w;
    const withinY = ty >= b.tile.y - 1 && ty <= b.tile.y + def.size.h;
    if (withinX && withinY) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Raiders
// ---------------------------------------------------------------------------

function updateRaider(world: World, raider: Unit, events: SimEvent[]): void {
  let target = raider.targetId !== null ? world.buildings.get(raider.targetId) : undefined;

  // Swing at the target if we're next to it.
  if (target && isAdjacentTo(raider, target)) {
    raider.path = null;
    if (raider.attackCooldown === 0) {
      raider.attackCooldown = RAIDER_COOLDOWN_TICKS;
      target.hp -= RAIDER_DAMAGE;
      if (target.hp <= 0) {
        const wasKeep = target.id === world.keepId;
        removeBuilding(world, target);
        events.push({ type: 'buildingRemoved', id: target.id });
        raider.targetId = null;
        if (wasKeep) {
          setOutcome(world, 'lost', 'The keep has been destroyed!', events);
        }
      }
    }
    return;
  }

  // (Re)acquire a target: keep if reachable, else the first blocker on the
  // line toward the keep, else the nearest reachable building.
  if (!target || !raider.path) {
    const keep = world.buildings.get(world.keepId);
    if (!keep) return;
    if (acquire(world, raider, keep)) {
      // heading for the keep
    } else {
      const blocker = firstBlockerTowardKeep(world, raider, keep) ?? nearestBuilding(world, raider);
      if (!blocker || !acquire(world, raider, blocker)) {
        raider.targetId = null;
        return; // fully stuck this tick; repath cooldown will retry
      }
    }
    target = world.buildings.get(raider.targetId!);
    if (!target) return;
  }

  if (raider.task.kind === 'goTo') {
    const status = moveToward(world, raider, raider.task.dest);
    if (status !== 'moving') raider.path = null; // re-evaluate next tick
    if (status === 'blocked') raider.targetId = null;
  }
}

function acquire(world: World, raider: Unit, b: Building): boolean {
  if (isAdjacentTo(raider, b)) {
    raider.targetId = b.id;
    raider.path = null;
    raider.task = { kind: 'idle' };
    return true;
  }
  const path = findPathToBuilding(world, raider.pos, b);
  if (!path) return false;
  raider.targetId = b.id;
  raider.path = path;
  raider.pathVersion = world.gridVersion;
  const last = path[path.length - 1];
  raider.task = { kind: 'goTo', dest: { ...last }, then: { kind: 'none' } };
  return true;
}

/** Walk the straight line from raider to keep; return the first building
 *  whose tile blocks it (a wall, tower, or anything else in the way). */
function firstBlockerTowardKeep(world: World, raider: Unit, keep: Building): Building | null {
  const def = BUILDINGS.keep;
  const gx = keep.tile.x + def.size.w / 2;
  const gy = keep.tile.y + def.size.h / 2;
  const sx = raider.pos.x;
  const sy = raider.pos.y;
  const steps = Math.ceil(Math.max(Math.abs(gx - sx), Math.abs(gy - sy)) * 2);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const tx = Math.floor(sx + (gx - sx) * t);
    const ty = Math.floor(sy + (gy - sy) * t);
    const b = buildingAt(world, tx, ty);
    if (b && b.id !== keep.id) return b;
    if (b && b.id === keep.id) return null;
  }
  return null;
}

function nearestBuilding(world: World, raider: Unit): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const b of world.buildings.values()) {
    if (b.type === 'campfire') continue;
    const d = Math.abs(b.tile.x - raider.pos.x) + Math.abs(b.tile.y - raider.pos.y);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

function isAdjacentTo(unit: Unit, b: Building): boolean {
  const def = BUILDINGS[b.type];
  const tx = Math.floor(unit.pos.x);
  const ty = Math.floor(unit.pos.y);
  return (
    tx >= b.tile.x - 1 &&
    tx <= b.tile.x + def.size.w &&
    ty >= b.tile.y - 1 &&
    ty <= b.tile.y + def.size.h
  );
}
