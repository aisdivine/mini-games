// Programmer-art units: a colored disc with a carried-resource chip.
// Redrawn only when visual state (role/carrying) changes, not per frame.

import { Container, Graphics } from 'pixi.js';
import type { Resource } from '../../config';
import type { Unit } from '../../sim/world';

const ROLE_COLORS: Record<Unit['role'], number> = {
  peasant: 0xe8d8b0,
  archer: 0x6fae6f,
  raider: 0xc94f4f,
};

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

export function createUnitView(unit: Unit): UnitView {
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);
  let lastKey = '';

  const view: UnitView = {
    container,
    refresh(u: Unit) {
      const key = `${u.role}:${u.carrying?.resource ?? '-'}`;
      if (key === lastKey) return;
      lastKey = key;
      g.clear();
      g.ellipse(0, 2, 8, 4).fill({ color: 0x000000, alpha: 0.25 }); // shadow
      g.circle(0, -7, 6).fill(ROLE_COLORS[u.role]).stroke({ width: 1, color: 0x222222 });
      if (u.role === 'archer') {
        g.moveTo(-5, -14).lineTo(5, -14).stroke({ width: 2, color: 0x2d4a2d }); // bow hint
      }
      if (u.carrying) {
        g.rect(-4, -20, 8, 6)
          .fill(RESOURCE_COLORS[u.carrying.resource])
          .stroke({ width: 1, color: 0x222222 });
      }
    },
  };
  view.refresh(unit);
  return view;
}
