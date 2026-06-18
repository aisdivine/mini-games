// Combat hit effects + the fallen-soldier sprite, rasterized once. Each spawns
// as a short-lived sprite at the hit point (see sceneSync.handleEvents).

import type { Texture } from 'pixi.js';
import { rasterizeSvg } from './assets';
import slash from '../art/v2/pack/effects/fx_slash.svg?raw';
import impact from '../art/v2/pack/effects/fx_impact.svg?raw';
import chargeDust from '../art/v2/pack/effects/fx_charge_dust.svg?raw';
import fallen from '../art/v2/pack/units/soldier_fallen.svg?raw';

export interface FxTex {
  texture: Texture;
  /** anchor as a fraction of the texture size, for Sprite.anchor.set */
  ax: number;
  ay: number;
}
export type CombatFx = Map<string, FxTex>;

function num(re: RegExp, svg: string, fb: number): number {
  return Number(re.exec(svg)?.[1] ?? fb);
}

async function build(svg: string): Promise<FxTex> {
  const s = svg.trim();
  const w = num(/ width="([\d.]+)"/, s, 32);
  const h = num(/ height="([\d.]+)"/, s, 32);
  const ax = num(/data-anchor="([\d.]+),/, s, w / 2);
  const ay = num(/data-anchor="[\d.]+,([\d.]+)"/, s, h / 2);
  return { texture: await rasterizeSvg(s), ax: ax / w, ay: ay / h };
}

export async function loadCombatFx(): Promise<CombatFx> {
  const defs: [string, string][] = [
    ['slash', slash],
    ['impact', impact],
    ['charge', chargeDust],
    ['fallen', fallen],
  ];
  const out: CombatFx = new Map();
  await Promise.all(defs.map(async ([k, svg]) => void out.set(k, await build(svg))));
  return out;
}
