// Unit views are sprites of the v2 art, picked per villager by skin tone
// (from the unit id) and tunic color (from the current job), plus a small
// carried-resource chip drawn on top.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Resource } from '../../config';
import type { Unit } from '../../sim/world';
import { SKIN_TONES, type UnitTextures } from '../unitTextures';

export { tunicColorFor } from '../unitTextures';

export const RESOURCE_COLORS: Record<Resource, number> = {
  wood: 0x8b5a2b,
  wheat: 0xd9c34a,
  flour: 0xf0f0f0,
  stone: 0x9a958c,
  bread: 0xc97b4a,
  apples: 0xd0432f,
  meat: 0x9c4a3a,
  fish: 0x6fb7d6,
};

export interface UnitView {
  container: Container;
  refresh(unit: Unit, tunic: number): void;
}

export function createUnitView(unit: Unit, tex: UnitTextures): UnitView {
  const container = new Container();
  const skinIndex = unit.id % SKIN_TONES.length;
  const sprite = new Sprite();
  sprite.anchor.set(tex.anchor.x / 34, tex.anchor.y / 46); // anchor at the feet
  container.addChild(sprite);
  const chip = new Graphics();
  chip.visible = false;
  container.addChild(chip);

  let texKey = '';
  let lastCarrying: Resource | null | undefined;
  const view: UnitView = {
    container,
    refresh(u: Unit, tunic: number) {
      const k = tex.key(u.role, skinIndex, tunic);
      if (k !== texKey) {
        texKey = k;
        sprite.texture = tex.get(u.role, skinIndex, tunic);
      }
      const carrying = u.carrying?.resource ?? null;
      if (carrying !== lastCarrying) {
        lastCarrying = carrying;
        chip.clear();
        chip.visible = carrying !== null;
        if (carrying) {
          chip
            .rect(-5, -54, 10, 7)
            .fill(RESOURCE_COLORS[carrying])
            .stroke({ width: 1, color: 0x3a2a19 });
        }
      }
    },
  };
  return view;
}
