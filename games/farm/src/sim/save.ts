// World <-> JSON. The farm world is already plain data (arrays + records), so
// this is a thin version gate around JSON.

import { CROP_ORDER, type CropType } from '../config';
import { createWorld, type World } from './world';

const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  world: World;
}

export function serialize(world: World): string {
  return JSON.stringify({ version: SAVE_VERSION, world } satisfies SaveFile);
}

export function deserialize(json: string): World | null {
  try {
    const save = JSON.parse(json) as SaveFile;
    if (save.version !== SAVE_VERSION) return null;
    const fresh = createWorld();
    const w = save.world;
    // Merge over a fresh world so any field added later is backfilled.
    const seeds = { ...fresh.seeds, ...(w.seeds ?? {}) } as Record<CropType, number>;
    const harvest = { ...fresh.harvest, ...(w.harvest ?? {}) } as Record<CropType, number>;
    for (const c of CROP_ORDER) {
      seeds[c] ??= 0;
      harvest[c] ??= 0;
    }
    return { ...fresh, ...w, seeds, harvest };
  } catch {
    return null;
  }
}
