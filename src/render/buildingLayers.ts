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
import woodSaw from '../art/v2/pack/buildings/wood_saw.svg?raw';
import wheatStalks from '../art/v2/pack/buildings/wheat_stalks.svg?raw';
import campfireFlame from '../art/v2/pack/buildings/campfire_flame.svg?raw';

export type LayerMotion = 'flag' | 'sails' | 'smoke' | 'saw' | 'stalks' | 'flame';

interface LayerSpec {
  raw: string;
  motion: LayerMotion;
  /** Only animate (and for smoke, brighten) while the building is producing. */
  activeOnly?: boolean;
}

const SPECS: Partial<Record<BuildingType, LayerSpec>> = {
  keep: { raw: keepFlag, motion: 'flag' },
  tower: { raw: towerFlag, motion: 'flag' },
  mill: { raw: millSails, motion: 'sails' },
  house: { raw: houseSmoke, motion: 'smoke' },
  bakery: { raw: bakerySmoke, motion: 'smoke', activeOnly: true },
  woodcutter: { raw: woodSaw, motion: 'saw', activeOnly: true },
  wheatFarm: { raw: wheatStalks, motion: 'stalks' },
  campfire: { raw: campfireFlame, motion: 'flame' },
};

export interface LayerTexture {
  texture: Texture;
  anchor: Pt; // shared with the base — where the layer pins onto it
  pivot: Pt; // motion origin in canvas pixels
  motion: LayerMotion;
  activeOnly: boolean;
}

export type BuildingLayers = Map<BuildingType, LayerTexture>;

function num(re: RegExp, svg: string, fallback: number): number {
  return Number(re.exec(svg)?.[1] ?? fallback);
}

export async function loadBuildingLayers(): Promise<BuildingLayers> {
  const out: BuildingLayers = new Map();
  const tasks = (Object.entries(SPECS) as [BuildingType, LayerSpec][]).map(
    async ([type, spec]) => {
      const svg = spec.raw.trim();
      const ax = num(/data-anchor="([\d.]+),/, svg, 65);
      const ay = num(/data-anchor="[\d.]+,([\d.]+)"/, svg, 92);
      const px = num(/data-pivot="([\d.]+),/, svg, ax);
      const py = num(/data-pivot="[\d.]+,([\d.]+)"/, svg, ay);
      const texture = await rasterizeSvg(svg);
      out.set(type, {
        texture,
        anchor: { x: ax, y: ay },
        pivot: { x: px, y: py },
        motion: spec.motion,
        activeOnly: spec.activeOnly ?? false,
      });
    },
  );
  await Promise.all(tasks);
  return out;
}
