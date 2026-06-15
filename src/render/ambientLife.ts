// Ambient wildlife — pure render flavor, no sim state. A few bird flocks drift
// across the sky and a camel wanders the grassland near the keep. Textures are
// loaded here (not via the art registry) because the pack's life SVGs are
// stroke-only and would trip the registry's "solid fill" art test.

import { Container, Sprite, type Texture } from 'pixi.js';
import { MAP_W, MAP_H } from '../config';
import { tileToScreen } from './iso';
import { rasterizeSvg } from './assets';
import birdsSvg from '../art/v2/pack/life/birds.svg?raw';
import camelSvg from '../art/v2/pack/life/camel.svg?raw';

interface Flock {
  sprite: Sprite;
  x: number; // world (screen-space, inside the panned world container)
  y: number;
  vx: number;
  vy: number;
}

export async function loadAmbientLife(): Promise<{ birds: Texture; camel: Texture }> {
  const [birds, camel] = await Promise.all([
    rasterizeSvg(birdsSvg.trim()),
    rasterizeSvg(camelSvg.trim()),
  ]);
  return { birds, camel };
}

export class AmbientLife {
  private flocks: Flock[] = [];
  private camel: Sprite;
  private cx = 0; // camel world pos
  private cy = 0;
  private tx = 0; // camel target tile
  private ty = 0;
  // wander box (grass west of the keep — always clear of water/rock)
  private readonly box = {
    x0: (MAP_W >> 1) - 18, x1: (MAP_W >> 1) - 4,
    y0: (MAP_H >> 1) - 10, y1: (MAP_H >> 1) + 12,
  };

  constructor(sky: Container, ground: Container, tex: { birds: Texture; camel: Texture }) {
    // bird flocks drift over the map and wrap; sky layer sits above everything
    const span = (MAP_W + MAP_H) * 16; // rough world diagonal extent
    for (let i = 0; i < 3; i++) {
      const sprite = new Sprite(tex.birds);
      sprite.anchor.set(0.5);
      sprite.alpha = 0.8;
      sky.addChild(sprite);
      this.flocks.push({
        sprite,
        x: -span / 2 + Math.random() * span,
        y: -span / 4 + Math.random() * (span / 2),
        vx: 0.012 + Math.random() * 0.01,
        vy: 0.004 + Math.random() * 0.004,
      });
    }

    // one wandering camel, depth-sorted with the entities
    this.camel = new Sprite(tex.camel);
    this.camel.anchor.set(55 / 110, 94 / 100); // pack anchor → feet
    this.camel.scale.set(0.7);
    ground.addChild(this.camel);
    const start = tileToScreen(this.box.x0 + 3 + 0.5, this.box.y0 + 5 + 0.5);
    this.cx = start.x;
    this.cy = start.y;
    this.pickTarget();
  }

  private pickTarget(): void {
    this.tx = this.box.x0 + Math.random() * (this.box.x1 - this.box.x0);
    this.ty = this.box.y0 + Math.random() * (this.box.y1 - this.box.y0);
  }

  update(clock: number, dtMs: number): void {
    const span = (MAP_W + MAP_H) * 16;
    for (const f of this.flocks) {
      f.x += f.vx * dtMs;
      f.y += f.vy * dtMs;
      if (f.x > span * 0.75) { f.x = -span * 0.75; f.y = -span / 4 + Math.random() * (span / 2); }
      f.sprite.position.set(f.x, f.y);
      f.sprite.zIndex = 1e6; // always on top of the world
    }

    // camel: ease toward its target tile, repick on arrival, bob + face travel
    const goal = tileToScreen(this.tx + 0.5, this.ty + 0.5);
    const dx = goal.x - this.cx;
    const dy = goal.y - this.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) {
      this.pickTarget();
    } else {
      const sp = Math.min(dist, 0.018 * dtMs);
      this.cx += (dx / dist) * sp;
      this.cy += (dy / dist) * sp;
    }
    const bob = -Math.abs(Math.sin(clock * 0.006)) * 2;
    this.camel.position.set(this.cx, this.cy + bob);
    this.camel.scale.x = (dx >= 0 ? 1 : -1) * 0.7; // flip toward travel
    // depth ~ tileX+tileY recovered from the foot screen-y (see tileToScreen)
    this.camel.zIndex = this.cy / 16;
  }
}
