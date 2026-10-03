import type { AssetRecord } from '../studio/model';
export function mediaFilename(record: AssetRecord) {
  const mime = record.blob.type.split(';')[0];
  const ext: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  const extension = ext[mime] || (record.meta.kind === 'video' ? 'webm' : 'png');
  const name = record.meta.name.replace(/\.(png|jpe?g|webp|avif|gif|svg|mp4|mov|webm)$/i, '');
  return `${name}.${extension}`;
}
