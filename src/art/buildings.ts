// Hand-drawn building art. Each building is sketched in "anchor space" —
// the footprint's top (north) corner at ground level is (0,0) — using the
// shared iso-box geometry, then wrapped into a standalone SVG.

import { BUILDINGS, type BuildingDef, type BuildingType } from '../config';
import { add, INK, INK_LIGHT, lerp, PAPER, Sketcher, svgDoc, type Pt } from './sketch';
import type { VectorAsset } from './types';

const PAD = 8;

/** Footprint corners at ground level + the extrusion vector. */
interface BoxGeo {
  T: Pt; // north corner (the anchor)
  R: Pt; // east
  B: Pt; // south
  L: Pt; // west
  up: Pt; // (0, -height)
}

function geoFor(def: BuildingDef): BoxGeo {
  const { w, h } = def.size;
  return {
    T: { x: 0, y: 0 },
    R: { x: w * 32, y: w * 16 },
    B: { x: (w - h) * 32, y: (w + h) * 16 },
    L: { x: -h * 32, y: h * 16 },
    up: { x: 0, y: -def.height },
  };
}

/** The basic sketched iso box: washed faces, hatched shading, inked edges. */
function isoBox(sk: Sketcher, g: BoxGeo, wash: string): string {
  const Tu = add(g.T, g.up);
  const Ru = add(g.R, g.up);
  const Bu = add(g.B, g.up);
  const Lu = add(g.L, g.up);
  return (
    sk.shape([g.L, g.B, Bu, Lu], { fill: wash, fillOpacity: 0.38, base: PAPER }) +
    sk.hatchQuad(g.L, g.B, Bu, Lu, 3) +
    sk.shape([g.B, g.R, Ru, Bu], { fill: wash, fillOpacity: 0.28, base: PAPER }) +
    sk.hatchQuad(g.B, g.R, Ru, Bu, 5, { opacity: 0.3 }) +
    sk.shape([Tu, Ru, Bu, Lu], { fill: wash, fillOpacity: 0.5, base: PAPER })
  );
}

function crenellations(sk: Sketcher, g: BoxGeo, perEdge: number, toothH: number): string {
  const Lu = add(g.L, g.up);
  const Bu = add(g.B, g.up);
  const Ru = add(g.R, g.up);
  let out = '';
  for (const [e0, e1] of [[Lu, Bu], [Bu, Ru]] as const) {
    for (let i = 0; i < perEdge; i++) {
      const a = lerp(e0, e1, (i + 0.2) / perEdge);
      const b = lerp(e0, e1, (i + 0.75) / perEdge);
      out += sk.stroke([a, add(a, { x: 0, y: -toothH }), add(b, { x: 0, y: -toothH }), b], {
        width: 1.2,
      });
    }
  }
  return out;
}

function door(sk: Sketcher, g: BoxGeo, height: number): string {
  const d0 = lerp(g.B, g.R, 0.38);
  const d1 = lerp(g.B, g.R, 0.62);
  const mid = lerp(d0, d1, 0.5);
  return sk.shape(
    [d0, add(d0, { x: 0, y: -height }), add(mid, { x: 0, y: -height - 4 }), add(d1, { x: 0, y: -height }), d1],
    { fill: INK, fillOpacity: 0.45, width: 1.2 },
  );
}

/** A small iso cube doodle (crates, sacks) centered on ground point c. */
function miniBox(sk: Sketcher, c: Pt, hw: number, ht: number, wash: string): string {
  const g: BoxGeo = {
    T: { x: c.x, y: c.y - hw / 2 },
    R: { x: c.x + hw, y: c.y },
    B: { x: c.x, y: c.y + hw / 2 },
    L: { x: c.x - hw, y: c.y },
    up: { x: 0, y: -ht },
  };
  return isoBox(sk, g, wash);
}

interface ArtSpec {
  wash: string;
  topMargin: number; // extra canvas above the box (flags, smoke, blades)
  detail?: (sk: Sketcher, g: BoxGeo, def: BuildingDef) => string;
  /** Fully custom body (flat structures); replaces the iso box. */
  custom?: (sk: Sketcher, g: BoxGeo, def: BuildingDef) => string;
}

