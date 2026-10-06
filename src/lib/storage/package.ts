import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { clone, uid, referencedAssetIds, type Project, type AssetRecord } from '../studio/model';
import { resolveAsset, registerAsset } from '../media/pool';
import { projectSchema, assetSchema } from './schema';
import { database } from './db';
export async function packProject(project: Project): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  const assets = [];
  for (const id of referencedAssetIds(project)) {
    const r = await resolveAsset(id);
    assets.push(r.meta);
    entries[`media/${id}`] = new Uint8Array(await r.blob.arrayBuffer());
  }
  entries['project.json'] = strToU8(
    JSON.stringify({ format: 'interface-studio', version: 1, project, assets }),
  );
  return new Blob([zipSync(entries, { level: 0 }) as Uint8Array<ArrayBuffer>], {
    type: 'application/zip',
  });
}
export async function unpackProject(file: Blob): Promise<Project> {
  let total = 0;
  const limit = 2 ** 31;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (e) => {
      total += e.originalSize;
      if (total > limit) throw new Error('This package is too large to unpack safely in memory.');
      return e.name === 'project.json' || /^media\/[^/]+$/.test(e.name);
    },
  });
  if (!files['project.json']) throw new Error('Choose an Interface Studio project package (.zip).');
  const data = JSON.parse(strFromU8(files['project.json']));
  if (data.format !== 'interface-studio' || data.version !== 1)
    throw new Error('This project package version is not supported.');
  const project: Project = projectSchema.parse(data.project);
  const metas = assetSchema.array().parse(data.assets);
  const records: AssetRecord[] = [];
  for (const id of referencedAssetIds(project)) {
    const meta = metas.find((a) => a.id === id);
    const bytes = files[`media/${id}`];
    if (!meta || !bytes) throw new Error('This package is missing referenced media.');
    records.push({ meta, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: meta.mime }) });
  }
  const next = clone(project);
  next.id = uid();
  next.name = `${project.name} · imported`;
  next.createdAt = Date.now();
  next.updatedAt = Date.now();
  // New IDs prevent a package from overwriting assets used by existing projects.
  const remap = new Map(records.map((r) => [r.meta.id, uid()]));
  for (const s of [next.photo, ...next.scenes]) {
    if (s.assetId) s.assetId = remap.get(s.assetId);
    if (s.background.assetId) s.background.assetId = remap.get(s.background.assetId);
    for (const l of s.layers) if (l.kind === 'logo') l.assetId = remap.get(l.assetId)!;
    if (s.logo?.assetId) s.logo.assetId = remap.get(s.logo.assetId);
  }
  for (const r of records) r.meta.id = remap.get(r.meta.id)!;
  const db = await database();
  const tx = db.transaction(['assets', 'projects'], 'readwrite');
  for (const r of records) await tx.objectStore('assets').put(r);
  await tx.objectStore('projects').put(next);
  await tx.done;
  records.forEach(registerAsset);
  return next;
}
