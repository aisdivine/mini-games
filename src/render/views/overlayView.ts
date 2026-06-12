import { Container, Graphics } from 'pixi.js';
import { MAP_W, MAP_H } from '../../config';
import { diamondPoints } from '../iso';

export class OverlayView {
  readonly container = new Container();
  private hover = new Graphics();

  constructor() {
    this.container.addChild(this.hover);
  }

  setHoverTile(tx: number, ty: number): void {
    this.hover.clear();
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
    this.hover
      .poly(diamondPoints(tx, ty))
      .fill({ color: 0xffffff, alpha: 0.15 })
      .stroke({ width: 2, color: 0xffe066 });
  }
}
