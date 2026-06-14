// Unit views are drawn per-unit as Graphics (not shared textures) so each
// villager can have their own skin tone (from their id) and a tunic colored
// by their current job — so you can read what everyone's doing at a glance.

import { Container, Graphics } from 'pixi.js';
import type { BuildingType, Resource } from '../../config';
import type { Unit, UnitRole } from '../../sim/world';

export const RESOURCE_COLORS: Record<Resource, number> = {
  wood: 0x8b5a2b,
  wheat: 0xd9c34a,
  flour: 0xf0f0f0,
  bread: 0xc97b4a,
  apples: 0xd0432f,
  meat: 0x9c4a3a,
};

// Skin tones, picked per villager from their id.
const SKIN_TONES = [0xf3d6b3, 0xe6b98c, 0xc68a52, 0xa1683a, 0x6f4520];

// Tunic color per job, so a glance tells you who's doing what.
const IDLE_TUNIC = 0x4a64a8; // unemployed peasant — slate blue
const JOB_TUNIC: Partial<Record<BuildingType, number>> = {
  woodcutter: 0x7a4a23, // lumber brown
  appleOrchard: 0x3f9a3f, // orchard green
  hunter: 0x5f6b2e, // hunter olive
  wheatFarm: 0xcf9a1e, // wheat gold
  mill: 0xb9b3c4, // flour pale
  bakery: 0xd8763a, // baker orange
  granary: 0xc9a24e, // granary keeper
};

export function tunicColorFor(role: UnitRole, jobType: BuildingType | null): number {
  if (role === 'archer') return 0xb5413a;
  if (role === 'raider') return 0x4f4a45;
  if (!jobType) return IDLE_TUNIC;
  return JOB_TUNIC[jobType] ?? IDLE_TUNIC;
}

function darken(hex: number, f: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * f);
  const g = Math.round(((hex >> 8) & 0xff) * f);
  const b = Math.round((hex & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

export interface UnitView {
  container: Container;
  refresh(unit: Unit, tunic: number): void;
}

export function createUnitView(unit: Unit): UnitView {
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);
  const skin = SKIN_TONES[unit.id % SKIN_TONES.length];

  let sig = '';
  const view: UnitView = {
    container,
    refresh(u: Unit, tunic: number) {
      const carrying = u.carrying?.resource ?? null;
      const next = `${tunic}:${carrying}`;
      if (next === sig) return; // only redraw when appearance changes
      sig = next;
      drawFigure(g, u.role, tunic, skin, carrying);
    },
  };
  return view;
}

function drawFigure(
  g: Graphics,
  role: UnitRole,
  tunic: number,
  skin: number,
  carrying: Resource | null,
): void {
  g.clear();
  // ground shadow
  g.ellipse(0, 0, 8, 3).fill({ color: 0x000000, alpha: 0.16 });
  // body (capsule), with a subtle shaded side for form
  g.roundRect(-5, -15, 10, 14, 5).fill(tunic);
  g.roundRect(0.8, -15, 4.2, 14, 4).fill({ color: darken(tunic, 0.8), alpha: 0.55 });
  // head
  g.circle(0, -18.5, 4.3).fill(skin).stroke({ width: 1, color: 0x3a3020, alpha: 0.4 });

  if (role === 'archer') {
    g.moveTo(7, -22).quadraticCurveTo(12, -11, 7, -2).stroke({ width: 1.5, color: 0x6b4a32 });
    g.moveTo(7, -22).lineTo(7, -2).stroke({ width: 0.8, color: 0x8a7458, alpha: 0.8 });
  } else if (role === 'raider') {
    g.moveTo(7.5, -2).lineTo(7.5, -26).stroke({ width: 1.6, color: 0x9a9285 });
    g.poly([7.5, -32, 5, -26, 10, -26]).fill(0x707a85);
  }

  if (carrying) {
    g.rect(-4, -31, 8, 6).fill(RESOURCE_COLORS[carrying]).stroke({ width: 1, color: 0x4a4035 });
  }
}
