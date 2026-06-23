// Renders the farm board from the world each frame. Everything is drawn with
// PixiJS Graphics in board-local pixel space (tile * TILE); main.ts scales and
// centers the board to fit the window. No sim state lives here.

import { Container, Graphics } from 'pixi.js';
import {
  CROPS,
  FARM_H,
  FARM_W,
  TILE,
  T_PATH,
  T_SOIL,
  T_WATER,
} from '../config';
import { cropDays, idx, type World } from '../sim/world';

export class FarmView {
  readonly root = new Container();
  private ground = new Graphics(); // terrain, rebuilt on dirty
  private crops = new Graphics(); // crops + watered sheen, rebuilt each frame
  private overlay = new Graphics(); // hover highlight + grid, each frame
  private house = new Graphics();
  private player = new Container();
  private helper = new Container();
  private groundDirty = true;

  constructor() {
    this.root.addChild(this.ground, this.crops, this.house, this.player, this.helper, this.overlay);
    this.buildHouse();
    this.player.addChild(...farmer('#3a5fb5', '#e8b58c')); // you — blue overalls
    this.helper.addChild(...farmer('#3f8e57', '#f2c9a0')); // the farmhand — green
  }

  markTerrainDirty(): void {
    this.groundDirty = true;
  }

  /** hover = tile under the cursor (or null); clock in ms for gentle motion. */
  update(world: World, hover: { x: number; y: number } | null, clock: number): void {
    if (this.groundDirty) {
      this.drawGround(world);
      this.groundDirty = false;
    }
    this.drawCrops(world, clock);
    this.drawOverlay(hover);
    this.placeCharacters(world, clock);
  }

  private drawGround(world: World): void {
    const g = this.ground.clear();
    for (let y = 0; y < FARM_H; y++) {
      for (let x = 0; x < FARM_W; x++) {
        const t = world.terrain[idx(x, y)];
        const px = x * TILE;
        const py = y * TILE;
        let fill = (x + y) % 2 === 0 ? 0x7cb05a : 0x73a851; // grass checker
        if (t === T_SOIL) fill = (x + y) % 2 === 0 ? 0x7a5436 : 0x6f4c30;
        else if (t === T_WATER) fill = 0x5fa9c4;
        else if (t === T_PATH) fill = 0xcabd92;
        g.rect(px, py, TILE, TILE).fill(fill);
        if (t === T_SOIL) {
          // furrow lines so tilled soil reads as rows
          g.rect(px + 4, py + TILE / 2 - 1, TILE - 8, 2).fill({ color: 0x000000, alpha: 0.12 });
        }
      }
    }
    // subtle tile grid
    g.rect(0, 0, FARM_W * TILE, FARM_H * TILE).stroke({ width: 0, color: 0 });
  }

  private drawCrops(world: World, clock: number): void {
    const g = this.crops.clear();
    for (let y = 0; y < FARM_H; y++) {
      for (let x = 0; x < FARM_W; x++) {
        const c = world.crops[idx(x, y)];
        if (!c) continue;
        const cx = x * TILE + TILE / 2;
        const baseY = y * TILE + TILE - 6;
        // watered sheen patch
        if (c.watered) {
          g.roundRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10, 6).fill({ color: 0x2b6f8a, alpha: 0.28 });
        }
        const def = CROPS[c.type];
        const ratio = Math.min(1, c.stage / cropDays(c.type));
        const h = 6 + ratio * (TILE * 0.6);
        // stalk
        g.roundRect(cx - 2, baseY - h, 4, h, 2).fill(def.leaf);
        // leaves
        const lw = 4 + ratio * 6;
        g.ellipse(cx - 5, baseY - h * 0.55, lw, 3).fill(def.leaf);
        g.ellipse(cx + 5, baseY - h * 0.7, lw, 3).fill(def.leaf);
        if (ratio >= 1) {
          // ripe fruit, with a little idle bob
          const bob = Math.sin(clock * 0.004 + x * 0.7 + y) * 1.5;
          g.circle(cx, baseY - h - 4 + bob, 7).fill(def.fruit);
          g.circle(cx - 2, baseY - h - 6 + bob, 2).fill({ color: 0xffffff, alpha: 0.5 });
        } else if (ratio > 0.25) {
          g.circle(cx, baseY - h - 2, 3).fill({ color: def.fruit, alpha: 0.6 });
        }
      }
    }
  }

  private drawOverlay(hover: { x: number; y: number } | null): void {
    const g = this.overlay.clear();
    if (hover) {
      g.roundRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2, 6)
        .stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 });
    }
  }

  private buildHouse(): void {
    // A cozy farmhouse on the path near the top-left (tiles ~0-1, row 0).
    const g = this.house;
    const px = 0.1 * TILE;
    const py = -0.15 * TILE;
    const w = TILE * 1.8;
    const h = TILE * 1.5;
    g.roundRect(px, py + h * 0.45, w, h * 0.55, 4).fill(0xddc9a0); // walls
    g.poly([px - 4, py + h * 0.5, px + w / 2, py, px + w + 4, py + h * 0.5]).fill(0xb24a35); // roof
    g.roundRect(px + w * 0.4, py + h * 0.62, w * 0.22, h * 0.38, 2).fill(0x6e4a2c); // door
    g.roundRect(px + w * 0.12, py + h * 0.58, w * 0.18, w * 0.18, 2).fill(0x9fd0ec); // window
  }

  private placeCharacters(world: World, clock: number): void {
    // You potter about by the house; the farmhand tends the field.
    const bob = Math.sin(clock * 0.005) * 2;
    this.player.position.set(1.0 * TILE + TILE / 2, 1.6 * TILE + bob);
    const tx = world.helperTile.x * TILE + TILE / 2 + Math.sin(clock * 0.0011) * 6;
    const ty = world.helperTile.y * TILE + TILE / 2 + Math.cos(clock * 0.0013) * 6 + Math.sin(clock * 0.006) * 2;
    this.helper.position.set(tx, ty);
  }
}

/** A tiny top-down character: body + head + a sun hat. Returns Graphics parts. */
function farmer(tunic: string, skin: string): Graphics[] {
  const shadow = new Graphics();
  shadow.ellipse(0, 14, 12, 4).fill({ color: 0x000000, alpha: 0.2 });
  const body = new Graphics();
  body.roundRect(-8, -2, 16, 18, 6).fill(tunic); // torso
  body.circle(0, -9, 7).fill(skin); // head
  body.ellipse(0, -13, 10, 4).fill(0xe8c45a); // straw hat brim
  body.circle(0, -15, 5).fill(0xd9a93c); // hat top
  body.circle(-2, -9, 1).fill(0x2a2a2a); // eyes
  body.circle(2, -9, 1).fill(0x2a2a2a);
  return [shadow, body];
}
