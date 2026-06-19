// All tunables live here. Balance is iterated by editing this table, not code.
// Shared type vocabulary (Resource, BuildingType) also lives here so both sim
// and render can import it without depending on each other.

export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_W = 128;
export const MAP_H = 128;

// ---------------------------------------------------------------------------
// Terrain — a per-tile land type layer underneath occupancy. Grass is the only
// passable, buildable type; water and rock are natural obstacles you build
// around (and water is where fish live).
// ---------------------------------------------------------------------------

export const T_GRASS = 0;
export const T_WATER = 1;
export const T_ROCK = 2;
export type Terrain = typeof T_GRASS | typeof T_WATER | typeof T_ROCK;

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

export type Resource = 'wood' | 'wheat' | 'flour' | 'stone' | 'bread' | 'apples' | 'meat' | 'fish';
export type StockResource = 'wood' | 'wheat' | 'flour' | 'stone'; // stored in the stockpile
export type FoodType = 'bread' | 'apples' | 'meat' | 'fish'; // stored in the granary
export const FOOD_TYPES: FoodType[] = ['bread', 'apples', 'meat', 'fish'];

// ---------------------------------------------------------------------------
// Gold & the Market — sell surplus goods for gold, buy goods you're short on.
// Gold is a pure currency (never hauled), held in world.gold. Buy > sell (a
// market spread) so trading isn't free money.
// ---------------------------------------------------------------------------

export const STARTING_GOLD = 20;

export interface TradeGood {
  resource: Resource;
  sell: number; // gold you get for selling 1
  buy: number; // gold it costs to buy 1
}

export const MARKET_GOODS: TradeGood[] = [
  { resource: 'wood', sell: 2, buy: 4 },
  { resource: 'wheat', sell: 2, buy: 4 },
  { resource: 'flour', sell: 3, buy: 6 },
  { resource: 'apples', sell: 3, buy: 6 },
  { resource: 'fish', sell: 4, buy: 8 },
  { resource: 'bread', sell: 4, buy: 8 },
  { resource: 'stone', sell: 4, buy: 8 },
  { resource: 'meat', sell: 5, buy: 10 },
];

