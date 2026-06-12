// Seeded RNG (mulberry32). The sim never calls Math.random() — determinism
// buys reproducible bugs and headless tests.

export function nextRand(world: { rngState: number }): number {
  let t = (world.rngState = (world.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(world: { rngState: number }, maxExclusive: number): number {
  return Math.floor(nextRand(world) * maxExclusive);
}
