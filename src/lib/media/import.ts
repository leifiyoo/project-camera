import { uid, type AssetRecord } from '../studio/model';
import { registerAsset, MediaSession } from './pool';
import { saveAsset } from '../storage/db';
export const ACCEPT =
  'image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm';
export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob(
      (b) =>
        b
          ? res(b)
          : rej(new Error('The image is too large for this browser. Try a smaller output.')),
      type,
    ),
  );
}
export async function safeSvg(file: Blob) {
  const xml = await file.text();
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  if (doc.querySelector('parsererror,script,foreignObject'))
    throw new Error('This SVG contains unsupported active content. Use a plain SVG or PNG logo.');
  for (const el of doc.querySelectorAll('*'))
    for (const a of el.attributes) {
      if (
        /^on/i.test(a.name) ||
        (/href$/i.test(a.name) && !a.value.startsWith('#') && !a.value.startsWith('data:image/')) ||
        /url\(\s*['"]?(?!#)/i.test(a.value)
      )
        throw new Error('Use an SVG with no scripts or external resources.');
    }
  return new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' });
}
export async function inspectMedia(file: File, knownDuration?: number): Promise<AssetRecord> {
  let blob: Blob = file;
  let mime = file.type;
  const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name);
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file.name);
  if (!isVideo && !isImage)
    throw new Error(
      `${file.name}: choose a PNG, JPEG, WEBP, AVIF, GIF, SVG, MP4, MOV or WEBM file.`,
    );
  let width = 0,
    height = 0,
    duration = 0;
  let source: CanvasImageSource;
  let cleanup = () => {};
  const isSvg = /svg/i.test(mime) || /\.svg$/i.test(file.name);
  if (isSvg) blob = await safeSvg(file);
  if (isVideo) {
    try {
      const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import('mediabunny');
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
      cleanup = () => input.dispose();
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) throw new Error('Unsupported codec');
      width = await track.getDisplayWidth();
      height = await track.getDisplayHeight();
      duration = await input.computeDuration();
      const sink = new CanvasSink(track, { width: 480, poolSize: 1 });
      const frame = await sink.getCanvas(await track.getFirstTimestamp());
      if (!frame) throw new Error('No video frame');
      source = frame.canvas;
    } catch {
      cleanup();
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.src = url;
      cleanup = () => {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(url);
      };
      try {
        const { waitVideo } = await import('./pool');
        await waitVideo(video, 'loadeddata');
        width = video.videoWidth;
        height = video.videoHeight;
        duration = Number.isFinite(video.duration) ? video.duration : knownDuration || 0;
        if (!duration)
          throw new Error('Could not read video duration. Re-save this clip as MP4 or WebM.');
        source = video;
      } catch (e) {
        cleanup();
        throw e;
      }
    }
  } else {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    cleanup = () => URL.revokeObjectURL(url);
    try {
      await image.decode();
      width = image.naturalWidth;
      height = image.naturalHeight;
      source = image;
    } catch {
      cleanup();
      throw new Error(`${file.name}: this image could not be decoded by the browser.`);
    }
  }
  try {
    if (!width || !height) throw new Error('The media has no readable image dimensions.');
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = Math.max(1, Math.round((480 * height) / width));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const thumbnail = canvas.toDataURL('image/webp', 0.8);
    // Rasterizing SVG also excludes any active SVG behavior from future renders.
    if (isSvg) {
      const original = document.createElement('canvas');
      original.width = width;
      original.height = height;
      original.getContext('2d')!.drawImage(source, 0, 0);
      blob = await canvasBlob(original);
      mime = 'image/png';
    }
    return {
      meta: {
        id: uid(),
        name: file.name,
        kind: isVideo ? 'video' : 'image',
        mime: mime || (isVideo ? 'video/mp4' : 'image/png'),
        width,
        height,
        duration: isVideo ? duration : 0,
        createdAt: Date.now(),
        thumbnail,
        ...(/gif/i.test(mime)
          ? { note: 'GIF imported as a still image. Animation is not included.' }
          : {}),
      },
      blob,
    };
  } finally {
    cleanup();
  }
}
export async function importMedia(file: File, knownDuration?: number) {
  const record = await inspectMedia(file, knownDuration);
  registerAsset(record);
  let saveError: unknown;
  try {
    await saveAsset(record);
  } catch (e) {
    saveError = e;
  }
  return { record, saveError };
}
export async function assetThumbnail(id: string) {
  const session = new MediaSession();
  try {
    const { source } = await session.get(id);
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 270;
    c.getContext('2d')!.drawImage(source, 0, 0, 480, 270);
    return c.toDataURL('image/webp', 0.8);
  } finally {
    session.dispose();
  }
}
