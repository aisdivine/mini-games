// One-shot notifications from sim to renderer/HUD, drained once per frame.

import type { Vec2 } from './world';

export type SimEvent =
  | { type: 'rejected'; reason: string }
  | { type: 'message'; text: string }
  | { type: 'buildingPlaced'; id: number }
  | { type: 'buildingRemoved'; id: number }
  | { type: 'arrow'; from: Vec2; to: Vec2 }
  | { type: 'unitDied'; id: number; role: string }
  | { type: 'raidStarted' }
  | { type: 'gameOver'; outcome: 'won' | 'lost'; reason: string };
