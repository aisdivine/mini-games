// Rasterize the vector art into Pixi textures once at startup. SVGs are
// rendered at 2x resolution so they stay crisp when zoomed in.

import { ImageSource, Texture } from 'pixi.js';
import { buildAllAssets, type ArtId, type VectorAsset } from '../art';
import type { Pt } from '../art/types';

const RESOLUTION = 2;

export interface ArtTexture {
  texture: Texture;
  anchor: Pt;
  width: number;
  height: number;
}

export type ArtTextures = Map<ArtId, ArtTexture>;

export async function loadArtTextures(): Promise<ArtTextures> {
  const assets = buildAllAssets();
  const entries = await Promise.all(
    [...assets.values()].map(async (asset) => {
      const texture = await rasterize(asset);
      return [asset.id, { texture, anchor: asset.anchor, width: asset.width, height: asset.height }] as const;
    }),
  );
  return new Map(entries);
}

async function rasterize(asset: VectorAsset): Promise<Texture> {
  // Scale the SVG's intrinsic size up; the source resolution scales it back
  // down, so the texture's logical size equals the asset's logical size.
  const scaled = asset.svg.replace(
    /^<svg([^>]*) width="([\d.]+)" height="([\d.]+)"/,
    (_m, attrs: string, w: string, h: string) =>
      `<svg${attrs} width="${Number(w) * RESOLUTION}" height="${Number(h) * RESOLUTION}"`,
  );
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scaled)}`;
  await img.decode();
  return new Texture({ source: new ImageSource({ resource: img, resolution: RESOLUTION }) });
}
