import { Application, Container } from 'pixi.js';

export interface Layers {
  /** Pannable/zoomable root. All world-space content lives under this. */
  world: Container;
  /** Static terrain, baked once. Never sorted. */
  ground: Container;
  /** Buildings + units, depth-sorted by zIndex every frame. */
  entities: Container;
  /** Hover highlight, placement ghost, debug paths. Always on top of world. */
  overlay: Container;
}

export async function createApp(): Promise<{ app: Application; layers: Layers }> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0xefe7cf, // pale sand
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  });
  document.getElementById('game')!.appendChild(app.canvas);

  const world = new Container();
  const ground = new Container();
  const entities = new Container();
  entities.sortableChildren = true;
  const overlay = new Container();

  world.addChild(ground, entities, overlay);
  app.stage.addChild(world);

  return { app, layers: { world, ground, entities, overlay } };
}
