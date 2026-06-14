// Flat-shaded isometric building art (clean vector style: solid fills, no
// outlines, soft ground shadows). Each building is one spec entry; the
// shared primitives in flat.ts do the shading.

import { BUILDINGS, type BuildingDef, type BuildingType } from '../config';
import {
  add,
  boxGeo,
  circle,
  crenEdge,
  cube,
  cylinder,
  isoBox,
  lerp,
  line,
  pathFill,
  poly,
  shade,
  shadow,
  svgDoc,
  type BoxGeo,
} from './flat';
import type { Pt, VectorAsset } from './types';

const PAD = 10;
const STONE = '#b6b0a0';
const DOOR = '#5f5a50';

function groundShadow(g: BoxGeo, def: BuildingDef): string {
  const c = lerp(g.T, g.B, 0.5);
  const r = (def.size.w + def.size.h) * 17;
  return shadow(c.x, c.y, r, r * 0.55);
}

function archDoor(g: BoxGeo, hh: number): string {
  const d0 = lerp(g.B, g.R, 0.4);
  const d1 = lerp(g.B, g.R, 0.6);
  const mid = lerp(d0, d1, 0.5);
  const fmt = (p: Pt) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  return pathFill(
    `M ${fmt(d0)} L ${fmt(add(d0, { x: 0, y: -hh }))}` +
      ` Q ${fmt(add(mid, { x: 0, y: -hh - 8 }))} ${fmt(add(d1, { x: 0, y: -hh }))}` +
      ` L ${fmt(d1)} Z`,
    DOOR,
  );
}

/** Vertical window slit on a face: position by edge fraction t, height v. */
function slit(p0: Pt, p1: Pt, up: Pt, t: number, v: number): string {
  const base = lerp(p0, p1, t);
  const at = add(base, { x: up.x * v, y: up.y * v });
  return line(at, add(at, { x: 0, y: -7 }), DOOR, 3.5);
}

interface ArtSpec {
  base: string;
  topMargin: number;
  flat?: boolean; // no extruded box; custom draws everything
  detail?: (g: BoxGeo, def: BuildingDef) => string;
  custom?: (g: BoxGeo, def: BuildingDef) => string;
}

