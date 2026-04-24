// Deterministic tick-based task scheduler.
//
// Tasks are scheduled by tick-count delay, not wall-clock. Ordering within
// a tick is FIFO by schedule time (seq counter). Per ADR-0006: no Math.random
// in priority resolution, no wall-clock, no Date.now.
//
// Semantics:
//   schedule(fn, N) — fn fires when currentTick advances by N. So
//     schedule(fn, 0) fires on the very next advance().
//     schedule(fn, 5) fires on advance(5).
//   advance(K) — increments currentTick by 1 per iteration, fires tasks
//     whose dueTick <= currentTick-after-increment. fn receives the
//     current tick number.

export type Task = (tick: number) => void;

interface Entry {
  task: Task;
  dueTick: number;
  repeatEvery: number; // 0 = one-shot
  seq: number;
}

export interface Scheduler {
  schedule: (task: Task, delayTicks: number) => number;
  scheduleRepeating: (task: Task, intervalTicks: number, startDelayTicks?: number) => number;
  cancel: (id: number) => boolean;
  advance: (ticks?: number) => void;
  readonly currentTick: number;
  readonly pendingCount: number;
}

export function createScheduler(startTick = 0): Scheduler {
  let cur = startTick;
  let nextId = 1;
  let nextSeq = 0;
  const entries = new Map<number, Entry>();

  const schedule = (task: Task, delayTicks: number): number => {
    if (delayTicks < 0) throw new Error('scheduler.schedule: delayTicks must be >= 0');
    const id = nextId++;
    entries.set(id, { task, dueTick: cur + delayTicks, repeatEvery: 0, seq: nextSeq++ });
    return id;
  };

  const scheduleRepeating = (task: Task, interval: number, startDelay = 0): number => {
    if (interval <= 0) throw new Error('scheduler.scheduleRepeating: interval must be > 0');
    if (startDelay < 0) throw new Error('scheduler.scheduleRepeating: startDelay must be >= 0');
    const id = nextId++;
    entries.set(id, { task, dueTick: cur + startDelay, repeatEvery: interval, seq: nextSeq++ });
    return id;
  };

  const cancel = (id: number): boolean => entries.delete(id);

  const advance = (ticks = 1): void => {
    for (let i = 0; i < ticks; i++) {
      cur++;
      const due: Array<[number, Entry]> = [];
      for (const [id, e] of entries) {
        if (e.dueTick <= cur) due.push([id, e]);
      }
      due.sort((a, b) => a[1].seq - b[1].seq);
      for (const [id, e] of due) {
        e.task(cur);
        if (e.repeatEvery > 0) {
          e.dueTick = cur + e.repeatEvery;
        } else {
          entries.delete(id);
        }
      }
    }
  };

  return {
    schedule,
    scheduleRepeating,
    cancel,
    advance,
    get currentTick() {
      return cur;
    },
    get pendingCount() {
      return entries.size;
    },
  };
}