export type BuildingType =
  | 'keep'
  | 'campfire'
  | 'stockpile'
  | 'granary'
  | 'house'
  | 'woodcutter'
  | 'appleOrchard'
  | 'hunter'
  | 'fishery'
  | 'wheatFarm'
  | 'mill'
  | 'bakery'
  | 'quarry'
  | 'market'
  | 'barracks'
  | 'blacksmith'
  | 'stable'
  | 'siege_workshop'
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
  /** Multi-resource placement cost. When omitted, costs `costWood` wood only. */
  cost?: TrainCost;
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
  // Fast single-building food sources — no input chain, deposit straight to the
  // granary. Build one of these early so you don't starve setting up bread.
  appleOrchard: {
    type: 'appleOrchard', label: 'Apple Orchard', size: { w: 3, h: 3 }, costWood: 8, hp: 100,
    buildable: true, color: 0x6fae5c, height: 14,
    recipe: { output: { resource: 'apples', amount: 1, dest: 'granary' }, workTicks: 95 },
  },
  hunter: {
    type: 'hunter', label: "Hunter's Hut", size: { w: 2, h: 2 }, costWood: 8, hp: 100,
    buildable: true, color: 0x8a6240, height: 24,
    recipe: { output: { resource: 'meat', amount: 1, dest: 'granary' }, workTicks: 120 },
  },
  // Coastal food source — must be built next to water. Its fisherman walks to
  // the nearest fishing spot in a pond/stream, casts, and hauls fish back to
  // the granary. Shoals deplete and slowly restock, like trees.
  fishery: {
    type: 'fishery', label: "Fisherman's Hut", size: { w: 2, h: 2 }, costWood: 9, hp: 100,
    buildable: true, color: 0x4f7a8a, height: 22,
    recipe: { output: { resource: 'fish', amount: 1, dest: 'granary' }, workTicks: 105 },
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
  // Quarry — its worker walks to the mountain (rock terrain) and mines stone,
  // hauling it back to the stockpile. Build it near the highlands.
  quarry: {
    type: 'quarry', label: 'Quarry', size: { w: 2, h: 2 }, costWood: 12, hp: 120,
    buildable: true, color: 0x8d887f, height: 20,
    recipe: { output: { resource: 'stone', amount: 1, dest: 'stockpile' }, workTicks: 130 },
  },
  // Trading post — no worker; selecting it opens a buy/sell panel (see the HUD).
  market: {
    type: 'market', label: 'Market', size: { w: 2, h: 2 }, costWood: 14, hp: 120,
    buildable: true, color: 0xb98a4e, height: 24,
  },
  // Military trainer — select it to open the soldier training panel.
  barracks: {
    type: 'barracks', label: 'Barracks', size: { w: 3, h: 3 }, costWood: 20, hp: 250,
    buildable: true, color: 0x9a6a42, height: 40,
  },
  // Army support — these exist to help your soldiers conquer the frontier.
  // Blacksmith: a standing buff to every player soldier (more attack, more armor).
  blacksmith: {
    type: 'blacksmith', label: 'Blacksmith', size: { w: 2, h: 2 }, costWood: 30, hp: 160,
    buildable: true, cost: { wood: 30, stone: 20 }, color: 0x6b6b75, height: 34,
  },
  // Stable: home-grown cavalry — building it unlocks Knight + Camel Lancer at the
  // Barracks without needing to capture their villages first.
  stable: {
    type: 'stable', label: 'Stable', size: { w: 3, h: 2 }, costWood: 40, hp: 180,
    buildable: true, cost: { wood: 40, gold: 25 }, color: 0x8a6a44, height: 30,
  },
  // Siege Workshop: unlocks the Mangonel for breaking enemy towers.
  siege_workshop: {
    type: 'siege_workshop', label: 'Siege Workshop', size: { w: 3, h: 3 }, costWood: 50, hp: 200,
    buildable: true, cost: { wood: 50, stone: 30 }, color: 0x7a5a34, height: 36,
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
// Building upgrades — spend wood to level up a production building and shrink
// its craft time. Level 1..MAX; the factor is applied to the recipe workTicks.
// ---------------------------------------------------------------------------

export const MAX_BUILDING_LEVEL = 9;
// Craft-time multiplier by level (index = level-1). Smooth diminishing returns
// from full time at Lv 1 down to ~0.2× at Lv 9.
export const UPGRADE_SPEED_FACTOR = [1, 0.85, 0.72, 0.61, 0.52, 0.44, 0.37, 0.31, 0.26];

export function workTicksAtLevel(baseTicks: number, level: number): number {
  return Math.max(1, Math.round(baseTicks * UPGRADE_SPEED_FACTOR[level - 1]));
}

/** Wood to upgrade a building from `currentLevel` to the next level. */
export function upgradeWoodCost(type: BuildingType, currentLevel: number): number {
  return Math.max(10, BUILDINGS[type].costWood * 2 * currentLevel);
}

// ---------------------------------------------------------------------------
// Soldiers — trained at the Barracks. Each is a unit role with combat stats.
// 'archer' overlaps the legacy keep-recruited archer (same role/stats).
// ---------------------------------------------------------------------------

export type SoldierType =
  | 'spearman'
  | 'manatarms'
  | 'pikeman'
  | 'knight'
  | 'archer'
  | 'crossbowman'
  | 'camel_lancer'
  | 'mangonel'
  | 'medic'
  | 'standard_bearer';

export type TrainCost = Partial<Record<'wood' | 'stone' | 'gold' | 'food', number>>;

export interface SoldierDef {
  type: SoldierType;
  label: string;
  hp: number;
  damage: number; // per hit (0 = non-combatant)
  range: number; // tiles; <=1.8 is melee, larger is ranged
  cooldownTicks: number; // ticks between attacks/heals
  speed: number; // tiles per tick
  cost: TrainCost;
  special?: 'heal' | 'aura' | 'splash';
  big?: boolean; // 110×100 mounted/siege sprite
}

export const SOLDIERS: Record<SoldierType, SoldierDef> = {
  spearman: { type: 'spearman', label: 'Spearman', hp: 70, damage: 10, range: 1.7, cooldownTicks: 18, speed: 0.12, cost: { wood: 6 } },
  manatarms: { type: 'manatarms', label: 'Man-at-Arms', hp: 110, damage: 14, range: 1.7, cooldownTicks: 20, speed: 0.11, cost: { wood: 8, gold: 6 } },
  pikeman: { type: 'pikeman', label: 'Pikeman', hp: 95, damage: 12, range: 2.4, cooldownTicks: 24, speed: 0.1, cost: { wood: 8, stone: 2 } },
  knight: { type: 'knight', label: 'Knight', hp: 200, damage: 22, range: 1.7, cooldownTicks: 22, speed: 0.12, cost: { gold: 20, stone: 6 } },
  archer: { type: 'archer', label: 'Archer', hp: 60, damage: 12, range: 6, cooldownTicks: 20, speed: 0.12, cost: { wood: 5 } },
  crossbowman: { type: 'crossbowman', label: 'Crossbowman', hp: 70, damage: 20, range: 7, cooldownTicks: 40, speed: 0.1, cost: { wood: 6, stone: 2 } },
  camel_lancer: { type: 'camel_lancer', label: 'Camel Lancer', hp: 90, damage: 18, range: 1.8, cooldownTicks: 18, speed: 0.22, cost: { gold: 18 }, big: true },
  mangonel: { type: 'mangonel', label: 'Mangonel', hp: 80, damage: 24, range: 8, cooldownTicks: 70, speed: 0.05, cost: { wood: 14, stone: 10 }, special: 'splash', big: true },
  medic: { type: 'medic', label: 'Field Medic', hp: 60, damage: 0, range: 1.7, cooldownTicks: 30, speed: 0.13, cost: { gold: 10 }, special: 'heal' },
  standard_bearer: { type: 'standard_bearer', label: 'Standard-Bearer', hp: 90, damage: 8, range: 1.7, cooldownTicks: 24, speed: 0.12, cost: { gold: 12 }, special: 'aura' },
};

export function isSoldier(role: string): role is SoldierType {
  return Object.prototype.hasOwnProperty.call(SOLDIERS, role);
}

// ---------------------------------------------------------------------------
// Enemy villages — scattered settlements you conquer by killing all their
// defenders. On capture the buildings flip to you, their land opens for
// building, you earn a passive income, and you unlock an elite soldier.
// ---------------------------------------------------------------------------

export interface VillageType {
  key: string;
  label: string;
  income: { resource: 'gold' | 'wood' | 'stone' | 'food'; amount: number };
  unlock: SoldierType; // elite unit unlocked on capture
  defenders: number; // guard count
}

export const VILLAGE_TYPES: VillageType[] = [
  { key: 'trade', label: 'Trade Post', income: { resource: 'gold', amount: 6 }, unlock: 'crossbowman', defenders: 3 },
  { key: 'granary', label: 'Granary Village', income: { resource: 'food', amount: 6 }, unlock: 'knight', defenders: 4 },
  { key: 'lumber', label: 'Lumber Camp', income: { resource: 'wood', amount: 8 }, unlock: 'camel_lancer', defenders: 3 },
  { key: 'quarry', label: 'Quarry Town', income: { resource: 'stone', amount: 5 }, unlock: 'mangonel', defenders: 4 },
];

// Elite soldiers start locked; conquering the matching village unlocks them.
export const ELITE_SOLDIERS: SoldierType[] = ['knight', 'crossbowman', 'camel_lancer', 'mangonel'];
export const VILLAGE_RADIUS = 6; // no-build zone around an enemy village center
export const VILLAGE_INCOME_INTERVAL = 200; // ticks (10s) between income payouts
// Living rivals: uncaptured villages keep building (towers/huts) + posting more
// guards over time, so the longer you leave one be, the tougher the fort.
export const VILLAGE_GROW_INTERVAL = 1400; // ticks (~70s) between growth steps
export const VILLAGE_MAX_BUILDINGS = 7;
export const VILLAGE_MAX_GUARDS = 8;
export const GUARD_AGGRO = 8; // tiles; defenders engage intruders within this of home
export const SOLDIER_AGGRO = 9; // tiles; your idle soldiers auto-engage enemies within this

// Blacksmith standing buff to every player soldier while at least one stands.
export const BLACKSMITH_DMG_MULT = 1.25; // +25% outgoing damage
export const BLACKSMITH_DEF_MULT = 0.85; // -15% incoming damage

export const HEAL_AMOUNT = 8; // hp a medic restores per heal tick
export const AURA_RADIUS = 5; // tiles; standard-bearer damage buff range
export const AURA_DAMAGE_MULT = 1.3;
export const MANGONEL_SPLASH = 2.5; // tiles radius of splash damage

// ---------------------------------------------------------------------------
// Units (used from M3 on)
// ---------------------------------------------------------------------------

export const UNIT_SPEED = 0.12; // tiles per tick (~2.4 tiles/sec)
export const REPATH_COOLDOWN_TICKS = 30;

// ---------------------------------------------------------------------------
// Trees — harvest nodes that woodcutters walk out to and chop
// ---------------------------------------------------------------------------

export const TREE_CLUSTERS = 28;
export const TREE_PER_CLUSTER = 6;
export const TREE_WOOD = 6; // chops before it becomes a stump
export const TREE_REGROW_TICKS = 1000; // stump -> tree (~50s)
export const TREE_CLEAR_RADIUS = 9; // keep the start area around the keep clear

// ---------------------------------------------------------------------------
// Fish — harvest nodes that live on water tiles. A fisherman stands on the
// shore beside one and catches fish; depleted shoals restock over time.
// ---------------------------------------------------------------------------

export const FISH_STOCK = 6; // catches before a shoal is fished out
export const FISH_REGROW_TICKS = 1200; // empty shoal -> restocked (~60s)

// ---------------------------------------------------------------------------
// Population & popularity (M4)
// ---------------------------------------------------------------------------

export const POPULARITY_START = 75;
export const EAT_INTERVAL_TICKS = 400; // every 20s
export const POPULARITY_FED_DELTA = 2;
export const POPULARITY_HUNGRY_DELTA = -6;
// A varied diet keeps people happier: +1 popularity per distinct food type
// eaten beyond the first, capped here. (1 food = +0, 2 = +1, 3 = +2.)
export const POPULARITY_VARIETY_BONUS_MAX = 2;
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
