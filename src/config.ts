// All tunables live here. Balance is iterated by editing this table, not code.
// Shared type vocabulary (Resource, BuildingType) also lives here so both sim
// and render can import it without depending on each other.

export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_W = 64;
export const MAP_H = 64;

export const SIM_TICKS_PER_SEC = 20;
export const SIM_DT_MS = 1000 / SIM_TICKS_PER_SEC;
export const MAX_ACCUM_MS = 250; // clamp after tab-return so we never spiral

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 1.1;
export const KEY_PAN_SPEED = 12; // px per frame at scale 1

// Edge scrolling: cursor within this many px of a screen edge pans the camera
// that direction (classic RTS feel). Speed is px per 60fps frame.
export const EDGE_PAN_MARGIN = 60;
export const EDGE_PAN_SPEED = 16;

export const STARTING_WOOD = 100;
export const DEMOLISH_REFUND = 0.5;

// ---------------------------------------------------------------------------
// Resources & buildings
// ---------------------------------------------------------------------------

export type Resource = 'wood' | 'wheat' | 'flour' | 'bread';
export type StockResource = Exclude<Resource, 'bread'>; // bread lives in the granary

export type BuildingType =
  | 'keep'
  | 'campfire'
  | 'stockpile'
  | 'granary'
  | 'house'
  | 'woodcutter'
  | 'wheatFarm'
  | 'mill'
  | 'bakery'
  | 'wall'
  | 'tower';

export interface RecipeDef {
  /** Input fetched from the stockpile before each production run. */
  input?: { resource: StockResource; amount: number };
  output: { resource: Resource; amount: number; dest: 'stockpile' | 'granary' };
  workTicks: number;
}

export interface BuildingDef {
  type: BuildingType;
  label: string;
  size: { w: number; h: number };
  costWood: number;
  hp: number;
  buildable: boolean; // appears in the build menu
  housing?: number;
  recipe?: RecipeDef;
  // Programmer-art visuals (the future sprite-swap seam lives in buildingView).
  color: number;
  height: number; // extruded box height in px
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  keep: {
    type: 'keep', label: 'Keep', size: { w: 3, h: 3 }, costWood: 0, hp: 600,
    buildable: false, housing: 4, color: 0x8a8a96, height: 84,
  },
  campfire: {
    type: 'campfire', label: 'Campfire', size: { w: 1, h: 1 }, costWood: 0, hp: 50,
    buildable: false, color: 0xd96f32, height: 10,
  },
  stockpile: {
    type: 'stockpile', label: 'Stockpile', size: { w: 3, h: 3 }, costWood: 0, hp: 200,
    buildable: false, color: 0x9c8a5a, height: 6,
  },
  granary: {
    type: 'granary', label: 'Granary', size: { w: 2, h: 2 }, costWood: 8, hp: 200,
    buildable: true, color: 0xc4a24e, height: 30,
  },
  house: {
    type: 'house', label: 'House', size: { w: 2, h: 2 }, costWood: 6, hp: 100,
    buildable: true, housing: 4, color: 0xa9714b, height: 26,
  },
  woodcutter: {
    type: 'woodcutter', label: 'Woodcutter', size: { w: 2, h: 2 }, costWood: 3, hp: 100,
    buildable: true, color: 0x6e4f2a, height: 22,
    recipe: { output: { resource: 'wood', amount: 1, dest: 'stockpile' }, workTicks: 70 },
  },
  wheatFarm: {
    type: 'wheatFarm', label: 'Wheat Farm', size: { w: 3, h: 3 }, costWood: 10, hp: 100,
    buildable: true, color: 0xd9c34a, height: 12,
    recipe: { output: { resource: 'wheat', amount: 1, dest: 'stockpile' }, workTicks: 140 },
  },
  mill: {
    type: 'mill', label: 'Mill', size: { w: 2, h: 2 }, costWood: 12, hp: 120,
    buildable: true, color: 0xb8b8c4, height: 58,
    recipe: {
      input: { resource: 'wheat', amount: 1 },
      output: { resource: 'flour', amount: 1, dest: 'stockpile' },
      workTicks: 80,
    },
  },
  bakery: {
    type: 'bakery', label: 'Bakery', size: { w: 2, h: 2 }, costWood: 10, hp: 120,
    buildable: true, color: 0xc97b4a, height: 32,
    recipe: {
      input: { resource: 'flour', amount: 1 },
      output: { resource: 'bread', amount: 1, dest: 'granary' },
      workTicks: 100,
    },
  },
  wall: {
    type: 'wall', label: 'Wall', size: { w: 1, h: 1 }, costWood: 1, hp: 150,
    buildable: true, color: 0x7d7d88, height: 30,
  },
  tower: {
    type: 'tower', label: 'Tower', size: { w: 2, h: 2 }, costWood: 15, hp: 300,
    buildable: true, color: 0x6d6d78, height: 60,
  },
};

// ---------------------------------------------------------------------------
// Units (used from M3 on)
// ---------------------------------------------------------------------------

export const UNIT_SPEED = 0.12; // tiles per tick (~2.4 tiles/sec)
export const REPATH_COOLDOWN_TICKS = 30;

// ---------------------------------------------------------------------------
// Trees — harvest nodes that woodcutters walk out to and chop
// ---------------------------------------------------------------------------

export const TREE_CLUSTERS = 16;
export const TREE_PER_CLUSTER = 6;
export const TREE_WOOD = 6; // chops before it becomes a stump
export const TREE_REGROW_TICKS = 1000; // stump -> tree (~50s)
export const TREE_CLEAR_RADIUS = 9; // keep the start area around the keep clear

// ---------------------------------------------------------------------------
// Population & popularity (M4)
// ---------------------------------------------------------------------------

export const POPULARITY_START = 75;
export const EAT_INTERVAL_TICKS = 400; // every 20s
export const POPULARITY_FED_DELTA = 2;
export const POPULARITY_HUNGRY_DELTA = -8;
export const IMMIGRATION_INTERVAL_TICKS = 200;
export const IMMIGRATION_MIN_POPULARITY = 60;
export const EMIGRATION_MAX_POPULARITY = 30;
export const STARTING_PEASANTS = 4;

// ---------------------------------------------------------------------------
// Combat (M5)
// ---------------------------------------------------------------------------

export const ARCHER_COST_WOOD = 5;
export const ARCHER_RANGE = 6; // tiles
export const ARCHER_TOWER_RANGE_BONUS = 3;
export const ARCHER_COOLDOWN_TICKS = 20;
export const ARCHER_DAMAGE = 12;
export const ARCHER_HP = 60;
export const RAIDER_HP = 80;
export const RAIDER_DAMAGE = 8;
export const RAIDER_COOLDOWN_TICKS = 20;
export const RAIDER_COUNT = 8;
export const RAID_AT_TICK = 20 * 60 * 8; // 8 minutes in
// Master switch. While false, raids never auto-trigger — peaceful city-builder
// sandbox. The debug 'r' key still works for manual testing.
export const RAIDS_ENABLED = false;
