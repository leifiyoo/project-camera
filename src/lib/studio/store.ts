import { create } from 'zustand';
import { produce } from 'immer';
import { clone, uid, clamp, type Project, type Scene, type Layer, type CameraPose } from './model';
import { cameraAtTime, timelineSpans, totalDuration } from './evaluate';
import { runtime } from './runtime';
type State = {
  project: Project | null;
  mode: 'photo' | 'video';
  sceneId: string | null;
  layerId: string | null;
  keyId: string | null;
  past: Project[];
  future: Project[];
  transaction: Project | null;
  ready: boolean;
  load: (p: Project) => void;
  setMode: (m: 'photo' | 'video') => void;
  selectScene: (id: string | null) => void;
  selectLayer: (id: string | null) => void;
  selectKey: (id: string | null) => void;
  edit: (fn: (p: Project) => void) => void;
  editScene: (fn: (s: Scene) => void) => void;
  editLayer: (fn: (l: Layer) => void) => void;
  editCamera: (fn: (pose: CameraPose) => void) => void;
  begin: () => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
};
export const useStudio = create<State>((set, get) => ({
  project: null,
  mode: 'photo',
  sceneId: null,
  layerId: null,
  keyId: null,
  past: [],
  future: [],
  transaction: null,
  ready: false,
  load: (p) => {
    runtime.set({ time: 0, playing: false });
    const project = clone(p);
    for (const scene of [project.photo, ...project.scenes]) {
      // Legacy device frames are retired; a plain frame keeps its corner radius.
      if (scene.frame.kind !== 'plain') scene.frame.radius = 0;
      scene.frame.kind = 'plain';
      scene.frame.header = false;
      scene.frame.border = 0;
      scene.frame.padding = 0;
      scene.focusWidth ??= 0.12;
      scene.dofEnabled ??= true;
      scene.maxBlur ??= 0.7;
    }
    set({
      project,
      sceneId: p.scenes[0]?.id || null,
      layerId: null,
      keyId: null,
      past: [],
      future: [],
      transaction: null,
      ready: true,
    });
  },
  setMode: (mode) => {
    runtime.set({ time: 0, playing: false });
    set({ mode, sceneId: get().project?.scenes[0]?.id || null, layerId: null, keyId: null });
  },
  selectScene: (sceneId) => set({ sceneId, layerId: null, keyId: null }),
  selectLayer: (layerId) => set({ layerId, keyId: null }),
  selectKey: (keyId) => set({ keyId, layerId: null }),
  edit: (fn) => {
    const s = get();
    if (!s.project) return;
    const next = produce(s.project, (draft) => {
      fn(draft);
      draft.updatedAt = Date.now();
    });
    set({
      project: next,
      future: [],
      past: s.transaction ? s.past : [...s.past, s.project].slice(-60),
    });
  },
  editScene: (fn) =>
    get().edit((p) => {
      const s = get();
      const scene = s.mode === 'photo' ? p.photo : p.scenes.find((x) => x.id === s.sceneId);
      if (scene) fn(scene);
    }),
  editLayer: (fn) =>
    get().editScene((s) => {
      const layer = s.layers.find((l) => l.id === get().layerId);
      if (layer) fn(layer);
    }),
  editCamera: (fn) => {
    const state = get();
    let created: string | null = null;
    state.editScene((s) => {
      if (state.mode === 'video' && s.keyframes.length) {
        let key = s.keyframes.find((k) => k.id === state.keyId);
        if (!key) {
          const span = timelineSpans(state.project!).find((x) => x.scene.id === s.id)!;
          const time = clamp(runtime.get().time - span.start, 0, s.duration);
          key = s.keyframes.find((k) => Math.abs(k.time - time) < 0.025);
          if (!key) {
            key = {
              id: uid(),
              time,
              pose: clone(cameraAtTime(s, time)),
              easing: 'smooth',
              bezier: [0.25, 0.1, 0.25, 1],
            };
            s.keyframes.push(key);
          }
          created = key.id;
        }
        fn(key.pose);
        s.pose = clone(key.pose);
      } else fn(s.pose);
    });
    if (created) set({ keyId: created });
  },
  begin: () => {
    if (!get().transaction) set({ transaction: get().project ? clone(get().project!) : null });
  },
  commit: () => {
    const s = get();
    if (s.transaction && s.project && JSON.stringify(s.transaction) !== JSON.stringify(s.project))
      set({ past: [...s.past, s.transaction].slice(-60), future: [], transaction: null });
    else set({ transaction: null });
  },
  undo: () => {
    get().commit();
    const s = get();
    if (!s.past.length || !s.project) return;
    const previous = s.past.at(-1)!;
    runtime.set({ playing: false, time: Math.min(runtime.get().time, totalDuration(previous)) });
    set({
      project: previous,
      sceneId: previous.scenes.some((scene) => scene.id === s.sceneId)
        ? s.sceneId
        : previous.scenes[0]?.id || null,
      past: s.past.slice(0, -1),
      future: [s.project, ...s.future],
      layerId: null,
      keyId: null,
    });
  },
  redo: () => {
    const s = get();
    if (!s.future.length || !s.project) return;
    const next = s.future[0];
    runtime.set({ playing: false, time: Math.min(runtime.get().time, totalDuration(next)) });
    set({
      project: next,
      sceneId: next.scenes.some((scene) => scene.id === s.sceneId)
        ? s.sceneId
        : next.scenes[0]?.id || null,
      future: s.future.slice(1),
      past: [...s.past, s.project],
      layerId: null,
      keyId: null,
    });
  },
}));
export const selectedScene = (s: State) =>
  s.project
    ? s.mode === 'photo'
      ? s.project.photo
      : s.project.scenes.find((x) => x.id === s.sceneId) || s.project.scenes[0]
    : undefined;
