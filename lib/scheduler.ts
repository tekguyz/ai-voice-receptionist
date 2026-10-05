/** Runs `run` after `delayMs` and returns a way to cancel it. Injected so tests drive time. */
export type Scheduler = (run: () => void, delayMs: number) => () => void;

export const realScheduler: Scheduler = (run, delayMs) => {
  const id = setTimeout(run, delayMs);
  return () => clearTimeout(id);
};
