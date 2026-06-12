// Flat-shaded unit figures: capsule body, round head, soft shadow — matching
// the clean isometric building style. Anchor is the point between the feet.

import type { UnitRole } from '../sim/world';
import { add, circle, line, pathFill, poly, shade, shadow, svgDoc } from './flat';
import type { Pt, VectorAsset } from './types';

const W = 34;
const H = 46;
const ANCHOR: Pt = { x: 17, y: 42 };
const SKIN = '#e8c9a0';

interface FigureSpec {
  body: string;
  props: () => string;
}

/** Rounded capsule torso from y=-4 (hips) to y=-15 (shoulders). */
function capsule(color: string): string {
  return (
    pathFill(
      'M -5.5,-4 L -5.5,-13 A 5.5 5 0 0 1 5.5,-13 L 5.5,-4 A 5.5 3.5 0 0 1 -5.5,-4 Z',
      color,
    ) +
    // subtle right-side shading to match building faces
    pathFill('M 1.5,-3.2 L 1.5,-17.5 A 5.5 5 0 0 1 5.5,-13 L 5.5,-4 A 5.5 3.5 0 0 1 1.5,-3.2 Z', shade(color, 0.82))
  );
}

const SPECS: Record<UnitRole, FigureSpec> = {
  peasant: {
    body: '#4a64a8',
    props: () => '',
  },
  archer: {
    body: '#b5413a',
    props: () => {
      const top: Pt = { x: 7, y: -23 };
      const bot: Pt = { x: 7, y: -5 };
      return (
        pathFill(
          `M ${top.x},${top.y} Q ${top.x + 6},${(top.y + bot.y) / 2} ${bot.x},${bot.y}` +
            ` Q ${top.x + 4.5},${(top.y + bot.y) / 2} ${top.x},${top.y} Z`,
          '#6b4a32',
        ) + line(top, bot, '#8a7458', 0.9, 0.8)
      );
    },
  },
  raider: {
    body: '#4f4a45',
    props: () => {
      const tipBase: Pt = { x: 7.5, y: -26 };
      return (
        line({ x: 7.5, y: -4 }, tipBase, '#9a9285', 1.6) +
        poly([add(tipBase, { x: 0, y: -6 }), add(tipBase, { x: -2.5, y: 0 }), add(tipBase, { x: 2.5, y: 0 })], '#707a85')
      );
    },
  },
};

export function buildUnitAssets(): Record<UnitRole, VectorAsset> {
  const out = {} as Record<UnitRole, VectorAsset>;
  for (const role of Object.keys(SPECS) as UnitRole[]) {
    const spec = SPECS[role];
    const body =
      shadow(0, 0, 8, 3.2) +
      capsule(spec.body) +
      circle(0, -18.5, 4.4, SKIN) +
      spec.props();
    out[role] = { id: role, svg: svgDoc(W, H, ANCHOR, body), width: W, height: H, anchor: ANCHOR };
  }
  return out;
}
