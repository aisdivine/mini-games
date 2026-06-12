// Typed hand-drawn SVG primitives. Every line is a wobbly cubic bezier —
// never a straight <line> or clean <polygon>. Wobble is deterministic
// (seeded), so the same asset id always renders the same strokes.

export interface Pt {
  x: number;
  y: number;
}

export interface StrokeOpts {
  color?: string;
  width?: number;
  opacity?: number;
}

export interface ShapeOpts extends StrokeOpts {
  fill?: string;
  fillOpacity?: number;
  /** Opaque underlay color beneath a translucent wash — keeps the watercolor
   *  look without letting occluded objects bleed through. */
  base?: string;
}

export const PAPER = '#ece6d4';

export const INK = '#4a4035';
export const INK_LIGHT = '#8a7f6e';

const f = (n: number): string => (Math.round(n * 10) / 10).toString();
const fp = (p: Pt): string => `${f(p.x)},${f(p.y)}`;

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}

export class Sketcher {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  private rand(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Random offset in [-amt, amt]. */
  j(amt: number): number {
    return (this.rand() * 2 - 1) * amt;
  }

  /** One wobbly bezier segment a -> b. Control points deviate perpendicular
   *  to the true line, endpoints slightly miss — like a real pen stroke. */
  private seg(a: Pt, b: Pt, moveTo: boolean): string {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const wob = Math.min(2.2, Math.max(0.7, len / 26));
    const nx = (b.y - a.y) / len;
    const ny = -(b.x - a.x) / len;
    const c1 = {
      x: a.x + (b.x - a.x) / 3 + nx * this.j(wob),
      y: a.y + (b.y - a.y) / 3 + ny * this.j(wob),
    };
    const c2 = {
      x: a.x + (2 * (b.x - a.x)) / 3 + nx * this.j(wob),
      y: a.y + (2 * (b.y - a.y)) / 3 + ny * this.j(wob),
    };
    return `${moveTo ? `M ${fp(a)} ` : ''}C ${fp(c1)} ${fp(c2)} ${fp(b)} `;
  }

  /** Wobbly polyline path data through the points (jittered vertices). */
  wobblyPath(points: Pt[], close = false): string {
    const pts = points.map((p) => ({ x: p.x + this.j(1.1), y: p.y + this.j(1.1) }));
    let d = '';
    for (let i = 0; i < pts.length - 1; i++) d += this.seg(pts[i], pts[i + 1], i === 0);
    if (close && pts.length > 2) d += this.seg(pts[pts.length - 1], pts[0], false) + 'Z';
    return d;
  }

  /** Open stroked path. */
  stroke(points: Pt[], opts: StrokeOpts = {}): string {
    return (
      `<path d="${this.wobblyPath(points)}" fill="none"` +
      ` stroke="${opts.color ?? INK}" stroke-width="${f(opts.width ?? 1.4)}"` +
      ` stroke-opacity="${opts.opacity ?? 0.9}"` +
      ` stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }

  /** Closed shape: soft watercolor-ish fill + sketchy outline. */
  shape(points: Pt[], opts: ShapeOpts = {}): string {
    const d = this.wobblyPath(points, true);
    const underlay = opts.base
      ? `<path d="${d}" fill="${opts.base}" fill-opacity="1" stroke="none"/>`
      : '';
    return (
      underlay +
      `<path d="${d}"` +
      ` fill="${opts.fill ?? 'none'}" fill-opacity="${opts.fillOpacity ?? 0.45}"` +
      ` stroke="${opts.color ?? INK}" stroke-width="${f(opts.width ?? 1.4)}"` +
      ` stroke-opacity="${opts.opacity ?? 0.9}"` +
      ` stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }

  /** Hand-shading: hatch lines across the quad a-b-c-d, drawn between edge
   *  a->b and edge d->c, slightly inset so they don't poke out. */
  hatchQuad(a: Pt, b: Pt, c: Pt, d: Pt, lines: number, opts: StrokeOpts = {}): string {
    let out = '';
    for (let i = 1; i <= lines; i++) {
      const t = i / (lines + 1);
      const p1 = lerp(a, b, t);
      const p2 = lerp(d, c, t);
      out += this.stroke([lerp(p1, p2, 0.07), lerp(p2, p1, 0.07)], {
        color: opts.color ?? INK,
        width: opts.width ?? 0.9,
        opacity: opts.opacity ?? 0.22,
      });
    }
    return out;
  }

  /** Scribbled circle — n jittered points around the radius, closed. */
  circle(cx: number, cy: number, r: number, opts: ShapeOpts = {}): string {
    const pts: Pt[] = [];
    const n = Math.max(6, Math.round(r));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const rr = r + this.j(r * 0.12);
      pts.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr });
    }
    return this.shape(pts, opts);
  }

  /** Scribbled ellipse (for shadows). */
  ellipse(cx: number, cy: number, rx: number, ry: number, opts: ShapeOpts = {}): string {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      pts.push({
        x: cx + Math.cos(ang) * (rx + this.j(rx * 0.1)),
        y: cy + Math.sin(ang) * (ry + this.j(ry * 0.1)),
      });
    }
    return this.shape(pts, opts);
  }
}

/** Wrap a body (drawn in anchor space, anchor at origin) into an SVG doc.
 *  The body is translated so the anchor lands at (anchor.x, anchor.y). */
export function svgDoc(width: number, height: number, anchor: Pt, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${f(height)}"` +
    ` viewBox="0 0 ${f(width)} ${f(height)}">` +
    `<g transform="translate(${fp(anchor)})">${body}</g></svg>`
  );
}
