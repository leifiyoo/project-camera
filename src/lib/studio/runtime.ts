// Playback is a separate, tiny observable; document/history never advance per frame.
type Runtime = { time: number; playing: boolean };
let state: Runtime = { time: 0, playing: false };
const listeners = new Set<() => void>();
export const runtime = {
  get: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  set: (patch: Partial<Runtime>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  },
};
