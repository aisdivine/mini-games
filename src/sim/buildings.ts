// Worker recruitment + the awaitingWorker side of the production state
// machine. The rest of the cycle is driven by the bound worker in units.ts;
// building.state mirrors it for the HUD.

import type { SimEvent } from './events';
import type { World } from './world';

export function updateBuildings(world: World, _events: SimEvent[]): void {
  assignWorkers(world);
}

// Idle peasants at the campfire claim the longest-waiting building. Nearest
// idle peasant wins; FIFO over buildings keeps every workplace eventually
// staffed.
function assignWorkers(world: World): void {
  while (world.workerWanted.length > 0) {
    const buildingId = world.workerWanted[0];
    const building = world.buildings.get(buildingId);
    if (!building || building.workerId !== null) {
      world.workerWanted.shift();
      continue;
    }
    let best = null;
    let bestDist = Infinity;
    for (const unit of world.units.values()) {
      if (unit.role !== 'peasant' || unit.workplaceId !== null) continue;
      if (unit.task.kind !== 'idle' && !(unit.task.kind === 'goTo' && unit.task.then.kind === 'none')) {
        continue;
      }
      const d =
        Math.abs(unit.pos.x - building.accessTile.x) +
        Math.abs(unit.pos.y - building.accessTile.y);
      if (d < bestDist) {
        bestDist = d;
        best = unit;
      }
    }
    if (!best) return; // no idle peasants; keep waiting
    world.workerWanted.shift();
    building.workerId = best.id;
    best.workplaceId = building.id;
    best.path = null;
    best.task = { kind: 'goTo', dest: { ...building.accessTile }, then: { kind: 'startWork' } };
  }
}
