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

// Any drag beyond this many screen px is a pan, not a click/tap.
const DRAG_THRESHOLD = 8;

// One unified pointer pipeline drives mouse AND touch (Pixi normalizes both to
// pointer events). Single pointer = pan / tap / paint; two pointers = pinch zoom.
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

  // Active pointers by id, for pinch-to-zoom on touch.
  const pts = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  let wasMulti = false; // a pinch happened this gesture → suppress the closing tap

  function pinchMetrics(): { dist: number; mx: number; my: number } {
    const it = pts.values();
    const a = it.next().value!;
    const b = it.next().value!;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  function reset(): void {
    down = false;
    dragging = false;
    painting = false;
    lastPaintTile = null;
  }

  app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
    pts.set(e.pointerId, { x: e.global.x, y: e.global.y });
    down = true;
    dragging = false;
    downAt = { x: e.global.x, y: e.global.y };
    last = { ...downAt };

    if (pts.size >= 2) {
      // entering a pinch: cancel any in-progress paint, start measuring
      wasMulti = true;
      painting = false;
      pinchDist = pinchMetrics().dist;
      return;
    }
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
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.global.x, y: e.global.y });

    // Two fingers → pinch zoom around the midpoint; it owns the whole gesture.
    if (pts.size >= 2) {
      const m = pinchMetrics();
      if (pinchDist > 0 && m.dist > 0) camera.zoomAt(m.mx, m.my, m.dist / pinchDist);
      pinchDist = m.dist;
      return;
    }

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
      if (dragging) camera.panBy(e.global.x - last.x, e.global.y - last.y);
      last = { x: e.global.x, y: e.global.y };
    }
    cb.onHoverTile(pickTile(e));
  });

  // commit=true only for a genuine pointerup (eligible to register a tap).
  function release(e: FederatedPointerEvent, commit: boolean): void {
    pts.delete(e.pointerId);

    if (pts.size >= 1) {
      // fingers remain — still a multi-touch gesture, don't tap/place
      pinchDist = 0;
      if (pts.size === 1) {
        const rem = pts.values().next().value!;
        last = { x: rem.x, y: rem.y }; // resync pan origin so it doesn't jump
        downAt = { ...last };
        dragging = false;
      }
      return;
    }

    // last finger up
    if (painting) {
      const tile = (commit ? pickTile(e) : null) ?? lastPaintTile;
      if (tile) cb.onPaintEnd(tile);
    } else if (commit && down && !dragging && !wasMulti) {
      const tile = pickTile(e);
      if (tile) cb.onClickTile(tile, pickFrac(e), e.button);
    }
    wasMulti = false;
    reset();
  }

  app.stage.on('pointerup', (e: FederatedPointerEvent) => release(e, true));
  app.stage.on('pointerupoutside', (e: FederatedPointerEvent) => release(e, false));
  app.stage.on('pointercancel', (e: FederatedPointerEvent) => release(e, false));

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
