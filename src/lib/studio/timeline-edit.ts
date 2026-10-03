import { clamp, clone, type Asset, type Scene } from './model';

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
    scene.keyframes.forEach((key) => {
      key.time -= offset;
    });
    scene.layers.forEach((layer) => {
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
