// Map decor (trees, stumps) — now sourced from the v2 art pack SVGs rather
// than drawn in code. Each file carries its own size + data-anchor.

import treeSvg from './v2/tree.svg?raw';
import stumpSvg from './v2/stump.svg?raw';
import type { DecorId, Pt, VectorAsset } from './types';

function fromSvg(id: DecorId, raw: string): VectorAsset {
  const svg = raw.trim();
  const w = Number(/ width="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const h = Number(/ height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const a = /data-anchor="([\d.]+),([\d.]+)"/.exec(svg);
  const anchor: Pt = a ? { x: Number(a[1]), y: Number(a[2]) } : { x: w / 2, y: h };
  return { id, svg, width: w, height: h, anchor };
}

export function buildDecorAssets(): Record<DecorId, VectorAsset> {
  return {
    tree: fromSvg('tree', treeSvg),
    stump: fromSvg('stump', stumpSvg),
  };
}
