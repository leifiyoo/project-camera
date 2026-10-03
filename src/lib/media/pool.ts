import type { Input, CanvasSink } from 'mediabunny';
import { getAsset } from '../storage/db';
import type { AssetRecord } from '../studio/model';
const records = new Map<string, AssetRecord>();
export function registerAsset(r: AssetRecord) {
  records.set(r.meta.id, r);
}
export async function resolveAsset(id: string): Promise<AssetRecord> {
  const r = records.get(id) || (await getAsset(id));
  if (!r)
    throw new Error(
      'This media is missing. Import the original file or a complete project package.',
    );
  records.set(id, r);
  return r;
}
export function forgetAsset(id: string) {
  records.delete(id);
}
export function cachedAssetMetas() {
  return [...records.values()].map((r) => r.meta);
}
type Loaded = {
  record: AssetRecord;
  url: string;
  image?: HTMLImageElement;
  video?: HTMLVideoElement;
  input?: Input;
  sink?: CanvasSink;
  first?: number;
  last?: number;
  frame?: HTMLCanvasElement | OffscreenCanvas;
};
export class MediaSession {
  private cache = new Map<string, Promise<Loaded>>();
  private async load(id: string): Promise<Loaded> {
    const record = await resolveAsset(id);
    const url = URL.createObjectURL(record.blob);
    const loaded: Loaded = { record, url };
    try {
      if (record.meta.kind === 'image') {
        const image = new Image();
        image.src = url;
        await image.decode();
        loaded.image = image;
      } else {
        try {
          const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import('mediabunny');
          const input = new Input({ source: new BlobSource(record.blob), formats: ALL_FORMATS });
          loaded.input = input;
          const track = await input.getPrimaryVideoTrack();
          if (!track || !(await track.canDecode())) throw new Error('No decoder');
          loaded.first = await track.getFirstTimestamp();
          loaded.sink = new CanvasSink(track, { poolSize: 2 });
        } catch {
          loaded.input?.dispose();
          loaded.input = undefined;
          const video = document.createElement('video');
          video.preload = 'auto';
          video.muted = true;
          video.playsInline = true;
          video.src = url;
          await waitVideo(video, 'loadeddata');
          loaded.video = video;
        }
      }
      return loaded;
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
  async get(id: string, time = 0): Promise<{ source: CanvasImageSource; record: AssetRecord }> {
    let promise = this.cache.get(id);
    if (!promise) {
      promise = this.load(id);
      this.cache.set(id, promise);
    }
    const loaded = await promise;
    if (loaded.image) return { source: loaded.image, record: loaded.record };
    if (loaded.sink) {
      const t = Math.max(loaded.first || 0, time + (loaded.first || 0));
      if (loaded.last !== t) {
        const frame = await loaded.sink.getCanvas(t);
        if (!frame)
          throw new Error('No decoded video frame at this time. Try a different trim point.');
        loaded.frame = frame.canvas;
        loaded.last = t;
      }
      return { source: loaded.frame!, record: loaded.record };
    }
    const video = loaded.video!;
    video.pause();
    if (Math.abs(video.currentTime - time) > 0.0001) {
      const wait = waitVideo(video, 'seeked');
      video.currentTime = time;
      await wait;
    }
    if (video.readyState < 2) await waitVideo(video, 'loadeddata');
    return { source: video, record: loaded.record };
  }
  releaseUnused(ids: Set<string>) {
    for (const [id, p] of this.cache) {
      if (!ids.has(id)) {
        this.cache.delete(id);
        void p.then((l) => this.release(l)).catch(() => {});
      }
    }
  }
  private release(l: Loaded) {
    l.input?.dispose();
    if (l.video) {
      l.video.pause();
      l.video.removeAttribute('src');
      l.video.load();
    }
    URL.revokeObjectURL(l.url);
  }
  dispose() {
    for (const p of this.cache.values()) void p.then((l) => this.release(l)).catch(() => {});
    this.cache.clear();
  }
}
export function waitVideo(video: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        finish(
          new Error('The browser could not decode this video. Its codec may not be supported.'),
        ),
      15000,
    );
    const ok = () => finish();
    const bad = () => finish(new Error('The video codec is not supported by this browser.'));
    function finish(error?: Error) {
      clearTimeout(timeout);
      video.removeEventListener(event, ok);
      video.removeEventListener('error', bad);
      if (error) reject(error);
      else resolve();
    }
    video.addEventListener(event, ok, { once: true });
    video.addEventListener('error', bad, { once: true });
  });
}
