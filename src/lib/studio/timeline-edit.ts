import { clamp, clone, uid, type Asset, type Scene } from './model';
import { cameraAtTime } from './evaluate';

export function splitClip(original: Scene, time: number): [Scene, Scene] | null {
  if (time < 0.1 || time > original.duration - 0.1) return null;
  const left = clone(original),
    right = clone(original);
  right.id = uid();
  right.name = `${original.name} · 2`;
  left.duration = time;
  right.duration = original.duration - time;
  // A loop keeps its source window and continues from the split's source position.
  const window = original.trimOut - original.trimIn;
  if (original.loop && window > 0)
    right.sourceOffset = ((original.sourceOffset ?? 0) + time) % window;
  else right.trimIn = original.trimIn + time;
  if (!original.loop) left.trimOut = Math.min(original.trimOut, original.trimIn + time);
  right.transition = { kind: 'cut', duration: 0.6 };
  const pose = cameraAtTime(original, time);
  right.pose = clone(pose);
  if (original.keyframes.length) {
    const keys = [...original.keyframes].sort((a, b) => a.time - b.time);
    const anchor = keys.findLast((key) => key.time <= time);
    const next = keys.find((key) => key.time > time);
    let rightWindow = anchor?.easingWindow;
    if (anchor && next && anchor.time < time) {
      const [from, to] = anchor.easingWindow ?? [0, 1];
      const split = from + ((to - from) * (time - anchor.time)) / (next.time - anchor.time);
      const leftAnchor = left.keyframes.find((key) => key.id === anchor.id)!;
      leftAnchor.easingWindow = [from, split];
      rightWindow = [split, to];
    }
    left.keyframes = left.keyframes.filter((k) => k.time < time);
    left.keyframes.push({
      id: uid(),
      time,
      pose: clone(pose),
      easing: 'smooth',
      bezier: [0.25, 0.1, 0.25, 1],
    });
    right.keyframes = right.keyframes
      .filter((k) => k.time > time)
      .map((k) => ({ ...k, id: uid(), time: k.time - time }));
    right.keyframes.unshift({
      id: uid(),
      time: 0,
      pose: clone(pose),
      easing: anchor?.easing ?? 'linear',
      bezier: clone(anchor?.bezier ?? [0.25, 0.1, 0.25, 1]),
      ...(rightWindow ? { easingWindow: rightWindow } : {}),
    });
  }
  left.layers = left.layers
    .filter((l) => l.start < time)
    .map((l) => ({ ...l, end: Math.min(l.end, time) }));
  right.layers = right.layers
    .filter((l) => l.end > time)
    .map((l) => ({
      ...l,
      id: uid(),
      ...(l.kind === 'text'
        ? { animationOffset: (l.animationOffset ?? 0) + Math.max(0, time - l.start) }
        : {}),
      start: Math.max(0, l.start - time),
      end: l.end - time,
    }));
  return [left, right];
}

// Use the initial snapshot throughout a drag to keep scaling and rounding stable.
export function resizeClip(
  original: Scene,
  edge: 'start' | 'end',
  delta: number,
  asset?: Asset,
): Scene {
  const scene = clone(original);
  const video = asset?.kind === 'video' && !original.loop;
  const change = Math.round(delta * 10) / 10;
  if (edge === 'end') {
    scene.duration = clamp(
      original.duration + change,
      0.1,
      video ? Math.max(0.1, asset.duration - original.trimIn) : 86400,
    );
  } else {
    const offset = clamp(
      change,
      video ? -original.trimIn : original.duration - 86400,
      original.duration - 0.1,
    );
    scene.duration = original.duration - offset;
    if (video) scene.trimIn = original.trimIn + offset;
    if (asset?.kind === 'video' && original.loop) {
      const window = original.trimOut - original.trimIn;
      if (window > 0)
        scene.sourceOffset = ((((original.sourceOffset ?? 0) + offset) % window) + window) % window;
    }
    scene.keyframes.forEach((key) => {
      key.time -= offset;
    });
    scene.layers.forEach((layer) => {
      if (layer.kind === 'text')
        layer.animationOffset = (layer.animationOffset ?? 0) + Math.max(0, offset - layer.start);
      layer.start = Math.max(0, layer.start - offset);
      layer.end = Math.max(0, layer.end - offset);
    });
  }
  scene.duration = Math.round(scene.duration * 1000) / 1000;
  if (video) scene.trimOut = scene.trimIn + scene.duration;
  scene.keyframes.forEach((key) => {
    key.time = clamp(key.time, 0, scene.duration);
  });
  return scene;
}

export function moveClip(scenes: Scene[], id: string, target: number) {
  const from = scenes.findIndex((scene) => scene.id === id);
  if (from < 0) return;
  const to = clamp(target, 0, scenes.length - 1);
  if (from === to) return;
  const [scene] = scenes.splice(from, 1);
  scenes.splice(to, 0, scene);
}
