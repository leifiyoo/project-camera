import { describe, it, expect } from 'vitest';
import { makeProject, makeScene, defaultPose } from './model';
import {
  timelineSpans,
  totalDuration,
  evaluateProjectAtTime,
  interpolatePose,
  ease,
  mediaTime,
  outputDimensions,
} from './evaluate';
import { composeScene } from './compose';
describe('shared timeline semantics', () => {
  it('overlaps incoming scenes once, bounds overlaps, and never activates three scenes', () => {
    const p = makeProject();
    p.scenes = [makeScene(), makeScene(), makeScene()];
    p.scenes.forEach((s) => {
      s.duration = 2;
      s.transition = { kind: 'fade', duration: 5 };
    });
    expect(timelineSpans(p).map((x) => [x.start, x.end, x.overlap])).toEqual([
      [0, 2, 0],
      [1, 3, 1],
      [2, 4, 1],
    ]);
    expect(totalDuration(p)).toBe(4);
    for (let t = 0; t < 4; t += 0.03)
      expect(evaluateProjectAtTime(p, t).layers.length).toBeLessThanOrEqual(2);
    expect(evaluateProjectAtTime(p, 4).layers[0].scene.id).toBe(p.scenes[2].id);
  });
  it('composites actual outgoing and incoming scenes and keeps cuts non-overlapping', () => {
    const p = makeProject();
    const a = makeScene(),
      b = makeScene();
    a.duration = 4;
    b.duration = 4;
    b.transition = { kind: 'push', duration: 1 };
    p.scenes = [a, b];
    const state = evaluateProjectAtTime(p, 3.5);
    expect(state.layers.map((l) => l.scene.id)).toEqual([a.id, b.id]);
    expect(state.layers[0].offsetX).toBeCloseTo(-0.5);
    expect(state.layers[1].offsetX).toBeCloseTo(0.5);
    b.transition.kind = 'cut';
    expect(totalDuration(p)).toBe(8);
    expect(evaluateProjectAtTime(p, 4).layers[0].scene.id).toBe(b.id);
  });
  it('evaluates trimmed, looping and held video times', () => {
    const s = makeScene();
    s.trimIn = 2;
    s.trimOut = 5;
    s.loop = true;
    expect(mediaTime(s, 4, 8)).toBe(3);
    s.loop = false;
    expect(mediaTime(s, 20, 8)).toBeCloseTo(4.999);
  });
});
describe('camera and output', () => {
  it('takes the short rotational arc across zero', () => {
    const a = defaultPose(),
      b = defaultPose();
    a.rz = 359;
    b.rz = 1;
    expect(interpolatePose(a, b, 0.5).rz).toBeCloseTo(360);
  });
  it('has deterministic easing and endpoint invariants', () => {
    for (const e of ['linear', 'ease', 'in', 'out', 'inOut', 'smooth', 'custom'] as const) {
      expect(ease(0, e)).toBeCloseTo(0, 5);
      expect(ease(1, e)).toBeCloseTo(1, 5);
      expect(ease(0.4, e)).toEqual(ease(0.4, e));
    }
    expect(ease(0.5, 'inOut')).toBe(0.5);
  });
  it('keeps overlays when composing a reproducible camera path', () => {
    const s = makeScene(undefined, true);
    s.points = [{ x: 0.7, y: 0.3, w: 0.3, h: 0.3 }];
    const a = composeScene(s, 'detail'),
      b = composeScene(s, 'detail');
    expect(a.keyframes.map((k) => k.pose)).toEqual(b.keyframes.map((k) => k.pose));
    expect(a.layers).toEqual(s.layers);
    expect(a.keyframes[1].pose.focusX).toBe(0.7);
    expect(s.keyframes).toHaveLength(0);
  });
  it('produces native landscape, portrait and square export dimensions', () => {
    expect(outputDimensions({ width: 16, height: 9 }, 3840)).toEqual({ width: 3840, height: 2160 });
    expect(outputDimensions({ width: 9, height: 16 }, 3840)).toEqual({ width: 2160, height: 3840 });
    expect(outputDimensions({ width: 1, height: 1 }, 3840)).toEqual({ width: 3840, height: 3840 });
  });
});
