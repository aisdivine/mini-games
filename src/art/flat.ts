// Clean flat-shaded isometric vector primitives: solid fills, no outlines,
// auto three-tone face shading from one base color, soft ground shadows.
// (Replaces the hand-drawn Sketcher style.)

import type { Pt } from './types';

const f = (n: number): string => (Math.round(n * 10) / 10).toString();
const fp = (p: Pt): string => `${f(p.x)},${f(p.y)}`;

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** Multiply an #rrggbb color toward black (<1) or white-clamped (>1). */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function poly(points: Pt[], fill: string, opacity = 1): string {
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${fp(p)}`).join(' ') + ' Z';
  return `<path d="${d}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;
}

export function pathFill(d: string, fill: string, opacity = 1): string {
  return `<path d="${d}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, opacity = 1): string {
  return (
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"` +
    ` fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`
  );
}

export function circle(cx: number, cy: number, r: number, fill: string, opacity = 1): string {
  return ellipse(cx, cy, r, r, fill, opacity);
}

/** Thin stroked line — only for slender props (bow, spear, flag pole). */
export function line(a: Pt, b: Pt, color: string, width: number, opacity = 1): string {
  return (
    `<path d="M ${fp(a)} L ${fp(b)}" fill="none" stroke="${color}"` +
    ` stroke-width="${f(width)}" stroke-linecap="round"` +
    `${opacity < 1 ? ` stroke-opacity="${opacity}"` : ''}/>`
  );
}

/** Soft elliptical ground shadow. */
export function shadow(cx: number, cy: number, rx: number, ry: number): string {
  return ellipse(cx, cy, rx, ry, '#5b4a2e', 0.13);
}

/** Footprint corners at ground level + extrusion (anchor space: the
 *  footprint's top/north corner is the origin). */
export interface BoxGeo {
  T: Pt;
  R: Pt;
  B: Pt;
  L: Pt;
  up: Pt;
}

export function boxGeo(w: number, h: number, height: number): BoxGeo {
  return {
    T: { x: 0, y: 0 },
    R: { x: w * 32, y: w * 16 },
    B: { x: (w - h) * 32, y: (w + h) * 16 },
    L: { x: -h * 32, y: h * 16 },
    up: { x: 0, y: -height },
  };
}

/** Flat-shaded iso box: light top, mid left face, dark right face. */
export function isoBox(g: BoxGeo, base: string): string {
  const Tu = add(g.T, g.up);
  const Ru = add(g.R, g.up);
  const Bu = add(g.B, g.up);
  const Lu = add(g.L, g.up);
  return (
    poly([g.L, g.B, Bu, Lu], shade(base, 0.93)) +
    poly([g.B, g.R, Ru, Bu], shade(base, 0.76)) +
    poly([Tu, Ru, Bu, Lu], shade(base, 1.08))
  );
}

/** Small iso cube standing on ground point c (crenellations, crates). */
export function cube(c: Pt, hw: number, ht: number, base: string): string {
  return isoBox(
    {
      T: { x: c.x, y: c.y - hw / 2 },
      R: { x: c.x + hw, y: c.y },
      B: { x: c.x, y: c.y + hw / 2 },
      L: { x: c.x - hw, y: c.y },
      up: { x: 0, y: -ht },
    },
    base,
  );
}

/** Crenellation cubes spaced along a roof edge. */
export function crenEdge(e0: Pt, e1: Pt, count: number, base: string, hw = 6, ht = 7): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += cube(lerp(e0, e1, (i + 0.5) / count), hw, ht, base);
  }
  return out;
}

/** Flat-shaded cylinder (round towers): body, shading bands, top ellipse. */
export function cylinder(cx: number, baseCy: number, r: number, h: number, base: string): string {
  const topCy = baseCy - h;
  const ry = r * 0.5;
  const body =
    `M ${f(cx - r)},${f(topCy)} L ${f(cx - r)},${f(baseCy)}` +
    ` A ${f(r)} ${f(ry)} 0 0 0 ${f(cx + r)},${f(baseCy)} L ${f(cx + r)},${f(topCy)} Z`;
  // right-side shading band
  const bx = cx + r * 0.42;
  const by = baseCy + ry * Math.sqrt(1 - 0.42 * 0.42);
  const band =
    `M ${f(bx)},${f(topCy)} L ${f(bx)},${f(by)}` +
    ` A ${f(r)} ${f(ry)} 0 0 0 ${f(cx + r)},${f(baseCy)} L ${f(cx + r)},${f(topCy)} Z`;
  return (
    pathFill(body, shade(base, 0.9)) +
    pathFill(band, shade(base, 0.74)) +
    ellipse(cx, topCy, r, ry, shade(base, 1.08))
  );
}

/** Triangular pennant on a pole, planted at ground point p. */
export function flag(p: Pt, poleH: number, color = '#c0392b'): string {
  const top = add(p, { x: 0, y: -poleH });
  return (
    line(p, top, '#6b4a32', 1.8) +
    poly([top, add(top, { x: 17, y: 5 }), add(top, { x: 0, y: 10 })], color)
  );
}

/** Wrap a body drawn in anchor space into an SVG doc (anchor -> (ax, ay)). */
export function svgDoc(width: number, height: number, anchor: Pt, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${f(height)}"` +
    ` viewBox="0 0 ${f(width)} ${f(height)}">` +
    `<g transform="translate(${fp(anchor)})">${body}</g></svg>`
  );
}
