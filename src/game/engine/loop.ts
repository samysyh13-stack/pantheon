// Deterministic fixed-tick game loop.
//
// Simulation runs at 60 Hz (TICK_MS = 1000/60). The render rate is decoupled
// and can run at higher refresh (120 / 144 Hz) — the loop uses an accumulator
// to keep sim tick-rate stable regardless of display Hz.
//
// Per ADR-0006, no wall-clock time enters simulation. `onTick` receives a
// constant dt = 1/60. Wall-clock is only consulted between ticks to decide
// *how many* ticks to advance per rAF, which keeps the sim deterministic on
// replay.

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;
export const TICK_DT = 1 / TICK_HZ;

// Cap on accumulator to avoid "spiral of death" after tab-backgrounding.
// 250 ms = ~15 ticks max in a single rAF.
const MAX_ACCUM_MS = 250;

export type TickCallback = (dt: number, tick: number) => void;

export interface LoopHandle {
  start: () => void;
  stop: () => void;
  readonly tick: number;
  readonly running: boolean;
}

export function createLoop(onTick: TickCallback): LoopHandle {
  let tick = 0;
  let running = false;
  let lastMs = 0;
  let accMs = 0;
  let rafId = 0;

  const frame = (nowMs: number) => {
    if (!running) return;
    const deltaMs = Math.min(nowMs - lastMs, MAX_ACCUM_MS);
    lastMs = nowMs;
    accMs += deltaMs;

    while (accMs >= TICK_MS) {
      onTick(TICK_DT, tick);
      tick++;
      accMs -= TICK_MS;
    }

    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastMs = performance.now();
      accMs = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId !== 0) cancelAnimationFrame(rafId);
      rafId = 0;
    },
    get tick() {
      return tick;
    },
    get running() {
      return running;
    },
  };
}
