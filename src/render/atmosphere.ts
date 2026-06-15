// Day/night cycle: a single full-screen color overlay that lerps through
// noon → dusk → night → dawn over a slow loop (the v2 pack's daynight stops).
// Screen-space (added to the stage, not the panned world). Also exposes a
// 0..1 "night" amount so house windows can glow after dark. Near-zero cost,
// big mood payoff — toggle with 'n'.

import { Graphics } from 'pixi.js';

const DAY_MS = 200_000; // full day-night loop (~3.3 min)

interface Stop { at: number; color: number; alpha: number }

// phase 0 = noon; quarter points dusk/night/dawn; wraps back to noon.
const STOPS: Stop[] = [
  { at: 0.0, color: 0xffffff, alpha: 0.0 }, // noon
  { at: 0.25, color: 0xe8842b, alpha: 0.26 }, // dusk
  { at: 0.5, color: 0x16265e, alpha: 0.44 }, // night
  { at: 0.75, color: 0xffd98a, alpha: 0.16 }, // dawn
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
  enabled = true;
  private night = 0;

  update(clock: number, w: number, h: number): void {
    if (!this.enabled) {
      this.g.visible = false;
      this.night = 0;
      return;
    }
    this.g.visible = true;
    const t = (clock / DAY_MS) % 1;

    let i = 0;
    while (i < STOPS.length - 1 && t >= STOPS[i + 1].at) i++;
    const a = STOPS[i];
    const b = STOPS[i + 1];
    const f = (t - a.at) / (b.at - a.at);
    const color = lerpColor(a.color, b.color, f);
    const alpha = lerp(a.alpha, b.alpha, f);

    this.g.clear();
    this.g.rect(0, 0, w, h).fill({ color, alpha });

    // night amount peaks at midnight (t=0.5), off by mid-dusk/mid-dawn.
    this.night = Math.max(0, Math.min(1, 1 - Math.abs(t - 0.5) / 0.26));
  }

  /** 0 (day) .. 1 (deep night) — drives house window glow. */
  nightAmount(): number {
    return this.night;
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }
}
