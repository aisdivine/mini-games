// Per-building living detail, drawn into the view's `anim` Graphics each frame
// from the render clock (never the sim). Coordinates are container-local: the
// footprint's top corner at ground level is (0,0), matching flat.ts geometry,
// so we reuse boxGeo() to find chimneys, hubs, flag poles, etc.

import type { Graphics } from 'pixi.js';
import { BUILDINGS, type BuildingType } from '../../config';
import { add, boxGeo, lerp, type BoxGeo } from '../../art/flat';
import type { Pt } from '../../art/types';
import type { Building } from '../../sim/world';

// Box geometry per type (sized + extruded like the static art). Flat buildings
// (tower/farm/campfire/stockpile) use height 0, same as their custom art.
const FLAT = new Set<BuildingType>(['tower', 'wheatFarm', 'campfire', 'stockpile']);
const GEO: Partial<Record<BuildingType, BoxGeo>> = {};
function geoOf(type: BuildingType): BoxGeo {
  let g = GEO[type];
  if (!g) {
    const def = BUILDINGS[type];
    g = boxGeo(def.size.w, def.size.h, FLAT.has(type) ? 0 : def.height);
    GEO[type] = g;
  }
  return g;
}

export function drawBuildingAnim(g: Graphics, b: Building, clock: number): void {
  g.clear();
  const producing = b.state.kind === 'producing';
  const active = producing || b.state.kind === 'delivering';
  switch (b.type) {
    case 'keep':
      drawFlag(g, add(geoOf('keep').T, geoOf('keep').up), clock, 30);
      break;
    case 'tower':
      drawFlag(g, towerFlagBase(), clock, 26);
      break;
    case 'mill':
      drawSails(g, millHub(), clock, active);
      break;
    case 'bakery':
      drawSmoke(g, bakeryChimney(), clock, producing ? 1 : 0.25);
      break;
    case 'house':
      drawSmoke(g, houseHearth(), clock, 0.3);
      break;
    case 'campfire':
      drawFlame(g, { x: 0, y: 16 }, clock);
      break;
    case 'woodcutter':
      if (active) drawSawdust(g, woodcutterStump(), clock);
      break;
    case 'wheatFarm':
      drawWheat(g, clock, active);
      break;
    default:
      break;
  }
}

// --- anchor points ---------------------------------------------------------

function millHub(): Pt {
  const geo = geoOf('mill');
  return add(add(geo.B, geo.up), { x: 0, y: 8 });
}
function bakeryChimney(): Pt {
  const geo = geoOf('bakery');
  const roof = lerp(add(geo.T, geo.up), add(geo.B, geo.up), 0.32);
  return { x: roof.x + 2, y: roof.y - 12 };
}
function houseHearth(): Pt {
  // above the roof ridge — reads as hearth smoke without a drawn chimney
  const geo = geoOf('house');
  const ridge = lerp(add(geo.T, geo.up), add(geo.B, geo.up), 0.42);
  return { x: ridge.x - 8, y: ridge.y - 14 };
}
function towerFlagBase(): Pt {
  const geo = geoOf('tower'); // flat; cylinder drawn r=28 h=64 over center
  const c = lerp(geo.T, geo.B, 0.5);
  return { x: c.x + 4, y: c.y + 6 - 64 };
}
function woodcutterStump(): Pt {
  const geo = geoOf('woodcutter');
  return lerp(geo.B, geo.R, 0.78);
}

// --- drawers ---------------------------------------------------------------

function drawFlag(g: Graphics, base: Pt, clock: number, poleH: number): void {
  const top = { x: base.x, y: base.y - poleH };
  g.moveTo(base.x, base.y).lineTo(top.x, top.y).stroke({ width: 1.8, color: '#6b4a32' });
  const w = Math.sin(clock * 0.006);
  const w2 = Math.sin(clock * 0.006 + 1.3);
  g.poly([
    top.x, top.y,
    top.x + 17 + w * 2, top.y + 4 + w * 1.5,
    top.x + 15 + w2 * 2, top.y + 8 + w2,
    top.x, top.y + 10,
  ]).fill('#c0392b');
}

