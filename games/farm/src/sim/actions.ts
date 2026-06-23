// Every player-driven mutation of the farm. Action-driven (no continuous tick):
// the renderer calls these on input and re-reads the world. Each returns an
// ActionResult so the HUD can flash feedback.

import {
  CROPS,
  HELPER_BASE_WATER,
  HELPER_GIFT_MOOD,
  HELPER_MAX_MOOD,
  MAX_ENERGY,
  PLANT_ENERGY,
  TILL_ENERGY,
  T_SOIL,
  WATER_ENERGY,
  hearts,
  type CropType,
  type Tool,
} from '../config';
import { cropDays, idx, inBounds, isMature, type World } from './world';

export interface ActionResult {
  ok: boolean;
  msg: string;
}
const ok = (msg = ''): ActionResult => ({ ok: true, msg });
const no = (msg: string): ActionResult => ({ ok: false, msg });

function spend(world: World, energy: number): boolean {
  if (world.energy < energy) return false;
  world.energy -= energy;
  return true;
}

export function till(world: World, x: number, y: number): ActionResult {
  if (!inBounds(x, y)) return no('Out of bounds');
  const i = idx(x, y);
  if (world.terrain[i] === T_SOIL) return no('Already tilled');
  if (world.terrain[i] !== 0) return no("Can't till here"); // not grass
  if (!spend(world, TILL_ENERGY)) return no('Too tired — go to sleep');
  world.terrain[i] = T_SOIL;
  return ok();
}

export function water(world: World, x: number, y: number): ActionResult {
  const c = inBounds(x, y) ? world.crops[idx(x, y)] : null;
  if (!c) return no('Nothing planted to water here');
  if (c.watered) return no('Already watered');
  if (!spend(world, WATER_ENERGY)) return no('Too tired — go to sleep');
  c.watered = true;
  return ok();
}

export function plant(world: World, x: number, y: number, type: CropType): ActionResult {
  if (!inBounds(x, y)) return no('Out of bounds');
  const i = idx(x, y);
  if (world.terrain[i] !== T_SOIL) return no('Till the soil first (hoe)');
  if (world.crops[i]) return no('Something already grows here');
  if (world.seeds[type] <= 0) return no(`No ${CROPS[type].label} seeds — buy some`);
  if (!spend(world, PLANT_ENERGY)) return no('Too tired — go to sleep');
  world.seeds[type]--;
  world.crops[i] = { type, stage: 0, watered: false };
  return ok(`Planted ${CROPS[type].label}`);
}

export function harvest(world: World, x: number, y: number): ActionResult {
  if (!isMature(world, x, y)) return no('Not ready to harvest');
  const i = idx(x, y);
  const c = world.crops[i]!;
  world.harvest[c.type]++;
  world.totalHarvested++;
  world.crops[i] = null; // tile stays tilled for replanting
  return ok(`Harvested ${CROPS[c.type].emoji} ${CROPS[c.type].label}`);
}

/** Click-a-tile dispatch: harvest a ready crop with any tool, else use the
 *  selected tool. */
export function applyTile(world: World, x: number, y: number, tool: Tool, seed: CropType): ActionResult {
  if (isMature(world, x, y)) return harvest(world, x, y);
  if (tool === 'hoe') return till(world, x, y);
  if (tool === 'water') return water(world, x, y);
  return plant(world, x, y, seed);
}

// --- Shop --------------------------------------------------------------------
export function buySeed(world: World, type: CropType, n = 1): ActionResult {
  const cost = CROPS[type].seedCost * n;
  if (world.gold < cost) return no(`Need ${cost}g`);
  world.gold -= cost;
  world.seeds[type] += n;
  return ok(`Bought ${n} ${CROPS[type].label} seed${n > 1 ? 's' : ''}`);
}

export function sellHarvest(world: World, type: CropType, n?: number): ActionResult {
  const have = world.harvest[type];
  if (have <= 0) return no(`No ${CROPS[type].label} to sell`);
  const count = n ? Math.min(n, have) : have;
  const gain = CROPS[type].sell * count;
  world.harvest[type] -= count;
  world.gold += gain;
  world.totalEarned += gain;
  return ok(`Sold ${count} ${CROPS[type].label} for ${gain}g`);
}

// --- Farmhand ----------------------------------------------------------------
export function giftHelper(world: World): ActionResult {
  if (world.helperGiftedToday) return no('The farmhand already got a gift today 💛');
  // Gift one of your most-abundant harvested crop.
  let best: CropType | null = null;
  for (const t of Object.keys(world.harvest) as CropType[]) {
    if (world.harvest[t] > 0 && (!best || world.harvest[t] > world.harvest[best])) best = t;
  }
  if (!best) return no('Harvest something to gift first');
  world.harvest[best]--;
  world.helperMood = Math.min(HELPER_MAX_MOOD, world.helperMood + HELPER_GIFT_MOOD);
  world.helperGiftedToday = true;
  return ok(`Gave the farmhand a ${CROPS[best].emoji} — they love it! 💖`);
}

/** The farmhand's morning help: waters up to (base + hearts) of your unwatered
 *  crops, oldest-first by scan order. Returns how many were watered. */
function helperWater(world: World): number {
  let budget = HELPER_BASE_WATER + hearts(world.helperMood);
  let watered = 0;
  let firstPlanted: number | null = null;
  for (let i = 0; i < world.crops.length && budget > 0; i++) {
    const c = world.crops[i];
    if (!c) continue;
    if (firstPlanted === null) firstPlanted = i;
    if (!c.watered && c.stage < cropDays(c.type)) {
      c.watered = true;
      budget--;
      watered++;
    }
  }
  if (firstPlanted !== null) {
    world.helperTile = { x: firstPlanted % world.w, y: Math.floor(firstPlanted / world.w) };
  }
  return watered;
}

/** Sleep → next morning. The farmhand waters, watered crops grow overnight,
 *  energy refills. Returns a summary for the HUD. */
export function sleep(world: World): ActionResult {
  const helped = helperWater(world);
  let grew = 0;
  for (const c of world.crops) {
    if (!c) continue;
    if (c.watered && c.stage < cropDays(c.type)) {
      c.stage++;
      grew++;
    }
    c.watered = false; // dries out each morning
  }
  world.day++;
  world.energy = MAX_ENERGY;
  world.helperGiftedToday = false;
  const helpNote = helped > 0 ? ` The farmhand watered ${helped} for you 💕` : '';
  return ok(`☀️ Day ${world.day}. ${grew} crop${grew === 1 ? '' : 's'} grew.${helpNote}`);
}
