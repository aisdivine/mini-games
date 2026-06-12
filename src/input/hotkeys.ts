import type { Camera } from '../render/camera';
import { KEY_PAN_SPEED } from '../config';

const PAN_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export class Hotkeys {
  private pressed = new Set<string>();
  private actions = new Map<string, () => void>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (PAN_KEYS.includes(e.key)) e.preventDefault();
      this.pressed.add(e.key);
      const action = this.actions.get(e.key);
      if (action && !e.repeat) action();
    });
    window.addEventListener('keyup', (e) => this.pressed.delete(e.key));
    window.addEventListener('blur', () => this.pressed.clear());
  }

  /** Register a one-shot action for a key (debug cheats, ESC cancel, ...). */
  bind(key: string, action: () => void): void {
    this.actions.set(key, action);
  }

  /** Called once per render frame for held-key panning. */
  update(camera: Camera): void {
    let dx = 0;
    let dy = 0;
    if (this.pressed.has('ArrowLeft')) dx += KEY_PAN_SPEED;
    if (this.pressed.has('ArrowRight')) dx -= KEY_PAN_SPEED;
    if (this.pressed.has('ArrowUp')) dy += KEY_PAN_SPEED;
    if (this.pressed.has('ArrowDown')) dy -= KEY_PAN_SPEED;
    if (dx || dy) camera.panBy(dx, dy);
  }
}
