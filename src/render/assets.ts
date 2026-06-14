// Rasterize vector art into Pixi textures once at startup. SVGs are rendered
// at 2x resolution so they stay crisp when zoomed in.

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
      const texture = await rasterizeSvg(asset.svg);
      return [asset.id, { texture, anchor: asset.anchor, width: asset.width, height: asset.height }] as const;
    }),
  );
  return new Map(entries);
}

/** Rasterize an SVG string to a 2x texture (logical size = the SVG's size). */
export async function rasterizeSvg(svg: string): Promise<Texture> {
  const scaled = svg.replace(
    /<svg([^>]*?) width="([\d.]+)" height="([\d.]+)"/,
    (_m, attrs: string, w: string, h: string) =>
      `<svg${attrs} width="${Number(w) * RESOLUTION}" height="${Number(h) * RESOLUTION}"`,
  );
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scaled)}`;
  await img.decode();
  return new Texture({ source: new ImageSource({ resource: img, resolution: RESOLUTION }) });
}

/** Read width/height and the data-anchor="ax,ay" from an SVG root tag. */
export function parseSvgMeta(svg: string): { width: number; height: number; anchor: Pt } {
  const w = Number(/ width="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const h = Number(/ height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const a = /data-anchor="([\d.]+),([\d.]+)"/.exec(svg);
  const anchor = a ? { x: Number(a[1]), y: Number(a[2]) } : { x: w / 2, y: h };
  return { width: w, height: h, anchor };
}

// Re-export so callers can build VectorAssets without importing the type path.
export type { VectorAsset };
