'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, X, Check, AlertCircle } from '@/components/ui/studio-icons';
import { useStudio } from '@/lib/studio/store';
import { runtime } from '@/lib/studio/runtime';
import { outputDimensions, totalDuration } from '@/lib/studio/evaluate';
import { clone } from '@/lib/studio/model';
import { VIDEO_MODE_ENABLED } from '@/lib/studio/features';
import { download, filename } from '@/lib/export/download';
import type { ExportSettings, Support } from '@/lib/export/render-export';
import { importMedia } from '@/lib/media/import';
import { Field, NumberField, Select, SelectOption } from './primitives';
import { PaperSegmentedControl } from '@/components/ui/paper-segmented-control';
export default function ExportDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const project = useStudio((s) => s.project)!;
  const mode = useStudio((s) => s.mode);
  const [type, setType] = useState<'png' | 'video'>(
    VIDEO_MODE_ENABLED && mode === 'video' ? 'video' : 'png',
  );
  const [resolution, setResolution] = useState('1920');
  const [longEdge, setLongEdge] = useState(1920);
  const [fps, setFps] = useState<30 | 60>(30);
  const [format, setFormat] = useState<'auto' | 'mp4' | 'webm'>('auto');
  const [transparent, setTransparent] = useState(false);
  const [saveLibrary, setSaveLibrary] = useState(false);
  const [support, setSupport] = useState<Support | null>(null);
  const [supportError, setSupportError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; name: string; url: string } | null>(null);
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, 120);
    return () => clearTimeout(timer);
  }, [closing, onClose]);
  const abort = useRef<AbortController | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const dimensions = outputDimensions(project.output, longEdge, type === 'video');
  const settings: ExportSettings = { ...dimensions, fps, format, transparent };
  useEffect(() => {
    setResult(null);
  }, [type, longEdge, fps, format, transparent, saveLibrary]);
  useEffect(() => {
    const controller = new AbortController();
    const snapshot = clone(project);
    const time = runtime.get().time;
    let previewUrl = '';
    setPreview('');
    setPreviewLoading(true);
    runtime.set({ playing: false });
    // A dedicated frame avoids reading the stage while its async renderer is mid-frame.
    void import('@/lib/export/render-export')
      .then((exporter) =>
        exporter.exportPng(
          snapshot,
          time,
          mode,
          {
            ...outputDimensions(snapshot.output, 640, false),
            fps: 30,
            format: 'auto',
            transparent: false,
          },
          controller.signal,
        ),
      )
      .then((blob) => {
        if (controller.signal.aborted) return;
        previewUrl = URL.createObjectURL(blob);
        setPreview(previewUrl);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Could not render the preview.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });
    return () => {
      controller.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [project, mode]);
  useEffect(() => {
    if (type !== 'video') return;
    let stale = false;
    setSupport(null);
    setSupportError('');
    void import('@/lib/export/render-export')
      .then((m) =>
        m.exportSupport({
          width: dimensions.width,
          height: dimensions.height,
          fps,
          format,
          transparent: false,
        }),
      )
      .then((s) => {
        if (!stale) setSupport(s);
      })
      .catch((e) => {
        if (!stale) setSupportError(e instanceof Error ? e.message : 'No encoder available.');
      });
    return () => {
      stale = true;
    };
  }, [type, dimensions.width, dimensions.height, fps, format]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('[data-studio-popup]')) return;
      if (e.key === 'Escape' && !abort.current) setClosing(true);
      if (e.key !== 'Tab') return;
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
        ) ?? [],
      ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      if (!dialog.current?.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      abort.current?.abort();
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError('');
    setProgress(0);
    setResult(null);
    runtime.set({ playing: false });
    const snapshot = clone(project);
    const time = runtime.get().time;
    try {
      const exporter = await import('@/lib/export/render-export');
      const blob =
        type === 'png'
          ? await exporter.exportPng(snapshot, time, mode, settings, controller.signal)
          : await exporter.exportVideo(
              snapshot,
              settings,
              support!,
              controller.signal,
              setProgress,
            );
      controller.signal.throwIfAborted();
      const name = `${filename(project.name)}.${type === 'png' ? 'png' : support!.extension}`;
      if (saveLibrary) {
        const { saveError } = await importMedia(new File([blob], name, { type: blob.type }));
        if (saveError)
          setError(
            'Export completed, but it could not be saved to the library. Download the file to keep it.',
          );
        onSaved();
      }
      const url = URL.createObjectURL(blob);
      setResult({ blob, name, url });
      download(blob, name);
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'Export cancelled. Your composition is ready to edit.'
          : e instanceof Error
            ? e.message
            : 'Export failed. Try a lower resolution.',
      );
    } finally {
      abort.current = null;
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-shade"
      data-closing={closing || undefined}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) setClosing(true);
      }}
    >
      <div
        ref={dialog}
        className="export-dialog"
        data-closing={closing || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className="panel-head">
          <div>
            <h2 id="export-title">Export</h2>
            <p>{project.name}</p>
          </div>
          <button
            className="icon-button"
            ref={closeButton}
            aria-label="Close export"
            disabled={busy}
            onClick={() => setClosing(true)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="export-body">
          <div className="export-preview-column">
            <div
              className="export-preview"
              aria-busy={busy || previewLoading}
              style={{ aspectRatio: `${project.output.width}/${project.output.height}` }}
            >
              {result ? (
                type === 'png' ? (
                  <img src={result.url} alt="Exported composition" />
                ) : (
                  <video src={result.url} controls playsInline />
                )
              ) : preview ? (
                <img src={preview} alt="Composition preview" />
              ) : previewLoading ? (
                <div className="export-preview-progress">
                  <span className="spinner" />
                  <strong>Preparing preview…</strong>
                </div>
              ) : (
                <span>Preview</span>
              )}
              {busy && (
                <div className="export-preview-progress">
                  <span className="spinner" />
                  <strong>
                    {type === 'png' ? 'Rendering…' : `${Math.round(progress * 100)}%`}
                  </strong>
                </div>
              )}
            </div>
            <div className="export-preview-meta">
              <span>
                {dimensions.width.toLocaleString()} × {dimensions.height.toLocaleString()}
              </span>
              <span>
                {type === 'png' ? 'PNG' : `${totalDuration(project).toFixed(1)}s · ${fps} fps`}
              </span>
            </div>
            {result && (
              <div className="export-success" role="status">
                <Check size={15} />
                <span>
                  Export ready
                  <small>
                    {(result.blob.size / 1024 / 1024).toFixed(1)} MB · {result.name}
                  </small>
                </span>
              </div>
            )}
          </div>
          <div className="export-options">
            {VIDEO_MODE_ENABLED && (
              <PaperSegmentedControl
                aria-label="Export type"
                value={type}
                fullWidth
                disabled={busy}
                options={[
                  { value: 'png', label: 'Image' },
                  { value: 'video', label: 'Video', disabled: !project.scenes.length },
                ]}
                onValueChange={(value) => {
                  setType(value as 'png' | 'video');
                  setResult(null);
                }}
              />
            )}
            <fieldset disabled={busy} className="export-settings">
              <Field label="Resolution">
                <Select
                  value={resolution}
                  disabled={busy}
                  onValueChange={(value) => {
                    setResolution(value);
                    if (value !== 'custom') setLongEdge(+value);
                  }}
                >
                  <SelectOption value="1920">HD · 1920 px</SelectOption>
                  <SelectOption value="2560">2K · 2560 px</SelectOption>
                  <SelectOption value="3840">4K · 3840 px</SelectOption>
                  <SelectOption value="custom">Custom dimensions</SelectOption>
                </Select>
              </Field>
              {resolution === 'custom' && (
                <NumberField
                  label="Longest edge"
                  value={longEdge}
                  min={64}
                  max={16384}
                  step={1}
                  unit="px"
                  onChange={setLongEdge}
                />
              )}
              {type === 'png' ? (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => setTransparent(e.target.checked)}
                  />{' '}
                  Transparent background
                </label>
              ) : (
                <>
                  <div className="field-grid">
                    <Field label="Frame rate">
                      <Select
                        value={String(fps)}
                        disabled={busy}
                        onValueChange={(value) => setFps(+value as 30 | 60)}
                      >
                        <SelectOption value="30">30 fps</SelectOption>
                        <SelectOption value="60">60 fps</SelectOption>
                      </Select>
                    </Field>
                    <Field label="Format">
                      <Select
                        value={format}
                        disabled={busy}
                        onValueChange={(value) => setFormat(value as typeof format)}
                      >
                        <SelectOption value="auto">Automatic</SelectOption>
                        <SelectOption value="mp4">MP4</SelectOption>
                        <SelectOption value="webm">WebM</SelectOption>
                      </Select>
                    </Field>
                  </div>
                  <div className="encoder-note">
                    {support ? (
                      <>
                        <Check size={14} />
                        {support.message}
                      </>
                    ) : supportError ? (
                      <>
                        <AlertCircle size={15} />
                        {supportError}
                      </>
                    ) : (
                      <>
                        <span className="spinner" /> Checking browser encoder
                      </>
                    )}
                  </div>
                  <p className="panel-note">Video exports have no audio.</p>
                </>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={saveLibrary}
                  onChange={(e) => setSaveLibrary(e.target.checked)}
                />
                Also save to Library
              </label>
            </fieldset>
            {busy && (
              <div className="export-progress" role="status">
                <div>
                  <span>
                    {type === 'png'
                      ? 'Rendering image'
                      : `Rendering frames · ${Math.round(progress * 100)}%`}
                  </span>
                  <button className="text-button" onClick={() => abort.current?.abort()}>
                    Cancel
                  </button>
                </div>
                {type === 'video' ? (
                  <progress value={progress} max={1} />
                ) : (
                  <span className="spinner" />
                )}
              </div>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="export-footer">
          <button className="text-button" disabled={busy} onClick={() => setClosing(true)}>
            {result ? 'Done' : 'Cancel'}
          </button>
          <button
            className="primary"
            disabled={busy || (type === 'video' && !support)}
            onClick={() => (result ? download(result.blob, result.name) : void start())}
          >
            <Download size={16} />
            {busy
              ? 'Exporting…'
              : result
                ? 'Download again'
                : `Export ${type === 'png' ? 'image' : 'video'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
