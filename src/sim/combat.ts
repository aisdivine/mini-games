// Minimal combat: a scripted raid wave, anti-building raiders, and archers
// that auto-fire. Raiders attack the keep if reachable, otherwise the nearest
// blocking structure on the line to the keep — that one rule makes walls
// meaningful without any siege AI.

import {
  ARCHER_TOWER_RANGE_BONUS,
  AURA_DAMAGE_MULT,
  AURA_RADIUS,
  BATTLE_ENEMY_DMG_PER_LEVEL,
  BLACKSMITH_DEF_MULT,
  BLACKSMITH_DMG_MULT,
  BUILDINGS,
  HEAL_AMOUNT,
  isSoldier,
  MANGONEL_SPLASH,
  MAP_W,
  RAIDER_COOLDOWN_TICKS,
  RAIDER_COUNT,
  RAIDER_DAMAGE,
  RAIDER_HP,
  SOLDIER_AGGRO,
  SOLDIERS,
  type SoldierDef,
  type SoldierType,
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
  if (world.raidsEnabled && !world.raid.triggered && world.tick >= world.nextRaidTick) {
    world.raid.triggered = true;
  }
  if (world.raid.triggered && world.raid.spawnedCount === 0) {
    spawnRaid(world, events);
  }

  for (const unit of world.units.values()) {
    if (isSoldier(unit.role)) updateSoldier(world, unit, events);
    else if (unit.role === 'raider') updateRaider(world, unit, events);
  }

  // Cull the dead (raiders and any soldiers that fell).
  for (const unit of [...world.units.values()]) {
    if (unit.hp <= 0) {
      world.units.delete(unit.id);
      events.push({ type: 'unitDied', id: unit.id, role: unit.role });
      if (unit.role === 'raider' || isSoldier(unit.role)) {
        events.push({ type: 'fallen', x: unit.pos.x, y: unit.pos.y, enemy: unit.role === 'raider' });
      }
    }
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
// Soldiers (auto-engage when not under a manual move order)
// ---------------------------------------------------------------------------

function dist2(a: Unit, b: { pos: Unit['pos'] }): number {
  return Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
}

function nearestRaider(world: World, from: Unit): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of world.units.values()) {
    if (u.role !== 'raider' || u.hp <= 0) continue;
    const d = dist2(from, u);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function nearestSoldier(world: World, from: Unit): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of world.units.values()) {
    if (u.hp <= 0 || !isSoldier(u.role)) continue;
    const d = dist2(from, u);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function nearestWounded(world: World, medic: Unit): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of world.units.values()) {
    if (u.id === medic.id || u.hp <= 0 || !isSoldier(u.role)) continue;
    if (u.hp >= SOLDIERS[u.role as SoldierType].hp) continue;
    const d = dist2(medic, u);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

/** True while the player owns at least one Blacksmith — a standing buff to all
 *  player soldiers (more damage dealt, less damage taken). */
function hasBlacksmith(world: World): boolean {
  for (const b of world.buildings.values()) {
    if (b.type === 'blacksmith' && b.owner === 'player') return true;
  }
  return false;
}

/** A friendly standard-bearer within aura range buffs this unit's damage. */
function buffed(world: World, unit: Unit): boolean {
  for (const u of world.units.values()) {
    if (u.role !== 'standard_bearer' || u.hp <= 0) continue;
    if (dist2(unit, u) <= AURA_RADIUS) return true;
  }
  return false;
}

function splash(world: World, center: Unit, dmg: number): void {
  for (const u of world.units.values()) {
    if (u.role !== 'raider' || u.hp <= 0 || u.id === center.id) continue;
    if (dist2(center, u) <= MANGONEL_SPLASH) u.hp -= dmg * 0.5;
  }
}

function updateSoldier(world: World, unit: Unit, events: SimEvent[]): void {
  if (unit.task.kind === 'goTo') return; // moving on a player order (units.ts)
  const def = SOLDIERS[unit.role as SoldierType];
  if (def.special === 'heal') {
    healNearby(world, unit, def);
    return;
  }
  const target = nearestRaider(world, unit);
  // Hold position unless an enemy is close — so idle troops don't wander off;
  // on the battlefield the enemy advances into range on its own.
  if (!target || dist2(unit, target) > SOLDIER_AGGRO) return;
  const ranged = def.range > 1.9;
  const range = def.range + (ranged && nearTower(world, unit) ? ARCHER_TOWER_RANGE_BONUS : 0);
  if (dist2(unit, target) <= range) {
    if (unit.attackCooldown === 0 && def.damage > 0) {
      unit.attackCooldown = def.cooldownTicks;
      const dmg =
        def.damage *
        (buffed(world, unit) ? AURA_DAMAGE_MULT : 1) *
        (hasBlacksmith(world) ? BLACKSMITH_DMG_MULT : 1);
      target.hp -= dmg;
      if (ranged) events.push({ type: 'arrow', from: { ...unit.pos }, to: { ...target.pos } });
      const kind = ranged ? 'ranged' : unit.role === 'camel_lancer' ? 'charge' : 'melee';
      events.push({ type: 'hit', x: target.pos.x, y: target.pos.y, kind });
      if (def.special === 'splash') splash(world, target, dmg);
    }
  } else {
    moveToward(world, unit, target.pos, def.speed);
  }
}

function healNearby(world: World, medic: Unit, def: SoldierDef): void {
  const target = nearestWounded(world, medic);
  if (!target) return;
  if (dist2(medic, target) <= def.range) {
    if (medic.attackCooldown === 0) {
      medic.attackCooldown = def.cooldownTicks;
      const max = SOLDIERS[target.role as SoldierType].hp;
      target.hp = Math.min(max, target.hp + HEAL_AMOUNT);
    }
  } else {
    moveToward(world, medic, target.pos, def.speed);
  }
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
// Raiders — the enemy. On the home map they only appear via the debug startRaid
// (they march on the keep); on the battlefield they advance on your army.
// ---------------------------------------------------------------------------

// Battlefield enemy AI: chase the nearest soldier and hit it in melee. Damage
// ramps with battlesWon so later battles bite harder.
function fieldAdvance(world: World, raider: Unit, events: SimEvent[]): void {
  const foe = nearestSoldier(world, raider);
  if (!foe) return;
  if (dist2(raider, foe) <= 1.7) {
    raider.path = null;
    if (raider.attackCooldown === 0) {
      raider.attackCooldown = RAIDER_COOLDOWN_TICKS;
      foe.hp -= RAIDER_DAMAGE * (1 + world.battlesWon * BATTLE_ENEMY_DMG_PER_LEVEL);
      events.push({ type: 'hit', x: foe.pos.x, y: foe.pos.y, kind: 'melee' });
    }
  } else {
    moveToward(world, raider, foe.pos);
  }
}

function updateRaider(world: World, raider: Unit, events: SimEvent[]): void {
  // Battlefield: no buildings to siege — advance on and attack the nearest
  // soldier, mirroring the player troops' auto-engage. Damage scales with level.
  if (world.kind === 'battle') {
    fieldAdvance(world, raider, events);
    return;
  }

  // Fight back: if a defending soldier is right next to us, hack at it instead
  // of marching on. (Soldiers close in via their own auto-engage.)
  const foe = nearestSoldier(world, raider);
  if (foe && dist2(raider, foe) <= 1.7) {
    raider.path = null;
    if (raider.attackCooldown === 0) {
      raider.attackCooldown = RAIDER_COOLDOWN_TICKS;
      foe.hp -= RAIDER_DAMAGE * (hasBlacksmith(world) ? BLACKSMITH_DEF_MULT : 1);
      events.push({ type: 'hit', x: foe.pos.x, y: foe.pos.y, kind: 'melee' });
    }
    return;
  }

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
