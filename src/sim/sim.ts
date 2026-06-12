// Tick orchestration. Fixed order every tick:
// commands -> buildings -> units -> population -> combat -> outcome.

import { applyCommand, type Command } from './commands';
import type { SimEvent } from './events';
import { createWorld, type World } from './world';
import { updateBuildings } from './buildings';
import { updateUnits } from './units';
import { updatePopulation } from './population';
import { updateCombat } from './combat';

export class Sim {
  world: World;
  private queue: Command[] = [];
  private events: SimEvent[] = [];

  constructor(seed: number, world?: World) {
    this.world = world ?? createWorld(seed);
  }

  enqueue(cmd: Command): void {
    this.queue.push(cmd);
  }

  tick(): void {
    const w = this.world;
    if (w.outcome !== 'playing') return;
    w.tick++;
    for (const cmd of this.queue) applyCommand(w, cmd, this.events);
    this.queue.length = 0;
    updateBuildings(w, this.events);
    updateUnits(w, this.events);
    updatePopulation(w, this.events);
    updateCombat(w, this.events);
  }

  drainEvents(): SimEvent[] {
    if (this.events.length === 0) return this.events;
    const out = this.events;
    this.events = [];
    return out;
  }
}
