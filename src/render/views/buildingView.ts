// Building views are now sprites of the hand-drawn vector art. The anchor
// maps the SVG's footprint top corner onto tileToScreen(tile).

import { Container, Sprite } from 'pixi.js';
import { footprintDepth } from '../../sim/grid';
import type { Building } from '../../sim/world';
import { tileToScreen } from '../iso';
import type { ArtTextures } from '../assets';

export function createBuildingView(b: Building, art: ArtTextures): Container {
  const entry = art.get(b.type);
  const c = new Container();
  if (entry) {
    const sprite = new Sprite(entry.texture);
    sprite.position.set(-entry.anchor.x, -entry.anchor.y);
    c.addChild(sprite);
  }
  const p = tileToScreen(b.tile.x, b.tile.y);
  c.position.set(p.x, p.y);
  c.zIndex = footprintDepth(b.type, b.tile);
  return c;
}
