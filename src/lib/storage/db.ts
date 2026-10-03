import { openDB, type DBSchema } from 'idb';
import { referencedAssetIds, type AssetRecord, type Project } from '../studio/model';
interface StudioDB extends DBSchema {
  projects: { key: string; value: Project };
  assets: { key: string; value: AssetRecord };
}
let promise: ReturnType<typeof openDB<StudioDB>> | undefined;
export const database = () =>
  (promise ??= openDB<StudioDB>('interface-studio', 1, {
    upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('assets', { keyPath: 'meta.id' });
    },
  }));
export async function saveProject(project: Project) {
  const db = await database();
  await db.put('projects', project);
}
export async function listProjects() {
  return (await (await database()).getAll('projects')).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getProject(id: string) {
  return (await database()).get('projects', id);
}
export async function deleteProject(id: string) {
  await (await database()).delete('projects', id);
}
export async function saveAsset(record: AssetRecord) {
  await (await database()).put('assets', record);
}
export async function getAsset(id: string) {
  return (await database()).get('assets', id);
}
export async function listAssets() {
  return (await (await database()).getAll('assets'))
    .map((r) => r.meta)
    .sort((a, b) => b.createdAt - a.createdAt);
}
export async function deleteAsset(id: string) {
  const projects = await listProjects();
  const used = projects.filter((p) => referencedAssetIds(p).includes(id));
  if (used.length)
    throw new Error(
      `Used by ${used.map((p) => p.name).join(', ')}. Replace this media in those projects before deleting it.`,
    );
  await (await database()).delete('assets', id);
}
export function storageError(error: unknown) {
  return error instanceof Error && error.name === 'QuotaExceededError'
    ? 'Local storage is full. Download a project package to keep your work, then remove unneeded captures. Your open project is still available.'
    : `Could not save locally. Your open project is still available. ${error instanceof Error ? error.message : ''}`;
}
