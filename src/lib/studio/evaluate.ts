import {
  clamp,
  type CameraPose,
  type Easing,
  type Keyframe,
  type Project,
  type Scene,
} from './model';
export type SceneSpan = { scene: Scene; start: number; end: number; overlap: number };
// A scene's incoming transition overlaps the previous scene. Cuts never overlap.
// Each overlap is limited to half of both scenes, so at most two scenes coexist.
export function timelineSpans(project: Project): SceneSpan[] {
  let end = 0;
  return project.scenes.map((scene, i) => {
    const previous = project.scenes[i - 1];
    const overlap =
      previous && scene.transition.kind !== 'cut'
        ? Math.min(scene.transition.duration, previous.duration / 2, scene.duration / 2)
        : 0;
    const start = end - overlap;
    end = start + scene.duration;
    return { scene, start, end, overlap };
  });
}
export const totalDuration = (p: Project) => timelineSpans(p).at(-1)?.end || 0;
function cubic(t: number, a: number, b: number) {
  return 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t * t * t;
}
export function bezierEase(t: number, curve: [number, number, number, number]) {
  t = clamp(t, 0, 1);
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (cubic(m, curve[0], curve[2]) < t) lo = m;
    else hi = m;
  }
  return cubic((lo + hi) / 2, curve[1], curve[3]);
}
export function ease(t: number, easing: Easing, curve: Keyframe['bezier'] = [0.25, 0.1, 0.25, 1]) {
  t = clamp(t, 0, 1);
  switch (easing) {
    case 'linear':
      return t;
    case 'ease':
      return bezierEase(t, [0.25, 0.1, 0.25, 1]);
    case 'in':
      return t * t * t;
    case 'out':
      return 1 - (1 - t) ** 3;
    case 'inOut':
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    case 'smooth':
      return t * t * t * (t * (t * 6 - 15) + 10);
    case 'custom':
      return bezierEase(t, curve);
  }
}
export function shortAngle(a: number, b: number, t: number) {
  const delta = ((((b - a + 540) % 360) + 360) % 360) - 180;
  return a + delta * t;
}
export function interpolatePose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  const out = { ...a };
  for (const k of ['x', 'y', 'z', 'zoom', 'fov', 'focusX', 'focusY'] as const)
    out[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of ['rx', 'ry', 'rz'] as const) out[k] = shortAngle(a[k], b[k], t);
  out.autoFocus = t < 0.5 ? a.autoFocus : b.autoFocus;
  return out;
}
export function cameraAtTime(scene: Scene, time: number): CameraPose {
  const keys = [...scene.keyframes].sort((a, b) => a.time - b.time);
  if (!keys.length) return scene.pose;
  if (time <= keys[0].time) return keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].time) {
      const a = keys[i - 1],
        b = keys[i];
      const t = (time - a.time) / Math.max(0.0001, b.time - a.time);
      const [from, to] = a.easingWindow ?? [0, 1];
      const start = ease(from, a.easing, a.bezier);
      const end = ease(to, a.easing, a.bezier);
      const progress =
        Math.abs(end - start) > 0.0000001
          ? (ease(from + (to - from) * t, a.easing, a.bezier) - start) / (end - start)
          : t;
      const pose = interpolatePose(a.pose, b.pose, progress);
      if (a.easingWindow && a.pose.autoFocus !== b.pose.autoFocus)
        pose.autoFocus =
          start + (end - start) * progress < 0.5 ? a.pose.autoFocus : b.pose.autoFocus;
      return pose;
    }
  }
  return keys.at(-1)!.pose;
}
export function mediaTime(scene: Scene, localTime: number, assetDuration: number) {
  const start = clamp(scene.trimIn, 0, Math.max(0, assetDuration - 0.001));
  const end = clamp(scene.trimOut || assetDuration, start + 0.001, assetDuration);
  const elapsed = Math.max(0, localTime);
  return Math.min(
    assetDuration - 0.001,
    start +
      (scene.loop
        ? (elapsed + (scene.sourceOffset ?? 0)) % (end - start)
        : Math.min(elapsed, end - start - 0.001)),
  );
}
export type EvaluatedScene = {
  scene: Scene;
  localTime: number;
  pose: CameraPose;
  opacity: number;
  offsetX: number;
  scale: number;
  reveal?: number;
  transitionBlur?: number;
};
export type RenderState = {
  width: number;
  height: number;
  time: number;
  still: boolean;
  layers: EvaluatedScene[];
};
export function evaluateProjectAtTime(
  project: Project,
  time: number,
  mode: 'photo' | 'video' = 'video',
): RenderState {
  if (mode === 'photo')
    return {
      ...project.output,
      time: 0,
      still: true,
      layers: [
        {
          scene: project.photo,
          localTime: 0,
          pose: project.photo.pose,
          opacity: 1,
          offsetX: 0,
          scale: 1,
        },
      ],
    };
  const spans = timelineSpans(project);
  const duration = totalDuration(project);
  const t = clamp(time, 0, Math.max(0, duration - 0.000001));
  const active = spans.filter((s) => t >= s.start && t < s.end);
  const layers: EvaluatedScene[] = active.map((s) => ({
    scene: s.scene,
    localTime: t - s.start,
    pose: cameraAtTime(s.scene, t - s.start),
    opacity: 1,
    offsetX: 0,
    scale: 1,
  }));
  if (layers.length === 2) {
    const incoming = active[1];
    const p = ease((t - incoming.start) / incoming.overlap, 'smooth');
    const [a, b] = layers;
    switch (incoming.scene.transition.kind) {
      case 'fade':
        b.opacity = p;
        break;
      case 'push':
        a.offsetX = -p;
        b.offsetX = 1 - p;
        break;
      case 'zoom':
        a.scale = 1 + p * 0.12;
        b.scale = 0.88 + p * 0.12;
        b.opacity = p;
        break;
      case 'wipe':
        b.reveal = p;
        break;
      case 'blur':
        a.transitionBlur = p;
        b.transitionBlur = 1 - p;
        b.opacity = p;
        break;
    }
  }
  return { ...project.output, time: t, still: false, layers };
}
export function outputDimensions(ratio: Project['output'], longest: number, even = false) {
  const r = ratio.width / ratio.height;
  let width = r >= 1 ? longest : longest * r;
  let height = r >= 1 ? longest / r : longest;
  const step = even ? 2 : 1;
  width = Math.max(step, Math.round(width / step) * step);
  height = Math.max(step, Math.round(height / step) * step);
  return { width, height };
}
