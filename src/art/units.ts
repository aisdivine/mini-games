// Hand-drawn unit figures: little sketched villagers. Anchor is the point
// between the feet, so views can drop them straight onto a tile center.

import type { UnitRole } from '../sim/world';
import { INK, PAPER, Sketcher, svgDoc, type Pt } from './sketch';
import type { VectorAsset } from './types';

const W = 34;
const H = 44;
const ANCHOR: Pt = { x: 17, y: 40 };

interface FigureSpec {
  tunic: string;
  detail: (sk: Sketcher) => string;
}

const SPECS: Record<UnitRole, FigureSpec> = {
  peasant: {
    tunic: '#d9b988',
    detail: (sk) =>
      // hood
      sk.stroke([{ x: -4, y: -26 }, { x: 0, y: -29.5 }, { x: 4, y: -26 }], { width: 1.3 }) +
      // arms hanging
      sk.stroke([{ x: -4, y: -17 }, { x: -6.5, y: -10 }], { width: 1.5 }) +
      sk.stroke([{ x: 4, y: -17 }, { x: 6.5, y: -10 }], { width: 1.5 }),
  },
  archer: {
    tunic: '#7da06a',
    detail: (sk) =>
      // cap with feather
      sk.stroke([{ x: -4.5, y: -26 }, { x: 4.5, y: -26.5 }], { width: 1.6 }) +
      sk.stroke([{ x: 3, y: -27 }, { x: 7, y: -32 }], { width: 1.1, opacity: 0.7 }) +
      // bow arm + bow + string
      sk.stroke([{ x: 4, y: -17 }, { x: 8, y: -16 }], { width: 1.5 }) +
      sk.stroke([{ x: 8, y: -25 }, { x: 11.5, y: -16 }, { x: 8, y: -7 }], { width: 1.6 }) +
      sk.stroke([{ x: 8, y: -25 }, { x: 8, y: -7 }], { width: 0.8, opacity: 0.5 }) +
      sk.stroke([{ x: -4, y: -17 }, { x: -6, y: -10 }], { width: 1.5 }),
  },
  raider: {
    tunic: '#b85549',
    detail: (sk) =>
      // horned helmet
      sk.stroke([{ x: -4, y: -26 }, { x: -7, y: -30 }], { width: 1.4 }) +
      sk.stroke([{ x: 4, y: -26 }, { x: 7, y: -30 }], { width: 1.4 }) +
      // sword arm raised
      sk.stroke([{ x: 4, y: -17 }, { x: 7, y: -13 }], { width: 1.5 }) +
      sk.stroke([{ x: 7, y: -13 }, { x: 13, y: -26 }], { width: 1.8 }) +
      sk.stroke([{ x: 7.5, y: -20 }, { x: 11.5, y: -18 }], { width: 1.2 }) +
      // round shield
      sk.circle(-7.5, -14, 4.2, { fill: '#8a7f6e', fillOpacity: 0.5, width: 1.3 }),
  },
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export function buildUnitAssets(): Record<UnitRole, VectorAsset> {
  const out = {} as Record<UnitRole, VectorAsset>;
  for (const role of Object.keys(SPECS) as UnitRole[]) {
    const spec = SPECS[role];
    const sk = new Sketcher(hashSeed(role));
    const body =
      // soft scribbled shadow
      sk.ellipse(0, 0.5, 8.5, 3.2, { fill: '#3a3324', fillOpacity: 0.18, opacity: 0 }) +
      // legs
      sk.stroke([{ x: -3, y: 0 }, { x: -2, y: -8.5 }], { width: 1.6 }) +
      sk.stroke([{ x: 3, y: 0 }, { x: 2, y: -8.5 }], { width: 1.6 }) +
      // tunic
      sk.shape(
        [{ x: -5, y: -8 }, { x: 5, y: -8 }, { x: 4, y: -19 }, { x: -4, y: -19 }],
        { fill: spec.tunic, fillOpacity: 0.6, width: 1.4, base: PAPER },
      ) +
      // head
      sk.circle(0, -23, 4.6, { fill: '#e8cfae', fillOpacity: 0.65, width: 1.4, color: INK, base: PAPER }) +
      spec.detail(sk);
    out[role] = { id: role, svg: svgDoc(W, H, ANCHOR, body), width: W, height: H, anchor: ANCHOR };
  }
  return out;
}
