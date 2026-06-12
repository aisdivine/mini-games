import type { Container } from 'pixi.js';
import { ZOOM_MIN, ZOOM_MAX } from '../config';

export class Camera {
  constructor(private world: Container) {}

  panBy(dx: number, dy: number): void {
    this.world.position.x += dx;
    this.world.position.y += dy;
  }

  /** Zoom by `factor`, keeping the screen point (sx, sy) fixed under the cursor. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const oldScale = this.world.scale.x;
    const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldScale * factor));
    if (newScale === oldScale) return;
    const ratio = newScale / oldScale;
    this.world.position.set(
      sx - (sx - this.world.position.x) * ratio,
      sy - (sy - this.world.position.y) * ratio,
    );
    this.world.scale.set(newScale);
  }

  centerOn(worldX: number, worldY: number, screenW: number, screenH: number): void {
    const s = this.world.scale.x;
    this.world.position.set(screenW / 2 - worldX * s, screenH / 2 - worldY * s);
  }
}
