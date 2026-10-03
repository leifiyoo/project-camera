import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { makeProject, makeScene, uid, referencedAssetIds, type AssetRecord } from '../studio/model';
import { saveProject, getProject, saveAsset, getAsset, deleteAsset } from './db';
import { packProject, unpackProject } from './package';
describe('local documents and portable media', () => {
  it('saves and packages an empty project without inventing a scene', async () => {
    const project = makeProject();
    await saveProject(project);
    expect((await getProject(project.id))?.scenes).toEqual([]);
    const imported = await unpackProject(await packProject(project));
    expect(imported.scenes).toEqual([]);
    expect(imported.photo.assetId).toBeUndefined();
  });
  it('persists metadata separately from original blobs and blocks deleting referenced assets', async () => {
    const id = uid();
    const record: AssetRecord = {
      meta: {
        id,
        name: 'test.png',
        kind: 'image',
        mime: 'image/png',
        width: 20,
        height: 10,
        duration: 0,
        createdAt: Date.now(),
        thumbnail: 'data:image/png;base64,AA==',
      },
      blob: new Blob(['actual original media'], { type: 'image/png' }),
    };
    await saveAsset(record);
    const p = makeProject(record.meta);
    await saveProject(p);
    expect((await getProject(p.id))?.photo.assetId).toBe(id);
    expect(await (await getAsset(id))!.blob.text()).toBe('actual original media');
    await expect(deleteAsset(id)).rejects.toThrow('Used by');
  });
  it('roundtrips media bytes, text, keyframes and references without overwriting original IDs', async () => {
    const id = uid();
    const record: AssetRecord = {
      meta: {
        id,
        name: 'logo.png',
        kind: 'image',
        mime: 'image/png',
        width: 20,
        height: 10,
        duration: 0,
        createdAt: Date.now(),
        thumbnail: 'data:image/png;base64,AA==',
      },
      blob: new Blob(['portable media bytes'], { type: 'image/png' }),
    };
    await saveAsset(record);
    const p = makeProject(record.meta);
    p.scenes.push(makeScene(undefined, true));
    const blob = await packProject(p);
    const next = await unpackProject(blob);
    expect(next.id).not.toBe(p.id);
    expect(next.photo.assetId).not.toBe(id);
    expect(referencedAssetIds(next)).toHaveLength(1);
    expect(await (await getAsset(next.photo.assetId!))!.blob.text()).toBe('portable media bytes');
    expect(next.scenes[0].layers).toEqual(p.scenes[0].layers);
    expect((await getProject(next.id))?.name).toContain('imported');
  });
});
