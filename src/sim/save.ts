// World <-> JSON. The world is plain data, so this is mostly Map/TypedArray
// conversion. Game state never lives on display objects — the renderer is
// disposable, which is what keeps this file small.

import { RAID_AT_TICK, RAIDS_ENABLED, STARTING_GOLD } from '../config';
import type { Building, Fish, Tree, Unit, World } from './world';

// Bumped to 8: two-scene redesign — the home map dropped its enemy villages,
// gained world.kind ('home'|'battle') + battlesWon (battlefield progression).
// Only the home world is ever saved; battles are transient.
const SAVE_VERSION = 8;

interface SaveFile {
  version: number;
  world: Omit<World, 'occupancy' | 'terrain' | 'buildings' | 'units' | 'trees' | 'fish'> & {
    occupancy: number[];
    terrain: number[];
    buildings: [number, Building][];
    units: [number, Unit][];
    trees: [number, Tree][];
    fish: [number, Fish][];
  };
}

export function serializeWorld(world: World): string {
  const save: SaveFile = {
    version: SAVE_VERSION,
    world: {
      ...world,
      occupancy: Array.from(world.occupancy),
      terrain: Array.from(world.terrain),
      buildings: [...world.buildings.entries()],
      units: [...world.units.entries()],
      trees: [...world.trees.entries()],
      fish: [...world.fish.entries()],
    },
  };
  return JSON.stringify(save);
}

export function deserializeWorld(json: string): World | null {
  try {
    const save = JSON.parse(json) as SaveFile;
    if (save.version !== SAVE_VERSION) return null;
    const w = save.world;
    return {
      ...w,
      occupancy: Uint32Array.from(w.occupancy),
      terrain: Uint8Array.from(w.terrain),
      buildings: new Map(w.buildings),
      units: new Map(w.units),
      trees: new Map(w.trees),
      fish: new Map(w.fish),
      // Backfill fields added after v5 shipped, so older same-version autosaves
      // don't load with `undefined` resources/flags.
      gold: w.gold ?? STARTING_GOLD,
      raidsEnabled: w.raidsEnabled ?? RAIDS_ENABLED,
      nextRaidTick: w.nextRaidTick ?? RAID_AT_TICK,
      kind: w.kind ?? 'home',
      battlesWon: w.battlesWon ?? 0,
      stockpile: { wood: 0, wheat: 0, flour: 0, stone: 0, ...(w.stockpile as Partial<World['stockpile']>) },
      granaryFood: { bread: 0, apples: 0, meat: 0, fish: 0, ...(w.granaryFood as Partial<World['granaryFood']>) },
    };
  } catch {
    return null;
  }
}