const SPECS: Record<BuildingType, ArtSpec> = {
  keep: {
    base: STONE,
    topMargin: 40,
    detail: (g) => {
      const Tu = add(g.T, g.up);
      const Ru = add(g.R, g.up);
      const Bu = add(g.B, g.up);
      const Lu = add(g.L, g.up);
      const cren = shade(STONE, 0.85);
      return (
        crenEdge(Lu, Tu, 3, cren) +
        crenEdge(Tu, Ru, 3, cren) +
        crenEdge(Lu, Bu, 3, cren) +
        crenEdge(Bu, Ru, 3, cren) +
        slit(g.B, g.R, { x: 0, y: -1 }, 0.78, 38) +
        slit(g.L, g.B, { x: 0, y: -1 }, 0.5, 40) +
        archDoor(g, 16) // flag is drawn (waving) by buildingAnim
      );
    },
  },
  tower: {
    base: STONE,
    topMargin: 48,
    flat: true,
    custom: (g, def) => {
      const c = lerp(g.T, g.B, 0.5);
      const r = 28;
      const h = 64;
      const topCy = c.y + 6 - h;
      let out = groundShadow(g, def) + cylinder(c.x, c.y + 6, r, h, STONE);
      // crenellation ring around the rim, back-to-front
      const rim: Pt[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        rim.push({ x: c.x + Math.cos(a) * r * 0.88, y: topCy + Math.sin(a) * r * 0.44 });
      }
      rim.sort((a, b) => a.y - b.y);
      for (const p of rim) out += cube(p, 5, 6, shade(STONE, 0.85));
      out += slit({ x: c.x, y: c.y + 6 }, { x: c.x, y: c.y + 6 }, { x: 0, y: -1 }, 0, 34);
      return out; // flag is drawn (waving) by buildingAnim
    },
  },
  wall: {
    base: STONE,
    topMargin: 10,
    detail: (g) => {
      const Lu = add(g.L, g.up);
      const Bu = add(g.B, g.up);
      const Ru = add(g.R, g.up);
      return crenEdge(Lu, Bu, 1, shade(STONE, 0.85), 5.5, 6) + crenEdge(Bu, Ru, 1, shade(STONE, 0.85), 5.5, 6);
    },
  },
  house: {
    base: '#d8cdaa',
    topMargin: 18,
    detail: (g) => {
      const Tu = add(g.T, g.up);
      const Ru = add(g.R, g.up);
      const Bu = add(g.B, g.up);
      const Lu = add(g.L, g.up);
      const ridgeA = add(lerp(Tu, Lu, 0.5), { x: 0, y: -14 });
      const ridgeB = add(lerp(Ru, Bu, 0.5), { x: 0, y: -14 });
      return (
        poly([Tu, Ru, ridgeB, ridgeA], shade('#b5654a', 1.05)) +
        poly([ridgeA, ridgeB, Bu, Lu], shade('#b5654a', 0.8)) +
        archDoor(g, 12) +
        slit(g.L, g.B, { x: 0, y: -1 }, 0.5, 16)
      );
    },
  },
  granary: {
    base: '#cdb878',
    topMargin: 8,
    detail: (g) => {
      const s1 = add(lerp(g.B, g.R, 0.16), { x: 0, y: -2 });
      const s2 = add(lerp(g.B, g.R, 0.84), { x: 0, y: -2 });
      const sack = (c: Pt, r: number) =>
        circle(c.x, c.y - r * 0.7, r, '#d9b86a') + circle(c.x, c.y - r * 1.7, r * 0.55, '#cfa95a');
      return archDoor(g, 13) + sack(s1, 5.5) + sack(s2, 5);
    },
  },
  woodcutter: {
    base: '#9c7a4e',
    topMargin: 8,
    detail: (g) => {
      const at = add(lerp(g.B, g.R, 0.8), { x: 0, y: -2 });
      const log = (c: Pt, r: number) => circle(c.x, c.y, r, '#8a6238') + circle(c.x, c.y, r * 0.55, '#c79a66');
      return archDoor(g, 12) + log(add(at, { x: -5, y: 0 }), 4) + log(add(at, { x: 4, y: 1 }), 4) + log(add(at, { x: 0, y: -6 }), 4);
    },
  },
  appleOrchard: {
    base: '#6fae5c',
    topMargin: 18,
    flat: true,
    custom: (g) => {
      let out = poly([g.T, g.R, g.B, g.L], '#6fae5c');
      for (let i = 0; i < 3; i++) {
        const t0 = (i + 0.3) / 3;
        const t1 = (i + 0.55) / 3;
        out += poly(
          [lerp(g.T, g.L, t0), lerp(g.R, g.B, t0), lerp(g.R, g.B, t1), lerp(g.T, g.L, t1)],
          shade('#6fae5c', 0.9),
        );
      }
      // little apple trees dotted across the orchard
      const c = lerp(g.T, g.B, 0.5);
      const spots: Pt[] = [
        { x: -34, y: 2 }, { x: -6, y: -14 }, { x: 26, y: -2 }, { x: -14, y: 16 }, { x: 18, y: 18 },
      ];
      for (const s of spots) {
        const tx = c.x + s.x;
        const ty = c.y + s.y;
        out += poly([{ x: tx - 1.5, y: ty }, { x: tx + 1.5, y: ty }, { x: tx + 1, y: ty - 7 }, { x: tx - 1, y: ty - 7 }], '#6b4a2e');
        out += circle(tx, ty - 11, 6, '#4f8a3e');
        out += circle(tx - 2, ty - 13, 1.4, '#d0432f');
        out += circle(tx + 3, ty - 9, 1.4, '#d0432f');
      }
      return out;
    },
  },
  hunter: {
    base: '#8a6240',
    topMargin: 12,
    detail: (g) => {
      const d = lerp(g.B, g.R, 0.5);
      const a = add(d, { x: 0, y: -15 });
      const antler = '#efe6d2';
      return (
        archDoor(g, 12) +
        line(add(a, { x: -2, y: 0 }), add(a, { x: -7, y: -9 }), antler, 1.5) +
        line(add(a, { x: -5, y: -4 }), add(a, { x: -10, y: -5 }), antler, 1.2) +
        line(add(a, { x: -6, y: -7 }), add(a, { x: -10, y: -9 }), antler, 1.2) +
        line(add(a, { x: 2, y: 0 }), add(a, { x: 7, y: -9 }), antler, 1.5) +
        line(add(a, { x: 5, y: -4 }), add(a, { x: 10, y: -5 }), antler, 1.2) +
        line(add(a, { x: 6, y: -7 }), add(a, { x: 10, y: -9 }), antler, 1.2)
      );
    },
  },
  wheatFarm: {
    base: '#d9c878',
    topMargin: 6,
    flat: true,
    custom: (g) => {
      let out = poly([g.T, g.R, g.B, g.L], '#d9c878');
      // furrow stripes parallel to the T->R edge
      for (let i = 0; i < 4; i++) {
        const t0 = (i + 0.25) / 4;
        const t1 = (i + 0.6) / 4;
        out += poly(
          [lerp(g.T, g.L, t0), lerp(g.R, g.B, t0), lerp(g.R, g.B, t1), lerp(g.T, g.L, t1)],
          shade('#d9c878', 0.88),
        );
      }
      return out;
    },
  },
  mill: {
    base: STONE,
    topMargin: 20,
    // sails (hub + turning blades) are drawn by buildingAnim
  },
  bakery: {
    base: '#c08a62',
    topMargin: 30,
    detail: (g) => {
      const roofAt = lerp(add(g.T, g.up), add(g.B, g.up), 0.32);
      // chimney only; the rising smoke is drawn by buildingAnim
      return archDoor(g, 13) + cube(roofAt, 6, 12, '#9a6248');
    },
  },
  campfire: {
    base: '#d96f32',
    topMargin: 16,
    flat: true,
    custom: (g, def) => {
      const c = { x: 0, y: 16 };
      let out = groundShadow(g, def);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        out += circle(c.x + Math.cos(a) * 13, c.y + Math.sin(a) * 6.5, 2.6, '#a8a094');
      }
      out += line(add(c, { x: -8, y: 3 }), add(c, { x: 8, y: -4 }), '#7a5a36', 3.4);
      out += line(add(c, { x: -8, y: -4 }), add(c, { x: 8, y: 3 }), '#7a5a36', 3.4);
      return out; // the flickering flame is drawn by buildingAnim
    },
  },
  stockpile: {
    base: '#d2c293',
    topMargin: 14,
    flat: true,
    custom: (g) => {
      return (
        poly([g.T, g.R, g.B, g.L], '#d2c293') +
        cube({ x: -16, y: 40 }, 9, 9, '#a88a56') +
        cube({ x: 26, y: 52 }, 7.5, 8, '#a88a56') +
        circle(8, 70, 5, '#cfa95a')
      );
    },
  },
};

export function buildBuildingAssets(): Record<BuildingType, VectorAsset> {
  const out = {} as Record<BuildingType, VectorAsset>;
  for (const type of Object.keys(SPECS) as BuildingType[]) {
    const def = BUILDINGS[type];
    const spec = SPECS[type];
    const { w, h } = def.size;
    const boxH = spec.flat ? 0 : def.height;
    const g = boxGeo(w, h, boxH);
    const body = spec.custom
      ? spec.custom(g, def)
      : groundShadow(g, def) + isoBox(g, spec.base) + (spec.detail?.(g, def) ?? '');
    const width = (w + h) * 32 + PAD * 2;
    const height = boxH + spec.topMargin + (w + h) * 16 + PAD * 2;
    const anchor = { x: h * 32 + PAD, y: boxH + spec.topMargin + PAD };
    out[type] = { id: type, svg: svgDoc(width, height, anchor, body), width, height, anchor };
  }
  return out;
}
