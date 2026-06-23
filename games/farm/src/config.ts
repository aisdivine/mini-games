// All tunables + the shared type vocabulary for the farm. Balance is edited
// here, not in logic. Pure data — imported by both the sim and the renderer.

export const FARM_W = 20;
export const FARM_H = 13;
export const TILE = 44; // px per tile at 1x

// Terrain layer (under crops). Soil is the only plantable type; you make it by
// tilling grass with the hoe. Water is the pond; path is decorative.
export const T_GRASS = 0;
export const T_SOIL = 1;
export const T_WATER = 2;
export const T_PATH = 3;
export type Terrain = typeof T_GRASS | typeof T_SOIL | typeof T_WATER | typeof T_PATH;

// --- Economy / energy --------------------------------------------------------
export const STARTING_GOLD = 150;
export const MAX_ENERGY = 100;
export const TILL_ENERGY = 3;
export const WATER_ENERGY = 2;
export const PLANT_ENERGY = 2;

// --- Tools -------------------------------------------------------------------
export type Tool = 'hoe' | 'water' | 'plant';

// --- Crops -------------------------------------------------------------------
export type CropType = 'parsnip' | 'potato' | 'strawberry' | 'pumpkin';

export interface CropDef {
  type: CropType;
  label: string;
  emoji: string;
  days: number; // watered days from seed to mature
  seedCost: number; // gold to buy one seed
  sell: number; // gold per harvested crop
  /** Stage colors low→high for the little plant sprite. */
  leaf: string;
  fruit: string;
}

export const CROPS: Record<CropType, CropDef> = {
  parsnip: { type: 'parsnip', label: 'Parsnip', emoji: '🥕', days: 4, seedCost: 20, sell: 35, leaf: '#6CA84E', fruit: '#E8C45A' },
  potato: { type: 'potato', label: 'Potato', emoji: '🥔', days: 5, seedCost: 30, sell: 55, leaf: '#5E9C46', fruit: '#B07A3C' },
  strawberry: { type: 'strawberry', label: 'Strawberry', emoji: '🍓', days: 6, seedCost: 50, sell: 95, leaf: '#4E913F', fruit: '#D6453B' },
  pumpkin: { type: 'pumpkin', label: 'Pumpkin', emoji: '🎃', days: 7, seedCost: 60, sell: 140, leaf: '#4E8C3C', fruit: '#E07A1F' },
};

export const CROP_ORDER: CropType[] = ['parsnip', 'potato', 'strawberry', 'pumpkin'];

// --- Farmhand (a friendly helper on the farm) --------------------------------
// Mood 0..100; hearts = mood / 10. Each morning the farmhand waters a batch of
// your unwatered crops — more as their mood grows. Gifts raise mood.
export const HELPER_MAX_MOOD = 100;
export const HELPER_BASE_WATER = 2; // crops watered at 0 hearts
export const HELPER_GIFT_MOOD = 15; // per gift (once/day)

export const hearts = (mood: number): number => Math.floor(mood / 10);
