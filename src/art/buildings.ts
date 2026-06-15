// Building art now comes from the v2 SVG pack (one base file per building, in a
// unified 130×126 canvas with a footprint-center anchor). The renderer scales
// each base to its on-screen footprint and pins animated layers on top — see
// render/views/buildingView.ts and render/buildingLayers.ts. Adding a building's
// art is dropping a *_base.svg in src/art/v2/pack/buildings and one line here.

import type { BuildingType } from '../config';
import type { Pt, VectorAsset } from './types';

import keep from './v2/pack/buildings/keep_base.svg?raw';
import tower from './v2/pack/buildings/tower_base.svg?raw';
import wall from './v2/pack/buildings/wall_base.svg?raw';
import house from './v2/pack/buildings/house_base.svg?raw';
import stockpile from './v2/pack/buildings/stockpile_base.svg?raw';
import granary from './v2/pack/buildings/granary_base.svg?raw';
import woodcutter from './v2/pack/buildings/woodcutter_base.svg?raw';
import appleOrchard from './v2/pack/buildings/apple_orchard_base.svg?raw';
import hunter from './v2/pack/buildings/hunter_base.svg?raw';
import fishery from './v2/pack/buildings/fishery_base.svg?raw';
import wheatFarm from './v2/pack/buildings/wheat_farm_base.svg?raw';
import mill from './v2/pack/buildings/mill_base.svg?raw';
import bakery from './v2/pack/buildings/bakery_base.svg?raw';
import market from './v2/pack/decor/market_base.svg?raw';
import campfire from './v2/pack/buildings/campfire_base.svg?raw';

const BASE_SVG: Record<BuildingType, string> = {
  keep, tower, wall, house, stockpile, granary, woodcutter,
  appleOrchard, hunter, fishery, wheatFarm, mill, bakery, market, campfire,
};

/** Pull width/height/data-anchor off an SVG root. anchor falls back to the
 *  canvas center-bottom if the file omits data-anchor. */
export function parseSvgAsset(id: BuildingType, raw: string): VectorAsset {
  const svg = raw.trim();
  const width = Number(/ width="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const height = Number(/ height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const a = /data-anchor="([\d.]+),([\d.]+)"/.exec(svg);
  const anchor: Pt = a ? { x: Number(a[1]), y: Number(a[2]) } : { x: width / 2, y: height };
  return { id, svg, width, height, anchor };
}

export function buildBuildingAssets(): Record<BuildingType, VectorAsset> {
  const out = {} as Record<BuildingType, VectorAsset>;
  for (const type of Object.keys(BASE_SVG) as BuildingType[]) {
    out[type] = parseSvgAsset(type, BASE_SVG[type]);
  }
  return out;
}