const SPECS: Record<BuildingType, ArtSpec> = {
  keep: {
    wash: '#9b94ad',
    topMargin: 26,
    detail: (sk, g) => {
      const Tu = add(g.T, g.up);
      const poleTop = add(Tu, { x: 0, y: -18 });
      return (
        crenellations(sk, g, 3, 5) +
        door(sk, g, 14) +
        sk.stroke([Tu, poleTop], { width: 1.2 }) +
        sk.shape([poleTop, add(poleTop, { x: 15, y: 4 }), add(poleTop, { x: 0, y: 8 })], {
          fill: '#c25548',
          fillOpacity: 0.6,
          width: 1.1,
        })
      );
    },
  },
  tower: {
    wash: '#8d8a96',
    topMargin: 10,
    detail: (sk, g) =>
      crenellations(sk, g, 2, 5) + sk.hatchQuad(g.B, g.R, add(g.R, g.up), add(g.B, g.up), 2, { opacity: 0.15 }),
  },
  wall: {
    wash: '#9a958f',
    topMargin: 6,
    detail: (sk, g) => {
      // brick courses on both visible faces
      let out = '';
      for (const [a, b, c, d] of [
        [g.L, g.B, add(g.B, g.up), add(g.L, g.up)],
        [g.B, g.R, add(g.R, g.up), add(g.B, g.up)],
      ] as const) {
        out += sk.hatchQuad(d, a, b, c, 2, { opacity: 0.35, width: 1 });
        out += sk.stroke([lerp(lerp(a, d, 0.4), lerp(b, c, 0.4), 0.3), lerp(lerp(a, d, 0.4), lerp(b, c, 0.4), 0.45)], { opacity: 0.4, width: 1 });
      }
      return out;
    },
  },
  house: {
    wash: '#c08a5e',
    topMargin: 18,
    detail: (sk, g) => {
      const Tu = add(g.T, g.up);
      const Ru = add(g.R, g.up);
      const Bu = add(g.B, g.up);
      const Lu = add(g.L, g.up);
      // pitched roof: ridge raised above the top face, two visible planes
      const ridgeA = add(lerp(Tu, Lu, 0.5), { x: 0, y: -13 });
      const ridgeB = add(lerp(Ru, Bu, 0.5), { x: 0, y: -13 });
      const winC = lerp(lerp(g.L, Lu, 0.55), lerp(g.B, Bu, 0.55), 0.5);
      return (
        sk.shape([Tu, Ru, ridgeB, ridgeA], { fill: '#a8623e', fillOpacity: 0.5, base: PAPER }) +
        sk.shape([ridgeA, ridgeB, Bu, Lu], { fill: '#a8623e', fillOpacity: 0.65, base: PAPER }) +
        sk.hatchQuad(ridgeA, ridgeB, Bu, Lu, 3, { opacity: 0.25 }) +
        door(sk, g, 11) +
        sk.shape(
          [add(winC, { x: -3, y: -3 }), add(winC, { x: 3, y: -1.5 }), add(winC, { x: 3, y: 4 }), add(winC, { x: -3, y: 2.5 })],
          { fill: INK, fillOpacity: 0.35, width: 1 },
        )
      );
    },
  },
  granary: {
    wash: '#d4b35e',
    topMargin: 8,
    detail: (sk, g) => {
      // plump grain sacks stacked beside the door
      const s1 = add(lerp(g.B, g.R, 0.16), { x: 0, y: -4 });
      const s2 = add(lerp(g.B, g.R, 0.82), { x: 0, y: -4 });
      const sack = (c: { x: number; y: number }, r: number) =>
        sk.circle(c.x, c.y, r, { fill: '#d9c37e', fillOpacity: 0.75, width: 1.3 }) +
        sk.stroke([add(c, { x: -2, y: -r }), add(c, { x: 2, y: -r - 3 })], { width: 1.1, opacity: 0.7 });
      return door(sk, g, 12) + sack(s1, 5) + sack(s2, 4.5);
    },
  },
  woodcutter: {
    wash: '#8a6a40',
    topMargin: 8,
    detail: (sk, g) => {
      const top = lerp(add(g.T, g.up), add(g.B, g.up), 0.5);
      const logBase = lerp(g.B, g.R, 0.75);
      return (
        // axe across the roof: handle + head
        sk.stroke([add(top, { x: -10, y: 4 }), add(top, { x: 10, y: -4 })], { width: 1.6 }) +
        sk.shape(
          [add(top, { x: 10, y: -4 }), add(top, { x: 15, y: -8 }), add(top, { x: 14, y: -1 })],
          { fill: INK, fillOpacity: 0.5, width: 1.1 },
        ) +
        // log ends stacked by the door
        sk.circle(logBase.x - 4, logBase.y - 4, 3.4, { fill: '#b08a5a', fillOpacity: 0.6, width: 1 }) +
        sk.circle(logBase.x + 3, logBase.y - 2, 3.4, { fill: '#b08a5a', fillOpacity: 0.6, width: 1 })
      );
    },
  },
  mill: {
    wash: '#b9b9c9',
    topMargin: 16,
    detail: (sk, g) => {
      // windmill cross mounted on the front corner, sails as washed quads
      const hub = add(add(g.B, g.up), { x: 0, y: -2 });
      let out = '';
      for (const ang of [0.5, 0.5 + Math.PI / 2, 0.5 + Math.PI, 0.5 + (3 * Math.PI) / 2]) {
        const dir = { x: Math.cos(ang), y: Math.sin(ang) * 0.7 };
        const perp = { x: -Math.sin(ang) * 0.45, y: Math.cos(ang) * 0.32 };
        const inner = add(hub, { x: dir.x * 7, y: dir.y * 7 });
        const tip = add(hub, { x: dir.x * 30, y: dir.y * 30 });
        out += sk.stroke([hub, tip], { width: 1.7 });
        out += sk.shape(
          [inner, tip, add(tip, { x: perp.x * 16, y: perp.y * 16 }), add(inner, { x: perp.x * 16, y: perp.y * 16 })],
          { fill: '#ece6d4', fillOpacity: 0.7, width: 1.1 },
        );
      }
      out += sk.circle(hub.x, hub.y, 3, { fill: INK, fillOpacity: 0.7, width: 1.1 });
      return out;
    },
  },
  bakery: {
    wash: '#cd8a5a',
    topMargin: 36,
    detail: (sk, g) => {
      // solid brick chimney on the roof + a curl of smoke
      const c = lerp(add(g.T, g.up), add(g.B, g.up), 0.32);
      const chimney =
        sk.shape(
          [add(c, { x: -4, y: 2 }), add(c, { x: 5, y: 6 }), add(c, { x: 5, y: -12 }), add(c, { x: -4, y: -15 })],
          { fill: '#9a6248', fillOpacity: 0.7, width: 1.4 },
        ) +
        sk.stroke([add(c, { x: -4, y: -10 }), add(c, { x: 5, y: -7 })], { width: 1, opacity: 0.4 });
      const sTop = add(c, { x: 0, y: -16 });
      const smoke =
        sk.stroke(
          [sTop, add(sTop, { x: 5, y: -7 }), add(sTop, { x: -3, y: -13 }), add(sTop, { x: 5, y: -19 })],
          { color: INK_LIGHT, width: 2, opacity: 0.55 },
        ) +
        sk.circle(sTop.x + 4, sTop.y - 22, 3.4, { fill: '#cfc8b6', fillOpacity: 0.5, color: INK_LIGHT, width: 1, opacity: 0.5 });
      return chimney + smoke + door(sk, g, 12);
    },
  },
  campfire: {
    wash: '#d96f32',
    topMargin: 16,
    custom: (sk) => {
      const c = { x: 0, y: 16 };
      let out = '';
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + 0.4;
        out += sk.circle(c.x + Math.cos(ang) * 13, c.y + Math.sin(ang) * 6.5, 2.6, {
          fill: '#b5ac9d',
          fillOpacity: 0.5,
          width: 1,
        });
      }
      out += sk.stroke([add(c, { x: -8, y: 3 }), add(c, { x: 8, y: -4 })], { color: '#7a5a36', width: 2.6 });
      out += sk.stroke([add(c, { x: -8, y: -4 }), add(c, { x: 8, y: 3 })], { color: '#7a5a36', width: 2.6 });
      out += sk.shape(
        [add(c, { x: -5, y: -2 }), add(c, { x: -2, y: -10 }), add(c, { x: 0, y: -16 }), add(c, { x: 3, y: -9 }), add(c, { x: 5, y: -2 })],
        { fill: '#e8923e', fillOpacity: 0.65, color: '#c96f2e', width: 1.2 },
      );
      out += sk.shape(
        [add(c, { x: -2, y: -2 }), add(c, { x: 0, y: -8 }), add(c, { x: 2, y: -2 })],
        { fill: '#f3c24e', fillOpacity: 0.75, color: '#d9963a', width: 1 },
      );
      return out;
    },
  },
  stockpile: {
    wash: '#cbb98a',
    topMargin: 14,
    custom: (sk, g) => {
      return (
        sk.shape([g.T, g.R, g.B, g.L], { fill: '#cbb98a', fillOpacity: 0.35, base: PAPER }) +
        sk.hatchQuad(g.T, g.L, g.B, g.R, 4, { opacity: 0.25 }) +
        miniBox(sk, { x: -16, y: 40 }, 9, 8, '#a98f5e') +
        miniBox(sk, { x: 24, y: 52 }, 8, 7, '#a98f5e')
      );
    },
  },
  wheatFarm: {
    wash: '#e0cd72',
    topMargin: 12,
    custom: (sk, g, def) => {
      let out =
        sk.shape([g.T, g.R, g.B, g.L], { fill: '#e0cd72', fillOpacity: 0.4, base: PAPER }) +
        sk.hatchQuad(g.T, g.L, g.B, g.R, 4, { opacity: 0.18, color: '#8a7a2e' });
      for (let dx = 0; dx < def.size.w; dx++) {
        for (let dy = 0; dy < def.size.h; dy++) {
          for (let s = 0; s < 2; s++) {
            const base = { x: (dx - dy) * 32 + sk.j(9), y: (dx + dy) * 16 + 16 + sk.j(5) };
            const top = add(base, { x: 0, y: -8 });
            out +=
              sk.stroke([base, top], { color: '#8a7a2e', width: 1.2, opacity: 0.8 }) +
              sk.stroke([top, add(top, { x: -3, y: -3 })], { color: '#8a7a2e', width: 1, opacity: 0.7 }) +
              sk.stroke([top, add(top, { x: 3, y: -3 })], { color: '#8a7a2e', width: 1, opacity: 0.7 });
          }
        }
      }
      return out;
    },
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

export function buildBuildingAssets(): Record<BuildingType, VectorAsset> {
  const out = {} as Record<BuildingType, VectorAsset>;
  for (const type of Object.keys(SPECS) as BuildingType[]) {
    const def = BUILDINGS[type];
    const spec = SPECS[type];
    const sk = new Sketcher(hashSeed(type));
    const g = geoFor(def);
    const body = spec.custom
      ? spec.custom(sk, g, def)
      : isoBox(sk, g, spec.wash) + (spec.detail?.(sk, g, def) ?? '');
    const { w, h } = def.size;
    const boxH = spec.custom ? 0 : def.height;
    const width = (w + h) * 32 + PAD * 2;
    const height = boxH + spec.topMargin + (w + h) * 16 + PAD * 2;
    const anchor = { x: h * 32 + PAD, y: boxH + spec.topMargin + PAD };
    out[type] = { id: type, svg: svgDoc(width, height, anchor, body), width, height, anchor };
  }
  return out;
}
