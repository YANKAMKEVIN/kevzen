/** Regroupe des appels rapprochés en un seul, sans allocation à chaque appel (utilisable dans la boucle d'animation).
 *
 * `fn` part `wait` ms après le dernier appel, et au plus tard `maxWait` ms après le premier
 * (un jardinier qui ratisse sans s'arrêter est quand même sauvegardé). */
export interface Debounced {
  schedule(): void;
  /** Lance tout de suite ce qui attendait ; false s'il n'y avait rien. */
  flush(): boolean;
  cancel(): void;
  readonly pending: boolean;
}

export function debounce(fn: () => void, wait: number, maxWait = Infinity): Debounced {
  let handle: ReturnType<typeof setTimeout> | null = null, first = 0, last = 0;
  const run = (): void => { handle = null; first = 0; fn(); };
  function tick(): void {
    const now = Date.now(), due = Math.min(last + wait, first + maxWait);
    if (now < due) { handle = setTimeout(tick, due - now); return; }
    run();
  }
  return {
    schedule() {
      last = Date.now();
      if (handle === null) { first = last; handle = setTimeout(tick, Math.min(wait, maxWait)); }
    },
    flush() { if (handle === null) return false; clearTimeout(handle); run(); return true; },
    cancel() { if (handle !== null) clearTimeout(handle); handle = null; first = 0; },
    get pending() { return handle !== null; },
  };
}
