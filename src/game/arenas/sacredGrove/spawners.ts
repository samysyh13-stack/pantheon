// Sacred Grove pickup spawner logic.
//
// Spawns pickups on a 12-18 s alternating interval per DESIGN §7:
//   - health_shard: restores 50 HP
//   - ult_charge:   +15% ult charge instantly
//   - haste_glyph:  +30% move speed for 4 s (rare — every 3rd cycle)
//
// Determinism (ADR-0006): spawn interval jitter and slot selection are
// driven by a seeded RNG so the sequence is reproducible in replay.
// Wall-clock is never consulted — the scheduler advances the state.

import type { Scheduler } from '../../engine/scheduler';
import type { Rng } from '../../engine/random';
import { PICKUP_SPAWN_POSITIONS, type Vec3 } from './colliders';

export type PickupKind = 'health_shard' | 'ult_charge' | 'haste_glyph';

export interface Pickup {
  id: number;
  kind: PickupKind;
  position: Vec3;
  spawnTick: number;
}

export interface PickupSpawnerDeps {
  scheduler: Scheduler;
  rng: Rng;
  onSpawn: (p: Pickup) => void;
}

/** Next-tick delay in 60-Hz ticks between spawns. 12-18 s range per §7. */
const MIN_DELAY_TICKS = 12 * 60;
const MAX_DELAY_TICKS = 18 * 60;

/** Cycle: health → ult → health → ult → haste (rare). Deterministic. */
const CYCLE: readonly PickupKind[] = [
  'health_shard',
  'ult_charge',
  'health_shard',
  'ult_charge',
  'haste_glyph',
] as const;

export interface PickupSpawner {
  start: () => void;
  stop: () => void;
  readonly spawnCount: number;
}

export function createPickupSpawner(deps: PickupSpawnerDeps): PickupSpawner {
  const { scheduler, rng, onSpawn } = deps;

  let nextId = 1;
  let cycleIndex = 0;
  let taskId = 0;
  let spawnCount = 0;
  let running = false;

  const pickDelay = (): number => {
    const range = MAX_DELAY_TICKS - MIN_DELAY_TICKS;
    return MIN_DELAY_TICKS + Math.floor(rng.next() * range);
  };

  const pickPosition = (): Vec3 => {
    const i = rng.int(0, PICKUP_SPAWN_POSITIONS.length);
    return PICKUP_SPAWN_POSITIONS[i] ?? PICKUP_SPAWN_POSITIONS[0]!;
  };

  const spawn = (tick: number): void => {
    if (!running) return;
    const kind = CYCLE[cycleIndex % CYCLE.length]!;
    cycleIndex++;
    const position = pickPosition();
    const pickup: Pickup = { id: nextId++, kind, position, spawnTick: tick };
    onSpawn(pickup);
    spawnCount++;
    // Schedule the next spawn. Repeating would have fixed intervals; we
    // want jitter for gameplay feel so we re-schedule each time.
    taskId = scheduler.schedule(spawn, pickDelay());
  };

  return {
    start() {
      if (running) return;
      running = true;
      taskId = scheduler.schedule(spawn, pickDelay());
    },
    stop() {
      running = false;
      if (taskId > 0) {
        scheduler.cancel(taskId);
        taskId = 0;
      }
    },
    get spawnCount() {
      return spawnCount;
    },
  };
}
