// A* on the tile grid. 4-directional, Manhattan heuristic, flat typed arrays
// reused across calls via a generation counter. ~4096 nodes — fast enough to
// repath freely.

import { BUILDINGS, MAP_W, MAP_H } from '../config';
import { inBounds, isPassable } from './grid';
import type { Building, Vec2, World } from './world';

const N = MAP_W * MAP_H;
const gScore = new Float32Array(N);
const cameFrom = new Int32Array(N);
const mark = new Int32Array(N); // generation when a node was touched
const closed = new Uint8Array(N); // valid only when mark matches generation
let gen = 0;

// Binary min-heap of node indices keyed by fScore. Reset per call, so it only
// ever contains current-generation nodes.
const heapNodes = new Int32Array(N * 4);
const heapCost = new Float32Array(N * 4);
let heapSize = 0;

function heapPush(node: number, cost: number): void {
  let i = heapSize++;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapCost[p] <= cost) break;
    heapNodes[i] = heapNodes[p];
    heapCost[i] = heapCost[p];
    i = p;
  }
  heapNodes[i] = node;
  heapCost[i] = cost;
}

function heapPop(): number {
  const top = heapNodes[0];
  heapSize--;
  const lastNode = heapNodes[heapSize];
  const lastCost = heapCost[heapSize];
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let m = i;
    let mc = lastCost;
    if (l < heapSize && heapCost[l] < mc) {
      m = l;
      mc = heapCost[l];
    }
    if (r < heapSize && heapCost[r] < mc) {
      m = r;
      mc = heapCost[r];
    }
    if (m === i) break;
    heapNodes[i] = heapNodes[m];
    heapCost[i] = heapCost[m];
    i = m;
  }
  heapNodes[i] = lastNode;
  heapCost[i] = lastCost;
  return top;
}

/** Path of integer tile waypoints from start to goal (goal included, start
 *  excluded). Null if unreachable or goal impassable. */
export function findPath(world: World, start: Vec2, goal: Vec2): Vec2[] | null {
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  const gx = Math.floor(goal.x);
  const gy = Math.floor(goal.y);
  if (!inBounds(sx, sy) || !isPassable(world, gx, gy)) return null;
  if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

  gen++;
  heapSize = 0;
  const startIdx = sy * MAP_W + sx;
  const goalIdx = gy * MAP_W + gx;
  mark[startIdx] = gen;
  closed[startIdx] = 0;
  gScore[startIdx] = 0;
  cameFrom[startIdx] = -1;
  heapPush(startIdx, Math.abs(gx - sx) + Math.abs(gy - sy));

  while (heapSize > 0) {
    const cur = heapPop();
    if (closed[cur]) continue; // stale duplicate heap entry
    closed[cur] = 1;
    if (cur === goalIdx) {
      const path: Vec2[] = [];
      for (let n = cur; n !== startIdx; n = cameFrom[n]) {
        path.push({ x: n % MAP_W, y: (n / MAP_W) | 0 });
      }
      path.reverse();
      return path;
    }
    const cx = cur % MAP_W;
    const cy = (cur / MAP_W) | 0;
    visit(cx + 1, cy);
    visit(cx - 1, cy);
    visit(cx, cy + 1);
    visit(cx, cy - 1);

    function visit(nx: number, ny: number): void {
      if (!isPassable(world, nx, ny)) return;
      const ni = ny * MAP_W + nx;
      const ng = gScore[cur] + 1;
      if (mark[ni] !== gen) {
        mark[ni] = gen;
        closed[ni] = 0;
        gScore[ni] = ng;
        cameFrom[ni] = cur;
        heapPush(ni, ng + Math.abs(gx - nx) + Math.abs(gy - ny));
      } else if (ng < gScore[ni] && !closed[ni]) {
        gScore[ni] = ng;
        cameFrom[ni] = cur;
        heapPush(ni, ng + Math.abs(gx - nx) + Math.abs(gy - ny));
      }
    }
  }
  return null;
}

/** All passable tiles orthogonally adjacent to a building's footprint. */
export function adjacentTiles(world: World, b: Building): Vec2[] {
  const def = BUILDINGS[b.type];
  const out: Vec2[] = [];
  const { x, y } = b.tile;
  const { w, h } = def.size;
  for (let dx = 0; dx < w; dx++) {
    if (isPassable(world, x + dx, y - 1)) out.push({ x: x + dx, y: y - 1 });
    if (isPassable(world, x + dx, y + h)) out.push({ x: x + dx, y: y + h });
  }
  for (let dy = 0; dy < h; dy++) {
    if (isPassable(world, x - 1, y + dy)) out.push({ x: x - 1, y: y + dy });
    if (isPassable(world, x + w, y + dy)) out.push({ x: x + w, y: y + dy });
  }
  return out;
}

/** Shortest path to any tile adjacent to the building, nearest candidates
 *  first. Null if none reachable. */
export function findPathToBuilding(world: World, start: Vec2, b: Building): Vec2[] | null {
  const candidates = adjacentTiles(world, b).sort(
    (a, c) =>
      Math.abs(a.x - start.x) + Math.abs(a.y - start.y) -
      (Math.abs(c.x - start.x) + Math.abs(c.y - start.y)),
  );
  for (const tile of candidates) {
    const path = findPath(world, start, tile);
    if (path) return path;
  }
  return null;
}
