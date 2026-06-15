// A building view is the SVG base sprite scaled to its on-screen footprint
// (the pack draws every footprint into a ~60px base diamond, so we scale by
// (w+h)*16 / 30), placed with its footprint-center anchor on the tile center.
// An optional animated layer (flag, sails, smoke, saw, stalks, flame) is pinned
// on top about its pivot and driven each frame by animateBuilding().

import { Container, Sprite } from 'pixi.js';
import { BUILDINGS, type BuildingType } from '../../config';
import { footprintDepth } from '../../sim/grid';
import type { Building } from '../../sim/world';
import type { Pt } from '../../art/types';
import { tileToScreen } from '../iso';
import type { ArtTextures } from '../assets';
import type { BuildingLayers, LayerMotion } from '../buildingLayers';

// Half-width of the base diamond the pack draws each footprint into (px).
const ART_BASE_HALF = 30;

interface LayerView {
  pivotC: Container; // origin sits on the layer's pivot, so transforms rotate about it
  home: Pt; // pivotC resting position in building-container local space
  motion: LayerMotion;
  activeOnly: boolean;
}

export interface BuildingView {
  container: Container;
  type: BuildingType;
  layers: LayerView[];
}

export function buildingScale(type: BuildingType): number {
  const { w, h } = BUILDINGS[type].size;
  return ((w + h) * 16) / ART_BASE_HALF;
}

export function createBuildingView(
  b: Building,
  art: ArtTextures,
  layers: BuildingLayers,
): BuildingView {
  const def = BUILDINGS[b.type];
  const container = new Container();
  container.scale.set(buildingScale(b.type));

  const base = art.get(b.type);
  const anchor = base?.anchor ?? { x: 65, y: 92 };
  if (base) {
    const sprite = new Sprite(base.texture);
    sprite.position.set(-anchor.x, -anchor.y);
    container.addChild(sprite);
  }

  const layerViews: LayerView[] = [];
  for (const ld of layers.get(b.type) ?? []) {
    const sprite = new Sprite(ld.texture);
    sprite.position.set(-ld.pivot.x, -ld.pivot.y); // pivot pixel at pivotC origin
    const pivotC = new Container();
    pivotC.addChild(sprite);
    // layer shares the base anchor, so its pivot's local position is pivot-anchor
    const home = { x: ld.pivot.x - ld.anchor.x, y: ld.pivot.y - ld.anchor.y };
    pivotC.position.set(home.x, home.y);
    container.addChild(pivotC);
    layerViews.push({ pivotC, home, motion: ld.motion, activeOnly: ld.activeOnly });
  }

  const p = tileToScreen(b.tile.x + def.size.w / 2, b.tile.y + def.size.h / 2);
  container.position.set(p.x, p.y);
  container.zIndex = footprintDepth(b.type, b.tile);
  return { container, type: b.type, layers: layerViews };
}

/** Drive the building's animated overlays from the render clock + sim state.
 *  `night` (0..1) drives window glow. */
export function animateBuilding(view: BuildingView, b: Building, clock: number, night: number): void {
  for (const L of view.layers) animateLayer(L, b, clock, night);
}

function animateLayer(L: LayerView, b: Building, clock: number, night: number): void {
  const c = L.pivotC;
  const producing = b.state.kind === 'producing';
  const active = producing || b.state.kind === 'delivering';
  const phase = b.id * 1.7;

  // reset the bits each motion doesn't own so transforms don't accumulate
  c.position.set(L.home.x, L.home.y);
  c.skew.x = 0;
  c.scale.set(1, 1);
  c.alpha = 1;

  switch (L.motion) {
    case 'glow':
      c.alpha = night;
      break;
    case 'flag':
      c.skew.x = Math.sin(clock * 0.004 + phase) * 0.2;
      break;
    case 'sails':
      c.rotation = clock * (active ? 0.005 : 0.0012);
      break;
    case 'stalks':
      c.skew.x = Math.sin(clock * 0.0026 + phase) * (active ? 0.13 : 0.07);
      break;
    case 'awning':
      c.skew.x = Math.sin(clock * 0.003 + phase) * 0.05; // gentle cloth flutter
      break;
    case 'flame': {
      const s = 1 + Math.sin(clock * 0.02 + phase) * 0.12 + Math.sin(clock * 0.05) * 0.06;
      c.scale.set(1 + (s - 1) * 0.4, s);
      break;
    }
    case 'saw':
      if (!active) { c.alpha = 0; break; }
      c.position.x = L.home.x + Math.sin(clock * 0.02 + phase) * 2;
      break;
    case 'smoke': {
      const intensity = L.activeOnly ? (producing ? 0.9 : 0.12) : 0.45;
      const t = (clock * 0.0006 + (phase % 1)) % 1;
      c.position.set(L.home.x + Math.sin(t * 6 + phase) * 2, L.home.y - t * 18);
      c.alpha = (1 - t) * intensity;
      break;
    }
  }
}
