// Depot stores and reservations. A reservation holds input stock for one
// building's fetch trip so two mills can't both grab the last wheat. The
// physical count only changes at pickup (commit) — the HUD number always
// matches what peasants are visibly doing.

import { FOOD_TYPES, type FoodType, type Resource, type StockResource } from '../config';
import type { Building, World } from './world';

export function availableStock(world: World, resource: StockResource): number {
  let reserved = 0;
  for (const r of world.reservations) {
    if (r.resource === resource) reserved += r.amount;
  }
  return world.stockpile[resource] - reserved;
}

export function reserve(
  world: World,
  resource: StockResource,
  amount: number,
  buildingId: number,
): number | null {
  if (availableStock(world, resource) < amount) return null;
  const id = world.nextId++;
  world.reservations.push({ id, resource, amount, buildingId });
  return id;
}

/** Physically pick up reserved goods at the stockpile. */
export function commitReservation(world: World, reservationId: number): Reservation | null {
  const i = world.reservations.findIndex((r) => r.id === reservationId);
  if (i < 0) return null;
  const r = world.reservations[i];
  world.reservations.splice(i, 1);
  world.stockpile[r.resource] -= r.amount;
  return r;
}

export function releaseBuildingReservations(world: World, buildingId: number): void {
  world.reservations = world.reservations.filter((r) => r.buildingId !== buildingId);
}

export function deposit(world: World, resource: Resource, amount: number): void {
  if ((FOOD_TYPES as Resource[]).includes(resource)) {
    world.granaryFood[resource as FoodType] += amount;
  } else {
    world.stockpile[resource as StockResource] += amount;
  }
}

/** Current on-hand count of a resource, wherever it's stored. */
export function resourceCount(world: World, resource: Resource): number {
  return (FOOD_TYPES as Resource[]).includes(resource)
    ? world.granaryFood[resource as FoodType]
    : world.stockpile[resource as StockResource];
}

export function findDepot(world: World, dest: 'stockpile' | 'granary'): Building | null {
  for (const b of world.buildings.values()) {
    if (b.type === dest && b.owner === 'player') return b; // never an enemy depot
  }
  return null;
}

type Reservation = World['reservations'][number];
