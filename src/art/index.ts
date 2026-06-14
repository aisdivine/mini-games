// The complete art registry: every drawable object's VectorAsset by ArtId.

import { buildBuildingAssets } from './buildings';
import { buildUnitAssets } from './units';
import { buildDecorAssets } from './decor';
import type { ArtId, VectorAsset } from './types';

export type { ArtId, VectorAsset } from './types';

export function buildAllAssets(): Map<ArtId, VectorAsset> {
  const map = new Map<ArtId, VectorAsset>();
  for (const asset of Object.values(buildBuildingAssets())) map.set(asset.id, asset);
  for (const asset of Object.values(buildUnitAssets())) map.set(asset.id, asset);
  for (const asset of Object.values(buildDecorAssets())) map.set(asset.id, asset);
  return map;
}
