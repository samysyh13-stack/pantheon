import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from '../../src/game/engine/scheduler';

describe('createScheduler', () => {
  it('starts at tick 0 by default', () => {
    const s = createScheduler();
    expect(s.currentTick).toBe(0);
  });

  it('honors a custom start tick', () => {
    const s = createScheduler(100);
    expect(s.currentTick).toBe(100);
  });

  it('runs a task scheduled with delay 0 on the next advance', () => {
    const s = createScheduler();
    const fn = vi.fn();
    s.schedule(fn, 0);
    expect(fn).not.toHaveBeenCalled();
    s.advance();
    expect(fn).toHaveBeenCalledOnce();
    // post-increment semantics: delay-0 fires during the 1st advance, cur=1
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('defers a task until its delay elapses', () => {
    const s = createScheduler();
    const fn = vi.fn();
    s.schedule(fn, 3);
    s.advance(); // tick 0 -> 1, nothing fires
    expect(fn).not.toHaveBeenCalled();
    s.advance(); // tick 1 -> 2
    expect(fn).not.toHaveBeenCalled();
    s.advance(); // tick 2 -> 3 — now it's due
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('fires tasks in FIFO order within the same tick', () => {
    const s = createScheduler();
    const order: string[] = [];
    s.schedule(() => order.push('a'), 0);
    s.schedule(() => order.push('b'), 0);
    s.schedule(() => order.push('c'), 0);
    s.advance();
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('runs a repeating task at the configured interval', () => {
    const s = createScheduler();
    const fn = vi.fn();
    s.scheduleRepeating(fn, 2);
    s.advance(10); // ticks 0,2,4,6,8 = 5 invocations
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('honors startDelay on a repeating task', () => {
    const s = createScheduler();
    const fn = vi.fn();
    s.scheduleRepeating(fn, 3, 5);
    s.advance(4);
    expect(fn).not.toHaveBeenCalled();
    s.advance(1); // now at tick 5 — fires
    expect(fn).toHaveBeenCalledTimes(1);
    s.advance(6); // ticks 6,7,8,9,10,11 — next due at 8, 11
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('cancel removes a pending task', () => {
    const s = createScheduler();
    const fn = vi.fn();
    const id = s.schedule(fn, 2);
    expect(s.cancel(id)).toBe(true);
    s.advance(5);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel returns false on unknown id', () => {
    const s = createScheduler();
    expect(s.cancel(9999)).toBe(false);
  });

  it('pendingCount reflects outstanding tasks', () => {
    const s = createScheduler();
    s.schedule(() => {}, 5);
    s.schedule(() => {}, 10);
    s.scheduleRepeating(() => {}, 2);
    expect(s.pendingCount).toBe(3);
    s.advance(5); // one-shot at delay=5 fires and is removed; repeater keeps going
    expect(s.pendingCount).toBe(2);
  });

  it('rejects negative delay', () => {
    const s = createScheduler();
    expect(() => s.schedule(() => {}, -1)).toThrow();
  });

  it('rejects zero or negative interval on repeating', () => {
    const s = createScheduler();
    expect(() => s.scheduleRepeating(() => {}, 0)).toThrow();
    expect(() => s.scheduleRepeating(() => {}, -1)).toThrow();
  });

  it('is deterministic across two parallel schedulers with identical inputs', () => {
    const a = createScheduler();
    const b = createScheduler();
    const logA: number[] = [];
    const logB: number[] = [];

    a.scheduleRepeating((t) => logA.push(t), 3);
    a.schedule((t) => logA.push(t * 1000), 5);
    b.scheduleRepeating((t) => logB.push(t), 3);
    b.schedule((t) => logB.push(t * 1000), 5);

    a.advance(20);
    b.advance(20);
    expect(logA).toEqual(logB);
  });
});
