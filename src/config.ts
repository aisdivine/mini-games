// All tunables live here. Balance is iterated by editing this table, not code.

export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_W = 64;
export const MAP_H = 64;

export const SIM_TICKS_PER_SEC = 20;
export const SIM_DT_MS = 1000 / SIM_TICKS_PER_SEC;
export const MAX_ACCUM_MS = 250; // clamp after tab-return so we never spiral

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 1.1;
export const KEY_PAN_SPEED = 12; // px per frame at scale 1
