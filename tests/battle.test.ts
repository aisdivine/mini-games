import { describe, it, expect } from 'vitest';
import { Sim } from '../src/sim/sim';
import { createWorld, createBattleWorld } from '../src/sim/world';
import { isSoldier, BATTLE_BASE_ENEMIES, MAP_W, type SoldierType } from '../src/config';

function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    sim.drainEvents();
  }
}

const countRole = (sim: Sim, pred: (role: string) => boolean): number =>
  [...sim.world.units.values()].filter((u) => pred(u.role)).length;

describe('home world has no on-map combat', () => {
  it('has no enemies on the home map (combat moved to the battlefield)', () => {
    const w = createWorld(5);
    expect([...w.units.values()].some((u) => u.role === 'raider')).toBe(false);
    expect([...w.buildings.values()].some((b) => b.owner === 'enemy')).toBe(false);
    expect(w.kind).toBe('home');
    expect(w.battlesWon).toBe(0);
  });
});

describe('battlefield', () => {
  it('musters the player army west and a scaled enemy host east', () => {
    const army: SoldierType[] = ['knight', 'archer', 'spearman'];
    const w = createBattleWorld(1, 0, army);
    expect(w.kind).toBe('battle');
    expect(w.buildings.size).toBe(0); // no keep/economy
    const soldiers = [...w.units.values()].filter((u) => isSoldier(u.role));
    const raiders = [...w.units.values()].filter((u) => u.role === 'raider');
    expect(soldiers.length).toBe(army.length);
    expect(raiders.length).toBe(BATTLE_BASE_ENEMIES); // level 0
    expect(soldiers.every((u) => u.pos.x < MAP_W / 2)).toBe(true); // west
    expect(raiders.every((u) => u.pos.x > MAP_W / 2)).toBe(true); // east
    expect([...w.units.values()].some((u) => u.role === 'peasant')).toBe(false);
  });

  it('higher level spawns more, tougher enemies', () => {
    const lvl0 = createBattleWorld(1, 0, ['knight']);
    const lvl3 = createBattleWorld(1, 3, ['knight']);
    const enemies = (w: ReturnType<typeof createBattleWorld>): number =>
      [...w.units.values()].filter((u) => u.role === 'raider').length;
    expect(enemies(lvl3)).toBeGreaterThan(enemies(lvl0));
    const hp0 = [...lvl0.units.values()].find((u) => u.role === 'raider')!.hp;
    const hp3 = [...lvl3.units.values()].find((u) => u.role === 'raider')!.hp;
    expect(hp3).toBeGreaterThan(hp0);
  });

  it('enemy troops advance west toward the player army', () => {
    const sim = new Sim(1, createBattleWorld(1, 0, ['knight', 'knight']));
    const avgEnemyX = (): number => {
      const xs = [...sim.world.units.values()].filter((u) => u.role === 'raider').map((u) => u.pos.x);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    const before = avgEnemyX();
    run(sim, 80);
    expect(avgEnemyX()).toBeLessThan(before); // they marched toward the soldiers
  });

  it('a strong army wipes the enemy and survives (victory condition)', () => {
    const army: SoldierType[] = Array.from({ length: 12 }, () => 'knight');
    const sim = new Sim(1, createBattleWorld(1, 0, army));
    // Pull the enemy host next to the army so the fight resolves quickly.
    const soldier = [...sim.world.units.values()].find((u) => isSoldier(u.role))!;
    for (const u of sim.world.units.values()) {
      if (u.role === 'raider') u.pos = { x: soldier.pos.x + 2, y: soldier.pos.y };
    }
    run(sim, 700);
    expect(countRole(sim, (r) => r === 'raider')).toBe(0); // enemy wiped
    expect(countRole(sim, isSoldier)).toBeGreaterThan(0); // some knights survived
    expect(sim.world.outcome).toBe('playing'); // battle never sets a game-over
  });

  it('never triggers the economic game-over (no peasants on the field)', () => {
    const sim = new Sim(1, createBattleWorld(1, 0, ['knight']));
    run(sim, 1000); // well past EAT_INTERVAL_TICKS
    expect(sim.world.outcome).toBe('playing');
  });
});
