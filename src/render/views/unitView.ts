// Unit views: hand-drawn figure sprite + a small carried-resource chip.
// Only the chip is redrawn, and only when the carried resource changes.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Resource } from '../../config';
import type { Unit } from '../../sim/world';
import type { ArtTextures } from '../assets';

export const RESOURCE_COLORS: Record<Resource, number> = {
  wood: 0x8b5a2b,
  wheat: 0xd9c34a,
  flour: 0xf0f0f0,
  bread: 0xc97b4a,
};

export interface UnitView {
  container: Container;
  refresh(unit: Unit): void;
}

export function createUnitView(unit: Unit, art: ArtTextures): UnitView {
  const container = new Container();
  const entry = art.get(unit.role);
  if (entry) {
    const sprite = new Sprite(entry.texture);
    sprite.position.set(-entry.anchor.x, -entry.anchor.y);
    container.addChild(sprite);
  }
  const chip = new Graphics();
  chip.visible = false;
  container.addChild(chip);

  let lastCarrying: Resource | null = null;
  const view: UnitView = {
    container,
    refresh(u: Unit) {
      const carrying = u.carrying?.resource ?? null;
      if (carrying === lastCarrying) return;
      lastCarrying = carrying;
      chip.clear();
      chip.visible = carrying !== null;
      if (carrying) {
        chip
          .rect(-4, -38, 8, 6)
          .fill(RESOURCE_COLORS[carrying])
          .stroke({ width: 1, color: 0x4a4035 });
      }
    },
  };
  view.refresh(unit);
  return view;
}
