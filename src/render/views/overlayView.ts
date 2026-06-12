// Hover highlight, placement ghost, wall-drag preview, selection ring, and
// the debug path overlay. All transient, all redrawn cheaply.

import { Container, Graphics } from 'pixi.js';
import { BUILDINGS, type BuildingType } from '../../config';
import { inBounds } from '../../sim/grid';
import type { Vec2, World } from '../../sim/world';
import { diamondPoints, tileToScreen } from '../iso';

export class OverlayView {
  readonly container = new Container();
  private hover = new Graphics();
  private ghost = new Graphics();
  private selection = new Graphics();
  private paths = new Graphics();
  debugPaths = false;

  constructor() {
    this.container.addChild(this.paths, this.hover, this.ghost, this.selection);
  }

  setHoverTile(tx: number, ty: number): void {
    this.hover.clear();
    if (!inBounds(tx, ty)) return;
    this.hover
      .poly(diamondPoints(tx, ty))
      .fill({ color: 0xffffff, alpha: 0.15 })
      .stroke({ width: 2, color: 0xffe066 });
  }

  clearGhost(): void {
    this.ghost.clear();
  }

  /** Footprint preview while placing a building. */
  setGhost(type: BuildingType, tile: Vec2, valid: boolean): void {
    this.ghost.clear();
    const def = BUILDINGS[type];
    const color = valid ? 0x55cc55 : 0xcc4444;
    for (let dy = 0; dy < def.size.h; dy++) {
      for (let dx = 0; dx < def.size.w; dx++) {
        this.ghost
          .poly(diamondPoints(tile.x + dx, tile.y + dy))
          .fill({ color, alpha: 0.45 });
      }
    }
    // mark the worker access tile
    if (def.recipe || type === 'granary') {
      this.ghost
        .poly(diamondPoints(tile.x + def.size.w, tile.y + def.size.h - 1))
        .stroke({ width: 2, color: 0xffe066 });
    }
  }

  /** Tile chain preview while dragging a wall line. */
  setWallPreview(tiles: Vec2[], isValid: (t: Vec2) => boolean): void {
    this.ghost.clear();
    for (const t of tiles) {
      this.ghost
        .poly(diamondPoints(t.x, t.y))
        .fill({ color: isValid(t) ? 0x55cc55 : 0xcc4444, alpha: 0.45 });
    }
  }

  setSelection(pos: Vec2 | null): void {
    this.selection.clear();
    if (!pos) return;
    const p = tileToScreen(pos.x, pos.y);
    this.selection.ellipse(p.x, p.y + 2, 12, 6).stroke({ width: 2, color: 0x7fd4ff });
  }

  /** Highlight a selected building's footprint. */
  setSelectedBuilding(type: BuildingType | null, tile: Vec2 | null): void {
    this.selection.clear();
    if (!type || !tile) return;
    const def = BUILDINGS[type];
    const w = def.size.w;
    const h = def.size.h;
    const top = tileToScreen(tile.x, tile.y);
    this.selection
      .poly([
        top.x, top.y,
        top.x + w * 32, top.y + w * 16,
        top.x + (w - h) * 32, top.y + (w + h) * 16,
        top.x - h * 32, top.y + h * 16,
      ])
      .stroke({ width: 2, color: 0x7fd4ff });
  }

  /** Debug: draw every unit's remaining path. Toggled with 'g'. */
  drawPaths(world: World): void {
    this.paths.clear();
    if (!this.debugPaths) return;
    for (const u of world.units.values()) {
      if (!u.path || u.path.length === 0) continue;
      const start = tileToScreen(u.pos.x, u.pos.y);
      this.paths.moveTo(start.x, start.y);
      for (const wp of u.path) {
        const p = tileToScreen(wp.x + 0.5, wp.y + 0.5);
        this.paths.lineTo(p.x, p.y);
      }
      this.paths.stroke({ width: 2, color: 0x7fd4ff, alpha: 0.5 });
    }
  }
}
