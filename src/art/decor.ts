// Flat-shaded map decor: trees and stumps. Same VectorAsset contract as
// buildings/units; anchor is the base of the trunk (where it meets the tile).

import { circle, ellipse, poly, shade, shadow, svgDoc } from './flat';
import type { DecorId, Pt, VectorAsset } from './types';

const W = 40;
const H = 56;
const ANCHOR: Pt = { x: 20, y: 50 };
const TRUNK = '#6b4a2e';
const LEAF = '#5b8a3c';

function treeBody(): string {
  // trunk
  const trunk = poly(
    [
      { x: -3, y: 0 },
      { x: 3, y: 0 },
      { x: 2, y: -16 },
      { x: -2, y: -16 },
    ],
    TRUNK,
  );
  // three stacked canopy blobs, lighter toward the top-left (light source)
  const canopy =
    ellipse(0, -20, 13, 9, shade(LEAF, 0.85)) +
    ellipse(-2, -28, 11, 8, LEAF) +
    ellipse(-3, -35, 8, 6.5, shade(LEAF, 1.12));
  return shadow(0, 0, 12, 4.5) + trunk + canopy;
}

function stumpBody(): string {
  return (
    shadow(0, 0, 8, 3.5) +
    poly(
      [
        { x: -5, y: 0 },
        { x: 5, y: 0 },
        { x: 4, y: -8 },
        { x: -4, y: -8 },
      ],
      TRUNK,
    ) +
    // cut top: lighter ellipse with a couple of rings
    ellipse(0, -8, 4.5, 2.4, shade(TRUNK, 1.4)) +
    circle(0, -8, 1.6, shade(TRUNK, 1.15))
  );
}

export function buildDecorAssets(): Record<DecorId, VectorAsset> {
  const make = (id: DecorId, body: string): VectorAsset => ({
    id,
    svg: svgDoc(W, H, ANCHOR, body),
    width: W,
    height: H,
    anchor: ANCHOR,
  });
  return {
    tree: make('tree', treeBody()),
    stump: make('stump', stumpBody()),
  };
}
