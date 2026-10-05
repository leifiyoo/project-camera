// Playback is a separate, tiny observable; document/history never advance per frame.
type Runtime = { time: number; playing: boolean; playbackEnd: number | null };
let state: Runtime = { time: 0, playing: false, playbackEnd: null };
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
    if (patch.playing === false || (patch.playing === true && !state.playing))
      state = { ...state, playbackEnd: null };
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  },
};
