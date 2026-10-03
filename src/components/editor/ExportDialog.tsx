'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  Film,
  X,
  Check,
  FolderCheck,
  AlertCircle,
} from 'lucide-react';
import { useStudio } from '@/lib/studio/store';
import { runtime } from '@/lib/studio/runtime';
import { outputDimensions, totalDuration } from '@/lib/studio/evaluate';
import { clone } from '@/lib/studio/model';
import { download, filename } from '@/lib/export/download';
import type { ExportSettings, Support } from '@/lib/export/render-export';
import { importMedia } from '@/lib/media/import';
import { Field, NumberField, Select, SelectOption } from './primitives';
export default function ExportDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const project = useStudio((s) => s.project)!;
  const mode = useStudio((s) => s.mode);
  const [type, setType] = useState<'png' | 'video'>(mode === 'photo' ? 'png' : 'video');
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
  const abort = useRef<AbortController | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const dimensions = outputDimensions(project.output, longEdge, type === 'video');
  const settings: ExportSettings = { ...dimensions, fps, format, transparent };
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
      if (e.key === 'Escape' && !abort.current) onClose();
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
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialog}
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className="panel-head">
          <div>
            <h2 id="export-title">Ready for its close-up.</h2>
            <p>Your composition, at full resolution.</p>
          </div>
          <button
            className="icon-button"
            ref={closeButton}
            aria-label="Close export"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="export-body">
          <div className="export-types">
            <button
              disabled={busy}
              className={type === 'png' ? 'selected' : ''}
              onClick={() => {
                setType('png');
                setResult(null);
              }}
            >
              <ImageIcon size={20} />
              <span>
                Image<small>Current composition · PNG</small>
              </span>
            </button>
            <button
              disabled={busy}
              className={type === 'video' ? 'selected' : ''}
              onClick={() => {
                setType('video');
                setResult(null);
              }}
            >
              <Film size={20} />
              <span>
                Video<small>Entire timeline · silent</small>
              </span>
            </button>
          </div>
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
                <SelectOption value="1920" icon="image">
                  HD · 1920 px
                </SelectOption>
                <SelectOption value="2560" icon="image">
                  2K · 2560 px
                </SelectOption>
                <SelectOption value="3840" icon="image">
                  4K · 3840 px
                </SelectOption>
                <SelectOption value="custom" icon="surface">
                  Custom dimensions
                </SelectOption>
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
            <div className="pixel-summary">
              <strong>
                {dimensions.width.toLocaleString()} × {dimensions.height.toLocaleString()}
              </strong>
              <span>
                pixels · {project.output.width}:{project.output.height}
              </span>
            </div>
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
                  <Field label="Container">
                    <Select
                      value={format}
                      disabled={busy}
                      onValueChange={(value) => setFormat(value as typeof format)}
                    >
                      <SelectOption value="auto">Auto · prefer MP4</SelectOption>
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
                <p className="panel-note">
                  {totalDuration(project).toFixed(2)} seconds ·{' '}
                  {Math.ceil(totalDuration(project) * fps)} frames. Video output is silent.
                </p>
              </>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={saveLibrary}
                onChange={(e) => setSaveLibrary(e.target.checked)}
              />
              <FolderCheck size={15} /> Also save to Library
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
          {result && (
            <div className="export-result">
              {type === 'png' ? (
                <img src={result.url} alt="Exported composition" />
              ) : (
                <video src={result.url} controls playsInline />
              )}
              <span>
                <Check size={14} /> {result.name} · {(result.blob.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button className="secondary full" onClick={() => download(result.blob, result.name)}>
                <Download size={15} /> Download again
              </button>
            </div>
          )}
        </div>
        <div className="export-footer">
          <span>Local rendering. Your media stays here.</span>
          <button
            className="primary"
            disabled={busy || (type === 'video' && !support)}
            onClick={start}
          >
            <Download size={16} />
            {busy ? 'Exporting…' : `Export ${type === 'png' ? 'image' : 'video'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
