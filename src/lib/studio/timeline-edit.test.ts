import { beforeEach, describe, expect, it } from 'vitest';
import { makeProject, makeScene, makeText, type Asset } from './model';
import { totalDuration, evaluateProjectAtTime, mediaTime, cameraAtTime } from './evaluate';
import { projectSchema } from '../storage/schema';
import { resizeClip, moveClip, splitClip } from './timeline-edit';
import { selectedScene, useStudio } from './store';

const video: Asset = {
  id: 'video',
  name: 'capture.webm',
  kind: 'video',
  duration: 12,
  mime: 'video/webm',
  width: 1280,
  height: 720,
  thumbnail: 'data:image/png;base64,AA==',
  createdAt: 0,
};
beforeEach(() => {
  useStudio.getState().setMode('video');
  useStudio.getState().load(makeProject());
});
describe('empty projects and timeline editing', () => {
  it('preserves every camera sample through repeated splits, including eased and custom paths', () => {
    for (const easing of ['linear', 'ease', 'in', 'out', 'inOut', 'smooth', 'custom'] as const) {
      const scene = makeScene(video);
      scene.duration = 8;
      scene.keyframes = [
        { id: 'a', time: 0, pose: scene.pose, easing, bezier: [0.3, 0.1, 0.8, 0.7] },
        {
          id: 'b',
          time: 8,
          pose: { ...scene.pose, zoom: 3, x: 0.6, ry: 35, autoFocus: false },
          easing: 'smooth',
          bezier: [0, 0, 1, 1],
        },
      ];
      const [a, tail] = splitClip(scene, 2.4)!;
      const [b, c] = splitClip(tail, 1.8)!;
      for (let time = 0; time < 8; time += 0.13) {
        const expected = cameraAtTime(scene, time);
        const actual =
          time < 2.4
            ? cameraAtTime(a, time)
            : time < 4.2
              ? cameraAtTime(b, time - 2.4)
              : cameraAtTime(c, time - 4.2);
        expect(actual.zoom).toBeCloseTo(expected.zoom, 5);
        expect(actual.ry).toBeCloseTo(expected.ry, 5);
        expect(actual.autoFocus).toBe(expected.autoFocus);
      }
    }
  });
  it('splits a trimmed video without losing frames, duration, camera continuity or timed layers', () => {
    const scene = makeScene(video);
    scene.trimIn = 2;
    scene.trimOut = 10;
    scene.duration = 8;
    scene.layers = [
      { ...makeText('Caption'), start: 1, end: 7, animation: 'typewriter', duration: 6 },
    ];
    scene.keyframes = [
      { id: 'start', time: 0, pose: scene.pose, easing: 'linear', bezier: [0, 0, 1, 1] },
      {
        id: 'end',
        time: 8,
        pose: { ...scene.pose, zoom: 2 },
        easing: 'linear',
        bezier: [0, 0, 1, 1],
      },
    ];
    const pair = splitClip(scene, 3)!;
    const [left, right] = pair;
    expect(left.duration + right.duration).toBe(scene.duration);
    expect([left.trimIn, left.trimOut, right.trimIn, right.trimOut]).toEqual([2, 5, 5, 10]);
    expect(mediaTime(right, 0, 12)).toBe(mediaTime(scene, 3, 12));
    expect(cameraAtTime(left, 3)).toEqual(cameraAtTime(right, 0));
    expect(right.layers[0]).toMatchObject({ start: 0, end: 4, animationOffset: 2 });
    expect(right.layers[0].id).not.toBe(left.layers[0].id);
    expect(right.transition.kind).toBe('cut');
    expect(projectSchema.parse({ ...makeProject(), scenes: pair }).scenes).toHaveLength(2);
    expect(scene.duration).toBe(8);
    expect(splitClip(scene, 0.01)).toBeNull();
    expect(splitClip(scene, 7.95)).toBeNull();
  });
  it('continues a looping video from the correct source frame after repeated splits', () => {
    const scene = makeScene(video);
    scene.loop = true;
    scene.trimIn = 2;
    scene.trimOut = 5;
    scene.duration = 12;
    const [, right] = splitClip(scene, 4)!;
    for (const local of [0, 1, 2, 3, 6])
      expect(mediaTime(right, local, 12)).toBeCloseTo(mediaTime(scene, 4 + local, 12));
    const [, again] = splitClip(right, 2)!;
    expect(mediaTime(again, 1, 12)).toBeCloseTo(mediaTime(scene, 7, 12));
  });
  it('starts empty, supports validation and evaluates safely without placeholder media', () => {
    const project = makeProject();
    expect(project.scenes).toEqual([]);
    expect(project.photo.assetId).toBeUndefined();
    expect(project.photo.layers).toEqual([]);
    expect(projectSchema.parse(project).scenes).toEqual([]);
    expect(totalDuration(project)).toBe(0);
    expect(evaluateProjectAtTime(project, 10).layers).toEqual([]);
    expect(makeProject(video).scenes).toEqual([]);
    expect(makeScene(video).duration).toBe(12);
    expect(makeScene(video).loop).toBe(false);
    expect(makeScene(video).transition.kind).toBe('cut');
  });
  it('trims both ends within the source and keeps keyframes and overlays aligned', () => {
    const original = makeScene(video);
    original.layers = [{ ...makeText('Caption'), start: 3, end: 8 }];
    original.keyframes = [
      { id: 'key', time: 4, pose: original.pose, easing: 'linear', bezier: [0, 0, 1, 1] },
    ];
    const start = resizeClip(original, 'start', 2, video);
    expect([start.trimIn, start.trimOut, start.duration]).toEqual([2, 12, 10]);
    expect(start.keyframes[0].time).toBe(2);
    expect([start.layers[0].start, start.layers[0].end]).toEqual([1, 6]);
    const end = resizeClip(start, 'end', -3, video);
    expect([end.trimIn, end.trimOut, end.duration]).toEqual([2, 9, 7]);
    expect(resizeClip(start, 'end', 99, video).duration).toBe(10);
    expect(resizeClip(start, 'start', -99, video).trimIn).toBe(0);
    expect(resizeClip(original, 'end', -99, video).duration).toBe(0.1);
    expect(original.duration).toBe(12);
    expect(original.keyframes[0].time).toBe(4);
  });
  it('groups resizing into one undo, restores the last deleted scene and handles redo to empty', () => {
    const state = useStudio.getState();
    const scene = makeScene();
    state.edit((p) => p.scenes.push(scene));
    state.selectScene(scene.id);
    state.begin();
    for (const delta of [0.5, 1, 2])
      state.editScene((s) => Object.assign(s, resizeClip(scene, 'end', delta)));
    state.commit();
    expect(useStudio.getState().past).toHaveLength(2);
    state.undo();
    expect(selectedScene(useStudio.getState())?.duration).toBe(4);
    state.redo();
    expect(selectedScene(useStudio.getState())?.duration).toBe(6);
    state.edit((p) => {
      p.scenes = [];
    });
    state.selectScene(null);
    expect(selectedScene(useStudio.getState())).toBeUndefined();
    state.undo();
    expect(selectedScene(useStudio.getState())?.id).toBe(scene.id);
    state.redo();
    expect(selectedScene(useStudio.getState())).toBeUndefined();
  });
  it('reorders scenes in either direction without changing their content or total length', () => {
    const scenes = [makeScene(), makeScene(), makeScene()];
    const ids = scenes.map((s) => s.id);
    moveClip(scenes, ids[0], 2);
    expect(scenes.map((s) => s.id)).toEqual([ids[1], ids[2], ids[0]]);
    moveClip(scenes, ids[0], 0);
    expect(scenes.map((s) => s.id)).toEqual(ids);
    expect(totalDuration({ ...makeProject(), scenes })).toBe(12);
  });
});
