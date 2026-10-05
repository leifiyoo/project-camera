import { referencedAssetIds, type Asset, type Project } from '../studio/model';
import { database, listAssets, listProjects } from './db';

const bundledNames = new Set([
  'Forma · Workspace',
  'Soundspace · Collection',
  'Pace · Daily rhythm',
]);

// Match the old bundled document, not ordinary user-created or renamed projects.
export function isLegacyExample(project: Project, assets: Asset[]) {
  const names = new Map(assets.map((asset) => [asset.id, asset.name]));
  return (
    project.name === 'A closer look' &&
    project.scenes.length === 3 &&
    project.scenes[2].layers.some(
      (layer) => layer.kind === 'text' && layer.text === 'A closer look.\nA new perspective.',
    ) &&
    referencedAssetIds(project).length > 0 &&
    referencedAssetIds(project).every((id) => bundledNames.has(names.get(id) || ''))
  );
}

export async function removeLegacyExamples() {
  const [projects, assets] = await Promise.all([listProjects(), listAssets()]);
  const examples = projects.filter((project) => isLegacyExample(project, assets));
  if (!examples.length) return;
  const remaining = projects.filter((project) => !examples.includes(project));
  const used = new Set(remaining.flatMap(referencedAssetIds));
  const disposable = new Set(examples.flatMap(referencedAssetIds));
  const db = await database();
  const transaction = db.transaction(['projects', 'assets'], 'readwrite');
  for (const example of examples) await transaction.objectStore('projects').delete(example.id);
  for (const asset of assets)
    if (bundledNames.has(asset.name) && disposable.has(asset.id) && !used.has(asset.id))
      await transaction.objectStore('assets').delete(asset.id);
  await transaction.done;
}
