// Worker recruitment + the awaitingWorker side of the production state
// machine. The rest of the cycle is driven by the bound worker in units.ts;
// building.state mirrors it for the HUD.

import { FISH_STOCK, TREE_WOOD } from '../config';
import type { SimEvent } from './events';
import type { World } from './world';

export function updateBuildings(world: World, _events: SimEvent[]): void {
  assignWorkers(world);
  regrowTrees(world);
  restockFish(world);
}

// Stumps grow back into trees after their regrow timer, keeping the forest
// (and the wood supply) sustainable without spawning logic.
function regrowTrees(world: World): void {
  for (const tree of world.trees.values()) {
    if (tree.regrowAt !== null && world.tick >= tree.regrowAt) {
      tree.wood = TREE_WOOD;
      tree.regrowAt = null;
    }
  }
}

// Fished-out shoals restock after their timer — same sustainability trick as
// the forest, so a fishery is a renewable food source.
function restockFish(world: World): void {
  for (const shoal of world.fish.values()) {
    if (shoal.regrowAt !== null && world.tick >= shoal.regrowAt) {
      shoal.fish = FISH_STOCK;
      shoal.regrowAt = null;
    }
  }
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
