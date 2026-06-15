// World <-> JSON. The world is plain data, so this is mostly Map/TypedArray
// conversion. Game state never lives on display objects — the renderer is
// disposable, which is what keeps this file small.

import type { Building, Fish, Tree, Unit, World } from './world';

// Bumped to 5: the world now carries a terrain layer + fish shoals, and the
// map dimensions changed — old saves can't be loaded into the new grid.
const SAVE_VERSION = 5;

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
    };
  } catch {
    return null;
  }
}
