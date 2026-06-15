// Screen-space lighting mode. Default is device-based: phones run in NIGHT mode
// (a soft, easy-on-the-eyes dark wash over the whole screen + a dimmed HUD),
// desktops run in DAY mode (no tint). A 'cycle' mode (slow day↔night loop) is
// also available and can be toggled with 'n'. Added to the stage, not the
// panned world, so it covers everything.

import { Graphics } from 'pixi.js';

export type AtmoMode = 'day' | 'night' | 'cycle';

const DAY_MS = 200_000; // full day-night loop for 'cycle' mode (~3.3 min)

// The night wash is intentionally very light — most of the "night" look comes
// from darkening the sand/ground itself (see main.ts ground tint), which is
// easier on the eyes and more attractive than a heavy veil over everything.
const NIGHT = { color: 0x2a3358, alpha: 0.12 };

interface Stop { at: number; color: number; alpha: number }
const STOPS: Stop[] = [
  { at: 0.0, color: 0xffffff, alpha: 0.0 }, // noon
  { at: 0.25, color: 0xe8842b, alpha: 0.2 }, // dusk
  { at: 0.5, color: NIGHT.color, alpha: NIGHT.alpha }, // night
  { at: 0.75, color: 0xffd98a, alpha: 0.13 }, // dawn
  { at: 1.0, color: 0xffffff, alpha: 0.0 }, // noon (wrap)
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (
    (Math.round(lerp(ar, br, t)) << 16) |
    (Math.round(lerp(ag, bg, t)) << 8) |
    Math.round(lerp(ab, bb, t))
  );
}

export class Atmosphere {
  readonly g = new Graphics();
  mode: AtmoMode = 'day';
  private night = 0; // 0 (day) .. 1 (deep night) — drives the dark HUD + window glow

  update(clock: number, w: number, h: number): void {
    let color: number;
    let alpha: number;

    if (this.mode === 'day') {
      this.night = 0;
      this.g.visible = false;
      return;
    } else if (this.mode === 'night') {
      color = NIGHT.color;
      alpha = NIGHT.alpha;
      this.night = 1;
    } else {
      // cycle
      const t = (clock / DAY_MS) % 1;
      let i = 0;
      while (i < STOPS.length - 1 && t >= STOPS[i + 1].at) i++;
      const a = STOPS[i];
      const b = STOPS[i + 1];
      const f = (t - a.at) / (b.at - a.at);
      color = lerpColor(a.color, b.color, f);
      alpha = lerp(a.alpha, b.alpha, f);
      this.night = Math.max(0, Math.min(1, 1 - Math.abs(t - 0.5) / 0.26));
    }

    this.g.visible = true;
    this.g.clear();
    this.g.rect(0, 0, w, h).fill({ color, alpha });
  }

  /** 0 (day) .. 1 (deep night) — drives the dark HUD theme and window glow. */
  nightAmount(): number {
    return this.night;
  }

  setMode(m: AtmoMode): void {
    this.mode = m;
  }

  /** 'n' key: flip between day and night (manual override). */
  toggle(): void {
    this.mode = this.mode === 'night' ? 'day' : 'night';
  }
}
