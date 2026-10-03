import { StudioRenderer } from '../render/engine';
import { evaluateProjectAtTime, totalDuration } from '../studio/evaluate';
import type { Project } from '../studio/model';
import { canvasBlob } from '../media/import';
export type ExportSettings = {
  width: number;
  height: number;
  fps: 30 | 60;
  format: 'auto' | 'mp4' | 'webm';
  transparent: boolean;
};
export type Support = {
  codec: 'avc' | 'vp9' | 'vp8' | null;
  extension: 'mp4' | 'webm';
  mode: 'frames' | 'realtime';
  message: string;
};
export async function exportSupport(s: ExportSettings): Promise<Support> {
  const { canEncodeVideo } = await import('mediabunny');
  const options = { width: s.width, height: s.height, frameRate: s.fps };
  if (s.format !== 'webm' && (await canEncodeVideo('avc', options)))
    return {
      codec: 'avc',
      extension: 'mp4',
      mode: 'frames',
      message: 'MP4 · precise frame-by-frame rendering',
    };
  if (s.format === 'mp4')
    throw new Error(
      'This browser cannot encode MP4 at these settings. Choose Auto or WebM, or reduce the resolution.',
    );
  for (const codec of ['vp9', 'vp8'] as const)
    if (await canEncodeVideo(codec, options))
      return {
        codec,
        extension: 'webm',
        mode: 'frames',
        message: 'WebM · precise frame-by-frame rendering',
      };
  if (
    typeof MediaRecorder !== 'undefined' &&
    ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].some((m) =>
      MediaRecorder.isTypeSupported(m),
    )
  )
    return {
      codec: null,
      extension: 'webm',
      mode: 'realtime',
      message: 'WebM · real-time browser fallback (frame rate may vary)',
    };
  throw new Error(
    'No supported video encoder at these settings. Try HD at 30 fps in a current Chrome, Edge or Safari browser.',
  );
}
export async function exportPng(
  project: Project,
  time: number,
  mode: 'photo' | 'video',
  s: ExportSettings,
  signal: AbortSignal,
) {
  await document.fonts.ready;
  const renderer = new StudioRenderer();
  try {
    await renderer.render(evaluateProjectAtTime(project, time, mode), s.width, s.height, {
      transparent: s.transparent,
      signal,
    });
    signal.throwIfAborted();
    return await canvasBlob(renderer.canvas);
  } finally {
    renderer.dispose();
  }
}
export async function exportVideo(
  project: Project,
  s: ExportSettings,
  support: Support,
  signal: AbortSignal,
  progress: (n: number) => void,
): Promise<Blob> {
  await document.fonts.ready;
  const renderer = new StudioRenderer();
  const duration = totalDuration(project);
  if (!duration) throw new Error('Add a scene before exporting a video.');
  let cancel: (() => Promise<void>) | undefined;
  try {
    if (support.mode === 'realtime') return await realtime(renderer, project, s, signal, progress);
    const { Output, BufferTarget, CanvasSource, Mp4OutputFormat, WebMOutputFormat, Quality } =
      await import('mediabunny');
    renderer.canvas.width = s.width;
    renderer.canvas.height = s.height;
    const target = new BufferTarget();
    const output = new Output({
      target,
      format:
        support.extension === 'mp4'
          ? new Mp4OutputFormat({ fastStart: 'in-memory' })
          : new WebMOutputFormat(),
    });
    const source = new CanvasSource(renderer.canvas, {
      codec: support.codec!,
      quality: new Quality('high'),
    });
    output.addVideoTrack(source, { frameRate: s.fps });
    cancel = () => output.cancel();
    await output.start();
    const frames = Math.ceil(duration * s.fps);
    for (let i = 0; i < frames; i++) {
      signal.throwIfAborted();
      const t = i / s.fps;
      await renderer.render(evaluateProjectAtTime(project, t), s.width, s.height, { signal });
      await source.add(t, Math.min(1 / s.fps, duration - t));
      progress((i + 1) / frames);
      if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    signal.throwIfAborted();
    source.close();
    await output.finalize();
    cancel = undefined;
    if (!target.buffer) throw new Error('The video encoder produced no output.');
    return new Blob([target.buffer], {
      type: support.extension === 'mp4' ? 'video/mp4' : 'video/webm',
    });
  } finally {
    if (cancel) await cancel().catch(() => {});
    renderer.dispose();
  }
}
async function realtime(
  renderer: StudioRenderer,
  p: Project,
  s: ExportSettings,
  signal: AbortSignal,
  progress: (n: number) => void,
) {
  await renderer.render(evaluateProjectAtTime(p, 0), s.width, s.height, { signal });
  const stream = renderer.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m),
  )!;
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: s.width * s.height * s.fps * 0.15,
  });
  const chunks: Blob[] = [];
  let failed: Error | undefined;
  const stopped = new Promise<void>((res, rej) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => (failed ? rej(failed) : res());
    recorder.onerror = () => {
      failed = new Error(
        'The browser recorder could not encode these settings. Try a lower resolution.',
      );
      if (recorder.state !== 'inactive') recorder.stop();
      else rej(failed);
    };
  });
  // Attach a handler immediately so an encoder failure is never an unhandled rejection.
  void stopped.catch(() => {});
  try {
    recorder.start();
    const duration = totalDuration(p),
      frames = Math.ceil(duration * s.fps),
      start = performance.now();
    for (let i = 0; i < frames; i++) {
      signal.throwIfAborted();
      if (failed) throw failed;
      const t = i / s.fps;
      await renderer.render(evaluateProjectAtTime(p, t), s.width, s.height, { signal });
      track.requestFrame();
      progress((i + 1) / frames);
      const due = start + ((i + 1) * 1000) / s.fps;
      await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())));
    }
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    return new Blob(chunks, { type: 'video/webm' });
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  }
}
