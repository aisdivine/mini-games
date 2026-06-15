// Map decor. Trees/stumps come from the v2 art pack SVGs; mountains and fish
// are generated from the flat.ts primitives so they match the clean iso style
// and stay deterministic.

import treeSvg from './v2/tree.svg?raw';
import stumpSvg from './v2/stump.svg?raw';
import { poly, shade, svgDoc } from './flat';
import type { DecorId, Pt, VectorAsset } from './types';

function fromSvg(id: DecorId, raw: string): VectorAsset {
  const svg = raw.trim();
  const w = Number(/ width="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const h = Number(/ height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const a = /data-anchor="([\d.]+),([\d.]+)"/.exec(svg);
  const anchor: Pt = a ? { x: Number(a[1]), y: Number(a[2]) } : { x: w / 2, y: h };
  return { id, svg, width: w, height: h, anchor };
}

// A single flat-shaded rocky peak with a snow cap. Anchor = base center, so it
// plants on a tile like a building/tree and depth-sorts the same way.
function buildMountain(): VectorAsset {
  const ROCK = '#8d887f';
  const halfW = 30; // base half-width
  const peakH = 64; // apex height above the base
  const W = halfW * 2 + 12;
  const H = peakH + 24;
  const ax = W / 2;
  const ay = H - 12; // base sits near the bottom
  // base diamond corners (iso footprint of one tile-ish)
  const bL: Pt = { x: -halfW, y: 0 };
  const bR: Pt = { x: halfW, y: 0 };
  const bF: Pt = { x: 0, y: 12 }; // front (south) point
  const apex: Pt = { x: -4, y: -peakH };
  const snowY = -peakH * 0.62;
  const sL: Pt = { x: -halfW * 0.34, y: snowY + 6 };
  const sR: Pt = { x: halfW * 0.3, y: snowY + 4 };
  const body =
    // left (lit) face
    poly([bL, apex, bF], shade(ROCK, 1.08)) +
    // right (shaded) face
    poly([bF, apex, bR], shade(ROCK, 0.78)) +
    // snow cap straddling the ridge
    poly([apex, sR, { x: 0, y: snowY + 12 }, sL], '#eef2f6') +
    poly([apex, { x: 0, y: snowY + 12 }, sL], '#d6dde4');
  return { id: 'mountain', svg: svgDoc(W, H, { x: ax, y: ay }, body), width: W, height: H, anchor: { x: ax, y: ay } };
}

// A small fish, anchored at its center, drawn lying on the water surface.
function buildFish(): VectorAsset {
  const W = 24;
  const H = 16;
  const ax = W / 2;
  const ay = H / 2;
  const BODY = '#6fb7d6';
  const body =
    poly([{ x: -7, y: 0 }, { x: 2, y: -4 }, { x: 8, y: 0 }, { x: 2, y: 4 }], BODY) + // body
    poly([{ x: 6, y: 0 }, { x: 11, y: -4 }, { x: 11, y: 4 }], shade(BODY, 0.8)) + // tail
    poly([{ x: 0, y: -2 }, { x: 4, y: -1 }, { x: 0, y: 1 }], shade(BODY, 1.12)); // top fin
  return { id: 'fish', svg: svgDoc(W, H, { x: ax, y: ay }, body), width: W, height: H, anchor: { x: ax, y: ay } };
}

export function buildDecorAssets(): Record<DecorId, VectorAsset> {
  return {
    tree: fromSvg('tree', treeSvg),
    stump: fromSvg('stump', stumpSvg),
    mountain: buildMountain(),
    fish: buildFish(),
  };
}
