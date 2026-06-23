// The World struct: plain serializable data, no methods, no display objects.
// The farm is action-driven (no continuous tick) — all mutations live in
// actions.ts. The renderer reconciles against this struct each frame.

import {
  CROP_ORDER,
  FARM_H,
  FARM_W,
  MAX_ENERGY,
  STARTING_GOLD,
  T_GRASS,
  T_PATH,
  T_SOIL,
  T_WATER,
  type CropType,
  type Terrain,
} from '../config';

export interface Crop {
  type: CropType;
  stage: number; // 0..def.days; mature when stage >= def.days
  watered: boolean; // resets every morning
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface World {
  w: number;
  h: number;
  terrain: Terrain[]; // length w*h
  crops: (Crop | null)[]; // length w*h
  day: number;
  gold: number;
  energy: number;
  seeds: Record<CropType, number>; // owned seeds
  harvest: Record<CropType, number>; // harvested crops in the chest
  helperMood: number;
  helperGiftedToday: boolean;
  /** The farmhand's wander spot (render reads it; set by the morning routine). */
  helperTile: Vec2;
  /** Totals for the little end-of-day / lifetime tally. */
  totalEarned: number;
  totalHarvested: number;
}

export const idx = (x: number, y: number): number => y * FARM_W + x;
export const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < FARM_W && y < FARM_H;

const zeroCounts = (): Record<CropType, number> =>
  CROP_ORDER.reduce((o, c) => ((o[c] = 0), o), {} as Record<CropType, number>);

export function createWorld(): World {
  const terrain: Terrain[] = new Array(FARM_W * FARM_H).fill(T_GRASS);

  // A little pond in the bottom-right (watering-can flavor + scenery).
  for (let y = FARM_H - 4; y < FARM_H - 1; y++) {
    for (let x = FARM_W - 5; x < FARM_W - 2; x++) terrain[idx(x, y)] = T_WATER;
  }
  // A path down the middle-left where the farmhouse sits.
  for (let y = 0; y < FARM_H; y++) terrain[idx(2, y)] = T_PATH;
  for (let x = 0; x < 3; x++) terrain[idx(x, 1)] = T_PATH;

  return {
    w: FARM_W,
    h: FARM_H,
    terrain,
    crops: new Array(FARM_W * FARM_H).fill(null),
    day: 1,
    gold: STARTING_GOLD,
    energy: MAX_ENERGY,
    seeds: { ...zeroCounts(), parsnip: 5 }, // start with a few parsnip seeds
    harvest: zeroCounts(),
    helperMood: 0,
    helperGiftedToday: false,
    helperTile: { x: FARM_W >> 1, y: FARM_H >> 1 },
    totalEarned: 0,
    totalHarvested: 0,
  };
}

export const cropAt = (world: World, x: number, y: number): Crop | null =>
  inBounds(x, y) ? world.crops[idx(x, y)] : null;

export const isMature = (world: World, x: number, y: number): boolean => {
  const c = cropAt(world, x, y);
  return !!c && c.stage >= cropDays(c.type);
};

// imported lazily to avoid a config import cycle in tight loops
import { CROPS } from '../config';
export const cropDays = (t: CropType): number => CROPS[t].days;

export const tillable = (world: World, x: number, y: number): boolean =>
  inBounds(x, y) && world.terrain[idx(x, y)] === T_GRASS;

export const isSoil = (world: World, x: number, y: number): boolean =>
  inBounds(x, y) && world.terrain[idx(x, y)] === T_SOIL;

// re-export terrain constants used by callers via this module
export { T_GRASS, T_SOIL, T_WATER, T_PATH };
