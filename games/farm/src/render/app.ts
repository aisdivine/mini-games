import { Application, Container } from 'pixi.js';

export interface Layers {
  /** Pannable/scalable board root; the whole farm lives under this. */
  board: Container;
}

export async function createApp(): Promise<{ app: Application; layers: Layers }> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0x5b8a3a, // meadow green border around the farm
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  });
  document.getElementById('game')!.appendChild(app.canvas);

  const board = new Container();
  app.stage.addChild(board);

  return { app, layers: { board } };
}
