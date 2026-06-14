// World <-> JSON. The world is plain data, so this is mostly Map/TypedArray
// conversion. Game state never lives on display objects — the renderer is
// disposable, which is what keeps this file small.

import type { Building, Tree, Unit, World } from './world';

const SAVE_VERSION = 2;

interface SaveFile {
  version: number;
  world: Omit<World, 'occupancy' | 'buildings' | 'units' | 'trees'> & {
    occupancy: number[];
    buildings: [number, Building][];
    units: [number, Unit][];
    trees: [number, Tree][];
  };
}

export function serializeWorld(world: World): string {
  const save: SaveFile = {
    version: SAVE_VERSION,
    world: {
      ...world,
      occupancy: Array.from(world.occupancy),
      buildings: [...world.buildings.entries()],
      units: [...world.units.entries()],
      trees: [...world.trees.entries()],
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
      buildings: new Map(w.buildings),
      units: new Map(w.units),
      trees: new Map(w.trees),
    };
  } catch {
    return null;
  }
}
