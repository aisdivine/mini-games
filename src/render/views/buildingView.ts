// A building view is the baked art sprite (the body) plus an `anim` Graphics
// overlay that sceneSync redraws each frame for living detail (turning mill
// sails, chimney smoke, waving flags, flickering fire...). Container origin is
// the footprint's top corner at ground level, so anim coords share the same
// space as the art's flat.ts geometry.

import { Container, Graphics, Sprite } from 'pixi.js';
import { footprintDepth } from '../../sim/grid';
import type { BuildingType } from '../../config';
import type { Building } from '../../sim/world';
import { tileToScreen } from '../iso';
import type { ArtTextures } from '../assets';

export interface BuildingView {
  container: Container;
  anim: Graphics;
  type: BuildingType;
}

export function createBuildingView(b: Building, art: ArtTextures): BuildingView {
  const entry = art.get(b.type);
  const container = new Container();
  if (entry) {
    const sprite = new Sprite(entry.texture);
    sprite.position.set(-entry.anchor.x, -entry.anchor.y);
    container.addChild(sprite);
  }
  const anim = new Graphics();
  container.addChild(anim); // drawn above the body
  const p = tileToScreen(b.tile.x, b.tile.y);
  container.position.set(p.x, p.y);
  container.zIndex = footprintDepth(b.type, b.tile);
  return { container, anim, type: b.type };
}
