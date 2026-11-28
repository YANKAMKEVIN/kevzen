import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { debounce } from '../../src/storage/debounce';

describe('regroupement des sauvegardes (debounce)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { vi.useRealTimers(); });

  test('un seul appel, après le délai', () => {
    const fn = vi.fn(), d = debounce(fn, 1000);
    d.schedule();
    expect(d.pending).toBe(true);
    vi.advanceTimersByTime(999); expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(fn).toHaveBeenCalledTimes(1);
    expect(d.pending).toBe(false);
  });

  test('des appels rapprochés n\'en font qu\'un, compté depuis le dernier', () => {
    const fn = vi.fn(), d = debounce(fn, 1000);
    for (let k = 0; k < 10; k++) { d.schedule(); vi.advanceTimersByTime(300); }
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700); expect(fn).toHaveBeenCalledTimes(1);
  });

  test('changement continu : sauvegardé au plus tard après maxWait', () => {
    const fn = vi.fn(), d = debounce(fn, 1000, 3000);
    for (let t = 0; t < 7000; t += 16) { d.schedule(); vi.advanceTimersByTime(16); }
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
  });

  test('appeler schedule à chaque image ne crée pas un minuteur à chaque fois', () => {
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const d = debounce(() => {}, 1000, 5000);
    for (let k = 0; k < 50; k++) { d.schedule(); vi.advanceTimersByTime(16); }
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
    spy.mockRestore();
  });

  test('flush lance tout de suite ce qui attendait, une seule fois', () => {
    const fn = vi.fn(), d = debounce(fn, 1000);
    expect(d.flush()).toBe(false);
    d.schedule();
    expect(d.flush()).toBe(true); expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000); expect(fn).toHaveBeenCalledTimes(1);
  });

  test('cancel oublie ce qui attendait', () => {
    const fn = vi.fn(), d = debounce(fn, 1000);
    d.schedule(); d.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled(); expect(d.pending).toBe(false);
  });

  test('fn peut se reprogrammer (jardin encore en mouvement)', () => {
    let n = 0;
    const d = debounce(() => { n++; if (n < 3) d.schedule(); }, 500);
    d.schedule(); vi.advanceTimersByTime(2000);
    expect(n).toBe(3); expect(d.pending).toBe(false);
  });
});
