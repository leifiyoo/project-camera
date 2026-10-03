import { describe, expect, it } from 'vitest';
import { composeScene } from './compose';
import { cameraAtTime } from './evaluate';
import { makeScene, makeText, type Asset, type CameraPose } from './model';

const source: Asset = {
  id: 'original-video',
  name: 'Dashboard.webm',
  kind: 'video',
  mime: 'video/webm',
  width: 1440,
  height: 900,
  duration: 12,
  createdAt: 0,
  thumbnail: '',
};

function contentScene() {
  const scene = makeScene(source);
  scene.duration = 5;
  scene.trimIn = 1.2;
  scene.trimOut = 10.7;
  scene.loop = false;
  scene.layers = [
    makeText('Keep this title'),
    {
      id: 'original-logo-layer',
      kind: 'logo',
      assetId: 'original-logo',
      x: 0.8,
      y: 0.1,
      width: 0.12,
      opacity: 0.9,
      start: 0,
      end: 5,
    },
  ];
  return scene;
}

function cameraOnly(pose: CameraPose) {
  const { x, y, z, rx, ry, rz, zoom, fov } = pose;
  return { x, y, z, rx, ry, rz, zoom, fov };
}

describe('editable camera paths', () => {
  it('pulls focus between saved normalized source points while the camera holds still', () => {
    const scene = contentScene();
    scene.points = [
      { x: 0.18, y: 0.31, w: 0.1, h: 0.1 },
      { x: 0.81, y: 0.68, w: 0.1, h: 0.1 },
    ];
    const result = composeScene(scene, 'focusPull');
    const start = cameraAtTime(result, 0);
    const end = cameraAtTime(result, result.duration);
    expect([start.focusX, start.focusY]).toEqual([0.18, 0.31]);
    expect([end.focusX, end.focusY]).toEqual([0.81, 0.68]);
    for (let i = 0; i <= 20; i++) {
      const pose = cameraAtTime(result, (result.duration * i) / 20);
      expect(cameraOnly(pose)).toEqual(cameraOnly(start));
      expect(pose.autoFocus).toBe(false);
      expect(pose.focusX).toBeGreaterThanOrEqual(0.18);
      expect(pose.focusX).toBeLessThanOrEqual(0.81);
      expect(pose.focusY).toBeGreaterThanOrEqual(0.31);
      expect(pose.focusY).toBeLessThanOrEqual(0.68);
    }
    const middle = cameraAtTime(result, result.duration / 2);
    expect(middle.focusX).toBeCloseTo((0.18 + 0.81) / 2);
    expect(middle.focusY).toBeCloseTo((0.31 + 0.68) / 2);
    expect(cameraAtTime(result, result.duration * 0.1)).toEqual(start);
    expect(cameraAtTime(result, result.duration * 0.9)).toEqual(end);
    expect(result.layers).toEqual(scene.layers);
    expect([result.assetId, result.trimIn, result.trimOut]).toEqual([
      scene.assetId,
      scene.trimIn,
      scene.trimOut,
    ]);
  });

  it('makes a four-to-six-second macro glide with actual pan and perspective motion and a soft start', () => {
    for (const initialDuration of [2, 5, 10]) {
      const scene = contentScene();
      scene.duration = initialDuration;
      const result = composeScene(scene, 'macroGlide');
      expect(result.duration).toBeGreaterThanOrEqual(4);
      expect(result.duration).toBeLessThanOrEqual(6);
      const start = cameraAtTime(result, 0);
      const end = cameraAtTime(result, result.duration);
      expect(Math.abs(end.x - start.x)).toBeGreaterThan(0.1);
      expect(Math.abs(end.ry - start.ry)).toBeGreaterThan(1);
      expect(start.zoom).toBeGreaterThanOrEqual(1.5);
      expect(end.zoom).toBeCloseTo(start.zoom);
      const earlyStep = cameraAtTime(result, result.duration * 0.01).x - start.x;
      const movingStep =
        cameraAtTime(result, result.duration * 0.26).x -
        cameraAtTime(result, result.duration * 0.25).x;
      expect(Math.abs(earlyStep)).toBeLessThan(Math.abs(movingStep) / 5);
      expect(result.assetId).toBe(source.id);
      expect(result.layers).toEqual(scene.layers);
      expect(scene.keyframes).toHaveLength(0);
    }
  });
});
