// The complete art registry: every drawable object's VectorAsset by ArtId.

import { buildBuildingAssets } from './buildings';
import { buildDecorAssets } from './decor';
import type { ArtId, VectorAsset } from './types';

export type { ArtId, VectorAsset } from './types';

// Buildings and decor are baked SVG textures. Units are drawn per-unit as
// Graphics (see render/views/unitView.ts) so each can be individually colored.
export function buildAllAssets(): Map<ArtId, VectorAsset> {
  const map = new Map<ArtId, VectorAsset>();
  for (const asset of Object.values(buildBuildingAssets())) map.set(asset.id, asset);
  for (const asset of Object.values(buildDecorAssets())) map.set(asset.id, asset);
  return map;
}
