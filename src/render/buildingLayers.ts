// Animated building overlays from the v2 pack. Each layer SVG shares its base's
// 130×126 viewBox + anchor and carries a data-pivot = the motion origin (flag
// hinge, sail hub, chimney mouth, etc.). buildingView pins each layer on the
// base at the shared anchor; sceneSync drives the transform per frame by motion
// kind. Loaded once at startup, same as the base textures.

import type { Texture } from 'pixi.js';
import type { BuildingType } from '../config';
import type { Pt } from '../art/types';
import { rasterizeSvg } from './assets';

import keepFlag from '../art/v2/pack/buildings/keep_flag.svg?raw';
import towerFlag from '../art/v2/pack/buildings/tower_flag.svg?raw';
import millSails from '../art/v2/pack/buildings/mill_sails.svg?raw';
import houseSmoke from '../art/v2/pack/buildings/house_smoke.svg?raw';
import bakerySmoke from '../art/v2/pack/buildings/bakery_smoke.svg?raw';
import blacksmithSmoke from '../art/v2/pack/buildings/blacksmith_smoke.svg?raw';
import woodSaw from '../art/v2/pack/buildings/wood_saw.svg?raw';
import wheatStalks from '../art/v2/pack/buildings/wheat_stalks.svg?raw';
import campfireFlame from '../art/v2/pack/buildings/campfire_flame.svg?raw';
import marketAwning from '../art/v2/pack/decor/market_awning.svg?raw';
import windowGlow from '../art/v2/pack/atmosphere/window_glow.svg?raw';

export type LayerMotion = 'flag' | 'sails' | 'smoke' | 'saw' | 'stalks' | 'flame' | 'glow' | 'awning';

interface LayerSpec {
  raw: string;
  motion: LayerMotion;
  /** Only animate (and for smoke, brighten) while the building is producing. */
  activeOnly?: boolean;
}

// Each building may have several stacked layers (drawn in order on top of base).
const SPECS: Partial<Record<BuildingType, LayerSpec[]>> = {
  keep: [{ raw: keepFlag, motion: 'flag' }],
  tower: [{ raw: towerFlag, motion: 'flag' }],
  mill: [{ raw: millSails, motion: 'sails' }],
  house: [{ raw: houseSmoke, motion: 'smoke' }, { raw: windowGlow, motion: 'glow' }],
  bakery: [{ raw: bakerySmoke, motion: 'smoke', activeOnly: true }],
  // The forge is always lit — smoke puffs continuously (no production state).
  blacksmith: [{ raw: blacksmithSmoke, motion: 'smoke' }],
  woodcutter: [{ raw: woodSaw, motion: 'saw', activeOnly: true }],
  wheatFarm: [{ raw: wheatStalks, motion: 'stalks' }],
  market: [{ raw: marketAwning, motion: 'awning' }],
  campfire: [{ raw: campfireFlame, motion: 'flame' }],
};

export interface LayerTexture {
  texture: Texture;
  anchor: Pt; // shared with the base — where the layer pins onto it
  pivot: Pt; // motion origin in canvas pixels
  motion: LayerMotion;
  activeOnly: boolean;
}

export type BuildingLayers = Map<BuildingType, LayerTexture[]>;

function num(re: RegExp, svg: string, fallback: number): number {
  return Number(re.exec(svg)?.[1] ?? fallback);
}

export async function loadBuildingLayers(): Promise<BuildingLayers> {
  const out: BuildingLayers = new Map();
  const tasks = (Object.entries(SPECS) as [BuildingType, LayerSpec[]][]).map(
    async ([type, specs]) => {
      const built = await Promise.all(
        specs.map(async (spec) => {
          const svg = spec.raw.trim();
          const ax = num(/data-anchor="([\d.]+),/, svg, 65);
          const ay = num(/data-anchor="[\d.]+,([\d.]+)"/, svg, 92);
          const px = num(/data-pivot="([\d.]+),/, svg, ax);
          const py = num(/data-pivot="[\d.]+,([\d.]+)"/, svg, ay);
          const texture = await rasterizeSvg(svg);
          return {
            texture,
            anchor: { x: ax, y: ay },
            pivot: { x: px, y: py },
            motion: spec.motion,
            activeOnly: spec.activeOnly ?? false,
          } as LayerTexture;
        }),
      );
      out.set(type, built);
    },
  );
  await Promise.all(tasks);
  return out;
}