function drawSails(g: Graphics, hub: Pt, clock: number, active: boolean): void {
  const spin = clock * (active ? 0.005 : 0.0011);
  for (let k = 0; k < 4; k++) {
    const a = spin + (k * Math.PI) / 2;
    const dir = { x: Math.cos(a), y: Math.sin(a) * 0.6 };
    const perp = { x: -Math.sin(a) * 0.45, y: Math.cos(a) * 0.3 };
    const inner = add(hub, { x: dir.x * 6, y: dir.y * 6 });
    const tip = add(hub, { x: dir.x * 30, y: dir.y * 30 });
    g.poly([
      inner.x, inner.y,
      tip.x, tip.y,
      tip.x + perp.x * 15, tip.y + perp.y * 15,
      inner.x + perp.x * 15, inner.y + perp.y * 15,
    ]).fill('#efe9d6');
    g.moveTo(hub.x, hub.y).lineTo(tip.x, tip.y).stroke({ width: 1.6, color: '#7a7264' });
  }
  g.circle(hub.x, hub.y, 3).fill('#5f5a50');
}

function drawSmoke(g: Graphics, src: Pt, clock: number, intensity: number): void {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = (clock * 0.0005 + i / n) % 1;
    const x = src.x + Math.sin(t * 5 + i * 1.7) * 4;
    const y = src.y - t * 26;
    const r = 2 + t * 4.5;
    const alpha = (1 - t) * 0.5 * intensity;
    if (alpha > 0.02) g.circle(x, y, r).fill({ color: 0xe8e4d8, alpha });
  }
}

function drawFlame(g: Graphics, c: Pt, clock: number): void {
  const f = 1 + Math.sin(clock * 0.02) * 0.18 + Math.sin(clock * 0.047) * 0.1;
  g.circle(c.x, c.y + 1, 6 + Math.sin(clock * 0.03) * 1.5).fill({ color: 0xff8c3a, alpha: 0.18 });
  const drop = (s: number, color: number): void => {
    const sx = s * f;
    g.poly([
      c.x - 4 * sx, c.y,
      c.x - 3 * sx, c.y - 7 * sx,
      c.x, c.y - 14 * sx,
      c.x + 3 * sx, c.y - 7 * sx,
      c.x + 4 * sx, c.y,
    ]).fill(color);
  };
  drop(1, 0xe07b2e);
  drop(0.58, 0xf2b338);
}

function drawSawdust(g: Graphics, p: Pt, clock: number): void {
  // a saw rasping over the log pile, with little dust motes flicking off
  const sx = Math.sin(clock * 0.02) * 4;
  g.moveTo(p.x - 9 + sx, p.y - 5).lineTo(p.x + 9 + sx, p.y - 7).stroke({ width: 2, color: '#cfcfcf' });
  for (let i = 0; i < 3; i++) {
    const t = (clock * 0.0018 + i / 3) % 1;
    const a = (1 - t) * 0.5;
    if (a > 0.02) g.circle(p.x + sx + i * 2 - 2, p.y - t * 9, 1.4).fill({ color: 0xd9c39a, alpha: a });
  }
}

// Scattered stalk bases inside the field diamond (offsets from its center).
const STALKS: Pt[] = [
  { x: -34, y: 4 }, { x: -16, y: -8 }, { x: 2, y: -16 }, { x: 22, y: -6 },
  { x: 38, y: 6 }, { x: -22, y: 14 }, { x: 0, y: 8 }, { x: 24, y: 16 },
  { x: -6, y: 22 }, { x: 14, y: 0 },
];
function drawWheat(g: Graphics, clock: number, active: boolean): void {
  const geo = geoOf('wheatFarm');
  const c = lerp(geo.T, geo.B, 0.5);
  const amp = active ? 3.5 : 2;
  for (let i = 0; i < STALKS.length; i++) {
    const bx = c.x + STALKS[i].x;
    const by = c.y + STALKS[i].y;
    const sway = Math.sin(clock * 0.004 + i * 1.3) * amp;
    const tx = bx + sway;
    const ty = by - 11;
    g.moveTo(bx, by).lineTo(tx, ty).stroke({ width: 1.4, color: '#b89a3a' });
    g.circle(tx, ty - 1, 1.9).fill('#d9c34a');
  }
}
