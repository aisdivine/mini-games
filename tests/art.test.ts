import { describe, it, expect } from 'vitest';
import { buildAllAssets } from '../src/art';
import { buildBuildingAssets } from '../src/art/buildings';
import { buildDecorAssets } from '../src/art/decor';
import { BUILDINGS, type BuildingType } from '../src/config';

describe('vector art registry', () => {
  it('has a baked asset for every building type and decor item', () => {
    const assets = buildAllAssets();
    for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
      expect(assets.has(type), `missing art for ${type}`).toBe(true);
    }
    for (const decor of ['tree', 'stump'] as const) {
      expect(assets.has(decor), `missing art for ${decor}`).toBe(true);
    }
  });

  it('generates well-formed SVG with no NaN/undefined path data', () => {
    for (const asset of buildAllAssets().values()) {
      expect(asset.svg.startsWith('<svg ')).toBe(true);
      expect(asset.svg.endsWith('</svg>')).toBe(true);
      expect(asset.svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      // anchor inside the canvas
      expect(asset.anchor.x).toBeGreaterThanOrEqual(0);
      expect(asset.anchor.x).toBeLessThanOrEqual(asset.width);
      expect(asset.anchor.y).toBeGreaterThanOrEqual(0);
      expect(asset.anchor.y).toBeLessThanOrEqual(asset.height);
    }
  });

  it('flat style: every asset has solid filled shapes', () => {
    for (const asset of buildAllAssets().values()) {
      expect(asset.svg).toContain('fill="#');
    }
  });

  it('is deterministic: two builds produce identical SVGs', () => {
    const a = buildBuildingAssets();
    const b = buildBuildingAssets();
    for (const type of Object.keys(a) as BuildingType[]) {
      expect(a[type].svg).toBe(b[type].svg);
    }
    expect(buildDecorAssets().tree.svg).toBe(buildDecorAssets().tree.svg);
  });

  it('building art is footprint-center anchored and scales to cover the footprint', () => {
    // v2 pack contract: a fixed canvas with a footprint-center anchor, scaled at
    // render time by (w+h)*16 / ART_BASE_HALF (see buildingView.buildingScale).
    const ART_BASE_HALF = 30;
    const assets = buildBuildingAssets();
    for (const type of Object.keys(assets) as BuildingType[]) {
      const def = BUILDINGS[type];
      const a = assets[type];
      const scale = ((def.size.w + def.size.h) * 16) / ART_BASE_HALF;
      const diamondW = (def.size.w + def.size.h) * 32;
      const diamondH = (def.size.w + def.size.h) * 16;
      // canvas is horizontally centered on the footprint
      expect(a.anchor.x).toBeCloseTo(a.width / 2, 1);
      // scaled canvas covers the on-screen footprint diamond
      expect(scale * a.width).toBeGreaterThanOrEqual(diamondW);
      expect(scale * a.anchor.y).toBeGreaterThanOrEqual(diamondH);
    }
  });
});
