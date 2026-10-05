import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { makeProject, makeScene, makeText, uid, type Asset } from '../studio/model';
import { saveProject, getProject, saveAsset, getAsset } from './db';
import { isLegacyExample, removeLegacyExamples } from './legacy-examples';

describe('bundled example cleanup', () => {
  it('removes the known bundled document while retaining renamed documents and their shared media', async () => {
    const asset: Asset = {
      id: uid(),
      name: 'Forma · Workspace',
      kind: 'image',
      mime: 'image/png',
      width: 20,
      height: 10,
      duration: 0,
      createdAt: 0,
      thumbnail: 'data:image/png;base64,AA==',
    };
    const example = makeProject(asset);
    example.name = 'A closer look';
    example.scenes = [makeScene(asset), makeScene(asset), makeScene(undefined, true)];
    example.scenes[2].layers = [makeText('A closer look.\nA new perspective.')];
    const personal = { ...example, id: uid(), name: 'My edited project' };
    expect(isLegacyExample(example, [asset])).toBe(true);
    expect(isLegacyExample(personal, [asset])).toBe(false);
    expect(isLegacyExample({ ...example, scenes: [] }, [asset])).toBe(false);
    await saveAsset({ meta: asset, blob: new Blob(['original']) });
    await saveProject(example);
    await saveProject(personal);
    await removeLegacyExamples();
    expect(await getProject(example.id)).toBeUndefined();
    expect((await getProject(personal.id))?.name).toBe('My edited project');
    expect(await getAsset(asset.id)).toBeDefined();
  });
});
