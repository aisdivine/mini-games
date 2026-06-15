// The reusable asset contract: every drawable game object resolves to a
// VectorAsset by its ArtId. Rendering only knows this interface — adding a
// new building's art is one entry in the registry, no view changes.

import type { BuildingType } from '../config';
import type { UnitRole } from '../sim/world';

export interface Pt {
  x: number;
  y: number;
}

export type DecorId = 'tree' | 'stump' | 'mountain' | 'fish';
export type ArtId = BuildingType | UnitRole | DecorId;

export interface VectorAsset {
  id: ArtId;
  /** Full standalone SVG document. */
  svg: string;
  /** Logical size in px (the SVG viewBox). */
  width: number;
  height: number;
  /** SVG point that maps onto the object's world position:
   *  buildings — the footprint's top (north) corner at ground level;
   *  units — the point between the feet. */
  anchor: Pt;
}
