import { describe, it, expect } from 'vitest';
import { buildAllAssets } from '../src/art';
import { buildBuildingAssets } from '../src/art/buildings';
import { buildUnitAssets } from '../src/art/units';
import { BUILDINGS, type BuildingType } from '../src/config';

describe('vector art registry', () => {
  it('has an asset for every building type and unit role', () => {
    const assets = buildAllAssets();
    for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
      expect(assets.has(type), `missing art for ${type}`).toBe(true);
    }
    for (const role of ['peasant', 'archer', 'raider'] as const) {
      expect(assets.has(role), `missing art for ${role}`).toBe(true);
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
    const ua = buildUnitAssets();
    const ub = buildUnitAssets();
    expect(ua.peasant.svg).toBe(ub.peasant.svg);
  });

  it('building art canvas covers the footprint diamond', () => {
    const assets = buildBuildingAssets();
    for (const type of Object.keys(assets) as BuildingType[]) {
      const def = BUILDINGS[type];
      const a = assets[type];
      const diamondW = (def.size.w + def.size.h) * 32;
      const diamondH = (def.size.w + def.size.h) * 16;
      expect(a.width).toBeGreaterThanOrEqual(diamondW);
      expect(a.height - a.anchor.y).toBeGreaterThanOrEqual(diamondH);
    }
  });
});
