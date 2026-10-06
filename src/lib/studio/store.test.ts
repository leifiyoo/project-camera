import { describe, it, expect, beforeEach } from 'vitest';
import { useStudio, hasUnsavedWork } from './store';
import { makeProject, makeScene, makeText } from './model';
import { runtime } from './runtime';
beforeEach(() => {
  const project = makeProject();
  project.scenes.push(makeScene());
  useStudio.getState().setMode('photo');
  useStudio.getState().load(project);
});
describe('completed document changes', () => {
  it('opens legacy projects without a backing plate and preserves their media, crop and overlays', () => {
    const original = makeProject();
    original.scenes.push(makeScene());
    original.photo.assetId = 'saved-photo';
    original.photo.frame.kind = 'laptop';
    original.photo.frame.header = true;
    original.photo.frame.border = 4;
    original.photo.frame.padding = 0.3;
    original.photo.frame.radius = 0.1;
    original.photo.frame.cropZoom = 1.3;
    original.photo.layers.push(makeText());
    original.scenes[0].frame.kind = 'phone';
    useStudio.getState().load(original);
    const loaded = useStudio.getState().project!;
    expect(loaded.photo.assetId).toBe(original.photo.assetId);
    expect(loaded.photo.layers).toEqual(original.photo.layers);
    expect(loaded.photo.frame.cropZoom).toBe(1.3);
    for (const scene of [loaded.photo, ...loaded.scenes]) {
      expect(scene.frame.kind).toBe('plain');
      expect(scene.frame.header).toBe(false);
      expect(scene.frame.border).toBe(0);
      expect(scene.frame.padding).toBe(0);
      expect(scene.frame.radius).toBe(0);
    }
    expect(original.photo.frame.kind).toBe('laptop');
    expect(original.photo.frame.header).toBe(true);
    expect(original.photo.frame.padding).toBe(0.3);
    expect(useStudio.getState().past).toHaveLength(0);
  });
  it('coalesces a drag into one undo entry and keeps playback out of history', () => {
    const s = useStudio.getState();
    s.begin();
    for (let i = 1; i <= 20; i++)
      s.editCamera((p) => {
        p.ry = i;
      });
    expect(useStudio.getState().past).toHaveLength(0);
    s.commit();
    expect(useStudio.getState().past).toHaveLength(1);
    runtime.set({ time: 5, playing: true });
    expect(useStudio.getState().past).toHaveLength(1);
    s.undo();
    expect(useStudio.getState().project!.photo.pose.ry).toBe(-22);
    s.redo();
    expect(useStudio.getState().project!.photo.pose.ry).toBe(20);
    runtime.set({ playing: false, time: 0 });
  });
  it('undoes overlays without copying media blobs and edits animated camera positions', () => {
    const s = useStudio.getState();
    const layer = makeText();
    s.editScene((scene) => scene.layers.push(layer));
    s.undo();
    expect(useStudio.getState().project!.photo.layers).toHaveLength(0);
    s.redo();
    expect(useStudio.getState().project!.photo.layers[0].id).toBe(layer.id);
    s.setMode('video');
    s.editScene((scene) =>
      scene.keyframes.push({
        id: 'start',
        time: 0,
        pose: { ...scene.pose },
        easing: 'linear',
        bezier: [0, 0, 1, 1],
      }),
    );
    s.selectKey('start');
    s.editCamera((p) => {
      p.zoom = 1.4;
    });
    expect(useStudio.getState().project!.scenes[0].keyframes[0].pose.zoom).toBe(1.4);
  });
});
describe('unsaved work', () => {
  const unsaved = () => hasUnsavedWork(useStudio.getState());
  it('treats a blank draft as nothing to lose', () => {
    useStudio.getState().load(makeProject());
    expect(unsaved()).toBe(false);
  });
  it('flags a draft once it has content', () => {
    useStudio.getState().load(makeProject());
    useStudio.getState().edit((p) => p.photo.layers.push(makeText()));
    expect(unsaved()).toBe(true);
  });
  it('tracks changes since the last save, including undo back to it', () => {
    useStudio.getState().load(makeProject(), { stored: true });
    expect(unsaved()).toBe(false);
    useStudio.getState().edit((p) => {
      p.name = 'Renamed';
    });
    expect(unsaved()).toBe(true);
    useStudio.getState().undo();
    expect(unsaved()).toBe(false);
  });
  it('is clean right after saving and flags a project removed from Projects', () => {
    useStudio.getState().load(makeProject());
    useStudio.getState().edit((p) => p.photo.layers.push(makeText()));
    useStudio.getState().markSaved(useStudio.getState().project!);
    expect(unsaved()).toBe(false);
    useStudio.getState().markUnstored();
    expect(unsaved()).toBe(true);
  });
});
