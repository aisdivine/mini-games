import type { Application, Container, FederatedPointerEvent } from 'pixi.js';
import type { Camera } from '../render/camera';
import { screenToTile, type Vec2 } from '../render/iso';
import { MAP_W, MAP_H, ZOOM_STEP } from '../config';

export interface PointerCallbacks {
  onHoverTile(tile: Vec2 | null): void;
  /** frac is the fractional tile position of the click (for unit picking). */
  onClickTile(tile: Vec2, frac: Vec2, button: number): void;
  /** When true, left-drag paints (wall drawing) instead of panning. */
  isPaintMode(): boolean;
  onPaintStart(tile: Vec2): void;
  onPaintMove(tile: Vec2): void;
  onPaintEnd(tile: Vec2): void;
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
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  let down = false;
  let dragging = false;
  let painting = false;
  let downAt = { x: 0, y: 0 };
  let last = { x: 0, y: 0 };
  let lastPaintTile: Vec2 | null = null;

  app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
    down = true;
    dragging = false;
    downAt = { x: e.global.x, y: e.global.y };
    last = { ...downAt };
    if (e.button === 0 && cb.isPaintMode()) {
      const tile = pickTile(e);
      if (tile) {
        painting = true;
        lastPaintTile = tile;
        cb.onPaintStart(tile);
      }
    }
  });

  app.stage.on('pointermove', (e: FederatedPointerEvent) => {
    if (down && painting) {
      const tile = pickTile(e);
      if (tile && (tile.x !== lastPaintTile?.x || tile.y !== lastPaintTile?.y)) {
        lastPaintTile = tile;
        cb.onPaintMove(tile);
      }
    } else if (down) {
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
    if (painting) {
      const tile = pickTile(e) ?? lastPaintTile;
      if (tile) cb.onPaintEnd(tile);
    } else if (down && !dragging) {
      const tile = pickTile(e);
      if (tile) cb.onClickTile(tile, pickFrac(e), e.button);
    }
    down = false;
    dragging = false;
    painting = false;
    lastPaintTile = null;
  });

  app.stage.on('pointerupoutside', () => {
    if (painting && lastPaintTile) cb.onPaintEnd(lastPaintTile);
    down = false;
    dragging = false;
    painting = false;
    lastPaintTile = null;
  });

  app.canvas.addEventListener(
    'wheel',
    (ev: WheelEvent) => {
      ev.preventDefault();
      camera.zoomAt(ev.offsetX, ev.offsetY, ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    },
    { passive: false },
  );

  function pickFrac(e: FederatedPointerEvent): Vec2 {
    // toLocal accounts for camera pan/zoom — never hand-roll that math.
    const local = worldLayer.toLocal(e.global);
    return screenToTile(local.x, local.y);
  }

  function pickTile(e: FederatedPointerEvent): Vec2 | null {
    const t = pickFrac(e);
    const tx = Math.floor(t.x);
    const ty = Math.floor(t.y);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return null;
    return { x: tx, y: ty };
  }
}
