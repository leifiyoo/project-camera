import { clone, uid, type Scene, type Keyframe, type CameraPose, clamp } from './model';
export type Direction = 'macroGlide' | 'focusPull' | 'hero' | 'orbit' | 'detail';
export function composeScene(scene: Scene, direction: Direction, variation = false): Scene {
  const result = clone(scene);
  if (variation) result.seed++;
  const n = Math.sin(result.seed * 127.1) * 0.5;
  const point = scene.points[0] || {
    x: scene.pose.autoFocus ? 0.32 : scene.pose.focusX,
    y: scene.pose.autoFocus ? 0.38 : scene.pose.focusY,
    w: 0.3,
    h: 0.3,
  };
  const target = { ...scene.pose, focusX: point.x, focusY: point.y, autoFocus: false };
  // Off-center points are gently brought towards the optical center. Detail zoom
  // is bounded by the chosen area's extent and distance from the medium edges.
  const dx = (0.5 - point.x) * 0.8,
    dy = (point.y - 0.5) * 0.6;
  const detailZoom = clamp(1.05 / Math.max(point.w, point.h, 0.55), 1, 1.6);
  let poses: CameraPose[], times: number[] | undefined;
  if (direction === 'macroGlide') {
    result.dofEnabled = true;
    result.duration = clamp(scene.duration, 4, 6);
    result.blur = Math.max(scene.blur, 0.65);
    const close = {
      ...target,
      rx: Math.abs(target.rx) < 8 ? 25 : target.rx,
      ry: Math.abs(target.ry) < 8 ? 35 : target.ry,
      rz: Math.abs(target.rz) < 8 ? -28 : target.rz,
      zoom: Math.max(target.zoom, 1.5),
      fov: Math.min(target.fov, 34),
    };
    poses = [
      { ...close, x: clamp(close.x - 0.07, -2, 2), ry: close.ry - 3 + n },
      { ...close, x: close.x, y: clamp(close.y + 0.012, -2, 2) },
      { ...close, x: clamp(close.x + 0.07, -2, 2), ry: close.ry + 3 + n, rx: close.rx - 2 },
    ];
  } else if (direction === 'focusPull') {
    result.dofEnabled = true;
    result.duration = clamp(scene.duration, 4, 6);
    result.blur = Math.max(scene.blur, 0.72);
    const second = scene.points[1] || {
      x: point.x < 0.5 ? 0.76 : 0.24,
      y: point.y,
    };
    // Hold each endpoint, then interpolate the saved image/UV point. The renderer
    // derives its current camera-space depth, even when this surface is rotated.
    const stable =
      Math.abs(target.rx) + Math.abs(target.ry) < 10 ? { ...target, rx: 18, ry: 32 } : target;
    const start = { ...stable },
      end = { ...stable, focusX: second.x, focusY: second.y };
    poses = [start, { ...start }, end, { ...end }];
    times = [0, result.duration * 0.2, result.duration * 0.8, result.duration];
  } else if (direction === 'hero') {
    result.duration = clamp(scene.duration, 4, 6);
    poses = [
      {
        ...target,
        rx: 25 + n * 2,
        ry: 30,
        rz: -20,
        zoom: 1.6,
        fov: 32,
        x: dx * 0.45 - 0.16,
        y: dy * 0.45 - 0.08,
      },
      { ...target, rx: 18, ry: 17, rz: -9, zoom: 1.15, fov: 34, x: -0.06, y: -0.02 },
      { ...target, rx: 10, ry: 8, rz: -3, zoom: 0.86, fov: 38, x: 0, y: 0 },
    ];
  } else if (direction === 'orbit') {
    poses = [
      { ...target, rx: 14, ry: -22 + n * 3, rz: -3, zoom: 0.95 },
      { ...target, rx: 9, ry: 0, rz: 0, zoom: 1 },
      { ...target, rx: 14, ry: 22 + n * 3, rz: 3, zoom: 0.95 },
    ];
  } else {
    poses = [
      { ...target, rx: 16, ry: -14, rz: -3, zoom: 0.95 },
      { ...target, rx: 5, ry: -5, rz: 0, zoom: detailZoom, x: dx, y: dy },
      { ...target, rx: 5, ry: 4, rz: 0, zoom: detailZoom, x: dx, y: dy },
    ];
  }
  result.pose = clone(poses[0]);
  result.keyframes = poses.map((pose, i): Keyframe => ({
    id: uid(),
    time: times?.[i] ?? (result.duration * i) / (poses.length - 1),
    pose,
    easing: 'smooth',
    bezier: [0.25, 0.1, 0.25, 1],
  }));
  return result;
}
