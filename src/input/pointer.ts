import type { Application, Container, FederatedPointerEvent } from 'pixi.js';
import type { Camera } from '../render/camera';
import { screenToTile, type Vec2 } from '../render/iso';
import { MAP_W, MAP_H, ZOOM_STEP } from '../config';

export interface PointerCallbacks {
  onHoverTile(tile: Vec2 | null): void;
  onClickTile(tile: Vec2, button: number): void;
}

// Any drag beyond this many screen px is a pan, not a click.
const DRAG_THRESHOLD = 6;

export function setupPointer(
  app: Application,
  worldLayer: Container,
  camera: Camera,
  cb: PointerCallbacks,
): void {
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  let down = false;
  let dragging = false;
  let downAt = { x: 0, y: 0 };
  let last = { x: 0, y: 0 };

  app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
    down = true;
    dragging = false;
    downAt = { x: e.global.x, y: e.global.y };
    last = { ...downAt };
  });

  app.stage.on('pointermove', (e: FederatedPointerEvent) => {
    if (down) {
      if (!dragging && Math.hypot(e.global.x - downAt.x, e.global.y - downAt.y) > DRAG_THRESHOLD) {
        dragging = true;
      }
      if (dragging) {
        camera.panBy(e.global.x - last.x, e.global.y - last.y);
      }
      last = { x: e.global.x, y: e.global.y };
    }
    cb.onHoverTile(pickTile(e));
  });

  app.stage.on('pointerup', (e: FederatedPointerEvent) => {
    if (down && !dragging) {
      const tile = pickTile(e);
      if (tile) cb.onClickTile(tile, e.button);
    }
    down = false;
    dragging = false;
  });

  app.stage.on('pointerupoutside', () => {
    down = false;
    dragging = false;
  });

  app.canvas.addEventListener(
    'wheel',
    (ev: WheelEvent) => {
      ev.preventDefault();
      camera.zoomAt(ev.offsetX, ev.offsetY, ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    },
    { passive: false },
  );

  function pickTile(e: FederatedPointerEvent): Vec2 | null {
    // toLocal accounts for camera pan/zoom — never hand-roll that math.
    const local = worldLayer.toLocal(e.global);
    const t = screenToTile(local.x, local.y);
    const tx = Math.floor(t.x);
    const ty = Math.floor(t.y);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return null;
    return { x: tx, y: ty };
  }
}
