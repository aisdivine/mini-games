// Composition root — the only file that knows both the sim and the renderer.

import { createApp } from './render/app';
import { Camera } from './render/camera';
import { createGroundView } from './render/views/groundView';
import { OverlayView } from './render/views/overlayView';
import { setupPointer } from './input/pointer';
import { Hotkeys } from './input/hotkeys';
import { Hud } from './ui/hud';
import { tileToScreen, type Vec2 } from './render/iso';
import { MAP_W, MAP_H, TILE_H } from './config';

async function start(): Promise<void> {
  const { app, layers } = await createApp();
  const camera = new Camera(layers.world);
  const hud = new Hud();
  const hotkeys = new Hotkeys();

  layers.ground.addChild(createGroundView());
  const overlay = new OverlayView();
  layers.overlay.addChild(overlay.container);

  // Start centered on the middle of the map.
  const center = tileToScreen(MAP_W / 2, MAP_H / 2);
  camera.centerOn(center.x, center.y + TILE_H / 2, app.screen.width, app.screen.height);

  let hovered: Vec2 | null = null;

  setupPointer(app, layers.world, camera, {
    onHoverTile(tile) {
      hovered = tile;
      if (tile) overlay.setHoverTile(tile.x, tile.y);
      else overlay.setHoverTile(-1, -1);
    },
    onClickTile(tile) {
      hud.showMessage(`Clicked tile (${tile.x}, ${tile.y})`);
    },
  });

  hud.setTopBar(`<span class="stat">Stronghold — M1: map &amp; camera</span>`);

  app.ticker.add(() => {
    hotkeys.update(camera);
    hud.setDebug(
      hovered ? `tile (${hovered.x}, ${hovered.y})` : 'tile —',
    );
  });
}

start();
