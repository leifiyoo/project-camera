import { beforeEach, describe, expect, it } from 'vitest';
import { makeProject, makeScene, makeText, type Asset } from './model';
import { totalDuration, evaluateProjectAtTime } from './evaluate';
import { projectSchema } from '../storage/schema';
import { resizeClip, moveClip } from './timeline-edit';
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
