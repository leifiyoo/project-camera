'use client';
import dynamic from 'next/dynamic';
import { Theme } from '@radix-ui/themes';
import { DropdownMenu } from 'radix-ui';
import { UIIcon } from './UIIcon';
import { PaperSegmentedControl } from '@/components/ui/paper-segmented-control';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Plus,
  FolderOpen,
  Undo2,
  Redo2,
  Download,
  Monitor,
  Film,
  ImagePlus,
  Copy,
  Trash2,
  Upload,
  Check,
  Square,
  X,
  Focus,
  CircleCheck,
  Info,
  AlertCircle,
  CloudCheck,
  CloudUp,
  CloudOff,
  Clipboard,
} from '@/components/ui/studio-icons';
import { VIDEO_MODE_ENABLED } from '@/lib/studio/features';
import { useStudio, selectedScene } from '@/lib/studio/store';
import { runtime } from '@/lib/studio/runtime';
import {
  clone,
  uid,
  makeProject,
  makeScene,
  type Asset,
  type Layer,
  type Project,
  type Scene,
} from '@/lib/studio/model';
import { outputDimensions, timelineSpans } from '@/lib/studio/evaluate';
import { composeScene, type Direction } from '@/lib/studio/compose';
import {
  listAssets,
  listProjects,
  saveProject,
  getProject,
  deleteProject,
  deleteAsset,
  storageError,
} from '@/lib/storage/db';
import { cachedAssetMetas, resolveAsset, forgetAsset } from '@/lib/media/pool';
import { ACCEPT, importMedia } from '@/lib/media/import';
import { mediaFilename } from '@/lib/media/filename';
import { download, filename } from '@/lib/export/download';
import { Panel, IconButton, Field } from './primitives';
import Inspector, { type InspectorKind, type MediaTarget } from './Inspector';
import ShotSidebar from './ShotSidebar';
import VideoSidebar from './VideoSidebar';
import Timeline from './Timeline';
import WorkspaceSettings from './WorkspaceSettings';
const Stage = dynamic(() => import('./Stage'), {
  ssr: false,
  loading: () => (
    <div className="stage-wrap stage-placeholder">
      <span className="spinner" /> Opening the studio
    </div>
  ),
});
const ExportDialog = dynamic(() => import('./ExportDialog'), { ssr: false });
type PanelName = InspectorKind | 'projects' | 'media' | 'library' | 'compose' | 'help' | null;
type ToastTone = 'info' | 'success' | 'error';
type Toast = { text: string; tone: ToastTone };
type SaveState = 'saved' | 'pending' | 'saving' | 'error';
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
function relativeTime(time: number) {
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Date(time).toLocaleDateString();
}
let bootstrap: Promise<Project> | undefined;
async function boot() {
  if (!localStorage.getItem('studio-clean-workspace-v1')) {
    const { removeLegacyExamples } = await import('@/lib/storage/legacy-examples');
    await removeLegacyExamples();
    localStorage.setItem('studio-clean-workspace-v1', 'done');
  }
  const projects = await listProjects();
  const last = localStorage.getItem('studio-last-project');
  return projects.find((p) => p.id === last) || projects[0] || makeProject();
}
export default function Editor() {
  const project = useStudio((s) => s.project),
    scene = useStudio(selectedScene),
    mode = useStudio((s) => s.mode),
    canUndo = useStudio((s) => s.past.length > 0),
    canRedo = useStudio((s) => s.future.length > 0);
  const [assets, setAssets] = useState<Asset[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [panel, setPanel] = useState<PanelName>(null),
    [focusRequest, setFocusRequest] = useState(0),
    [exporting, setExporting] = useState(false),
    [quality, setQuality] = useState<'high' | 'draft'>('high'),
    [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light'),
    [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null),
    [toast, setToast] = useState<Toast | null>(null),
    [saveState, setSaveState] = useState<SaveState>('saved'),
    [importStatus, setImportStatus] = useState(''),
    [dragOver, setDragOver] = useState(false),
    [recording, setRecording] = useState(false),
    [recordTime, setRecordTime] = useState(0),
    [direction, setDirection] = useState<Direction>('macroGlide'),
    [mod, setMod] = useState('Ctrl'),
    [confirmDelete, setConfirmDelete] = useState<string | null>(null),
    [copying, setCopying] = useState(false);
  const theme = themeOverride ?? systemTheme;
  const canExport =
    !!project &&
    (mode === 'video'
      ? project.scenes.length > 0
      : !!project.photo.assetId || project.photo.layers.length > 0);
  const fileInput = useRef<HTMLInputElement>(null),
    photoInput = useRef<HTMLInputElement>(null),
    packageInput = useRef<HTMLInputElement>(null),
    target = useRef<MediaTarget>('media'),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    saving = useRef<ReturnType<typeof setTimeout> | null>(null),
    copyBuffer = useRef<{ kind: 'scene'; value: Scene } | { kind: 'layer'; value: Layer } | null>(
      null,
    );
  const notify = useCallback((text: string, tone?: ToastTone) => {
    setToast(text ? { text, tone: tone ?? 'error' } : null);
  }, []);
  const persist = useCallback(
    (p: Project) => {
      setSaveState('saving');
      return saveProject(p)
        .then(() => setSaveState('saved'))
        .catch((e) => {
          setSaveState('error');
          notify(storageError(e));
        });
    },
    [notify],
  );
  const copyImage = useCallback(async () => {
    const p = useStudio.getState().project;
    if (!p || (!p.photo.assetId && !p.photo.layers.length)) return;
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      notify('This browser cannot copy images. Use Export to download a PNG instead.');
      return;
    }
    setCopying(true);
    try {
      const { exportPng } = await import('@/lib/export/render-export');
      // Hand the clipboard a pending blob so the browser keeps the click's user activation.
      const png = exportPng(
        clone(p),
        0,
        'photo',
        {
          ...outputDimensions(p.output, 2560),
          fps: 30,
          format: 'auto',
          transparent: p.photo.background.kind === 'transparent',
        },
        new AbortController().signal,
      );
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      notify('Image copied. Paste it anywhere.', 'success');
    } catch (e) {
      notify(
        e instanceof Error && e.name !== 'NotAllowedError'
          ? e.message
          : 'The browser did not allow copying. Use Export to download a PNG.',
      );
    } finally {
      setCopying(false);
    }
  }, [notify]);
  const closePanel = useCallback(() => setPanel(null), []),
    error = useCallback((s: string) => notify(s), [notify]),
    closeExport = useCallback(() => setExporting(false), []);
  const pickFocus = useCallback(() => {
    const state = useStudio.getState();
    runtime.set({ playing: false });
    state.selectLayer(null);
    state.begin();
    state.editCamera((pose) => {
      pose.autoFocus = false;
    });
    state.editScene((scene) => {
      scene.dofEnabled = true;
      if (scene.blur === 0) scene.blur = 0.35;
    });
    state.commit();
    setFocusRequest((value) => value + 1);
    setPanel(null);
    document
      .querySelector('.stage-wrap')
      ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLCanvasElement>('.stage-wrap canvas')
        ?.focus({ preventScroll: true }),
    );
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([listAssets(), listProjects()]);
      const map = new Map([...a, ...cachedAssetMetas()].map((x) => [x.id, x]));
      setAssets([...map.values()].sort((x, y) => y.createdAt - x.createdAt));
      setProjects(p);
    } catch {
      setAssets(cachedAssetMetas());
    }
  }, []);
  useEffect(() => {
    let active = true;
    const storedTheme = localStorage.getItem('studio-theme-override'),
      storedQuality = localStorage.getItem('studio-quality') === 'draft' ? 'draft' : 'high';
    if (storedTheme === 'light' || storedTheme === 'dark') setThemeOverride(storedTheme);
    setQuality(storedQuality);
    if (isMac()) setMod('⌘');
    bootstrap ??= boot();
    void bootstrap
      .then((p) => {
        if (active) {
          useStudio.getState().load(p);
          void refresh();
        }
      })
      .catch(async (e) => {
        if (!active) return;
        notify(storageError(e));
        try {
          const p = makeProject();
          if (active) {
            useStudio.getState().load(p);
            void refresh();
          }
        } catch (e) {
          notify(e instanceof Error ? e.message : 'Could not open the project.');
        }
      });
    return () => {
      active = false;
    };
  }, [refresh, notify]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)'),
      sync = () => setSystemTheme(query.matches ? 'dark' : 'light');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const setThemePreference = (value: string) => {
    if (value === 'light' || value === 'dark') {
      localStorage.setItem('studio-theme-override', value);
      setThemeOverride(value);
    } else {
      localStorage.removeItem('studio-theme-override');
      setThemeOverride(null);
    }
  };
  useEffect(() => {
    localStorage.setItem('studio-quality', quality);
  }, [quality]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.tone === 'error' ? 9000 : 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!project) return;
    // Remember the selected document immediately. A field transaction can replace
    // the debounce timer, so selection must not depend on that timer firing.
    localStorage.setItem('studio-last-project', project.id);
    if (saving.current) clearTimeout(saving.current);
    setSaveState((current) => (current === 'error' ? current : 'pending'));
    saving.current = setTimeout(() => {
      const p = useStudio.getState().project!;
      void persist(p).then(() => {
        if (useStudio.getState().project?.id === p.id)
          localStorage.setItem('studio-last-project', p.id);
      });
    }, 600);
    return () => {
      if (saving.current) clearTimeout(saving.current);
    };
  }, [project, persist]);
  useEffect(() => {
    const unsub = useStudio.subscribe((s, prev) => {
      if (prev.transaction && !s.transaction && s.project) {
        if (saving.current) clearTimeout(saving.current);
        saving.current = setTimeout(() => {
          const p = useStudio.getState().project;
          if (p) void persist(p);
        }, 600);
      }
    });
    return unsub;
  }, [persist]);
  useEffect(() => {
    // Autosave is debounced; warn before leaving with an unsaved edit or a running export.
    const leave = (e: BeforeUnloadEvent) => {
      if (saveState === 'saved' && !exporting) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [saveState, exporting]);
  const importFiles = useCallback(
    async (files: File[], purpose: MediaTarget = 'media') => {
      if (!VIDEO_MODE_ENABLED) {
        const isVideo = (f: File) =>
          f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name);
        if (files.some(isVideo)) {
          files = files.filter((f) => !isVideo(f));
          if (!files.length) {
            notify('Video is coming soon. For now, import an image or screenshot.', 'info');
            return;
          }
        }
      }
      if (!files.length) return;
      runtime.set({ playing: false });
      let successful = 0;
      const imported: Asset[] = [];
      const errors: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setImportStatus(`Importing ${i + 1} of ${files.length} · ${files[i].name}`);
        try {
          const { record, saveError } = await importMedia(files[i]);
          if (saveError) errors.push(storageError(saveError));
          if (record.meta.note) errors.push(record.meta.note);
          imported.push(record.meta);
          successful++;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : `Could not import ${files[i].name}`);
        }
      }
      if (purpose === 'media' && imported.some((a) => a.kind === 'video'))
        useStudio.getState().setMode('video');
      const s = useStudio.getState();
      if (imported.length) {
        s.edit((p) => {
          let current = s.mode === 'photo' ? p.photo : p.scenes.find((x) => x.id === s.sceneId);
          if (!current && purpose !== 'media') {
            current = makeScene();
            p.scenes.push(current);
            s.selectScene(current.id);
          }
          if (purpose === 'background') {
            const a = imported.find((a) => a.kind === 'image');
            if (a) {
              current!.background = { ...current!.background, kind: 'image', assetId: a.id };
            } else errors.push('Choose an image for the background.');
          } else if (purpose === 'logo') {
            const a = imported.find((a) => a.kind === 'image');
            if (a) {
              const layer: Layer = {
                id: uid(),
                kind: 'logo',
                assetId: a.id,
                x: 0.85,
                y: 0.12,
                width: 0.12,
                opacity: 1,
                start: 0,
                end: 3600,
              };
              current!.layers.push(layer);
              s.selectLayer(layer.id);
            } else errors.push('Choose a PNG or SVG image for a logo.');
          } else if (purpose === 'replace') {
            if (imported[0].kind === 'video' && s.mode === 'photo') {
              p.scenes.push(makeScene(imported[0]));
              return;
            }
            current!.assetId = imported[0].id;
            current!.name = imported[0].name.replace(/\.[^.]+$/, '');
            current!.kind = 'media';
            current!.trimIn = 0;
            current!.sourceOffset = 0;
            current!.trimOut = imported[0].duration || 4;
            if (s.mode === 'video') {
              current!.duration =
                imported[0].kind === 'video' ? imported[0].duration : current!.duration;
              current!.keyframes = [];
            }
          } else {
            if (s.mode === 'photo') {
              p.photo.assetId = imported[0].id;
              p.photo.name = imported[0].name.replace(/\.[^.]+$/, '');
              p.photo.kind = 'media';
              p.photo.trimIn = 0;
              p.photo.trimOut = imported[0].duration || 4;
            }
            if (s.mode === 'video') p.scenes.push(...imported.map((a) => makeScene(a)));
          }
        });
        if (purpose === 'replace' && imported[0].kind === 'video' && s.mode === 'photo') {
          setPanel(null);
          useStudio.getState().setMode('video');
          useStudio.getState().selectScene(useStudio.getState().project!.scenes.at(-1)!.id);
        }
        if (purpose === 'media' && s.mode === 'video') {
          const p = useStudio.getState().project!;
          const id = p.scenes[p.scenes.length - imported.length].id;
          s.selectScene(id);
          runtime.set({
            time: timelineSpans(p).find((x) => x.scene.id === id)!.start,
            playing: false,
          });
        }
        if (purpose === 'logo' && s.mode === 'photo') setPanel('inspector');
        if (purpose === 'media') setPanel(null);
      }
      setImportStatus('');
      if (errors.length) notify(errors.join(' '));
      else notify(`${successful} ${successful === 1 ? 'file' : 'files'} imported.`, 'success');
      await refresh();
    },
    [refresh, notify],
  );
  const chooseFiles = useCallback((purpose: MediaTarget = 'media') => {
    target.current = purpose;
    if (fileInput.current) {
      fileInput.current.accept =
        purpose === 'media' && VIDEO_MODE_ENABLED ? ACCEPT : 'image/*,.svg';
      fileInput.current.click();
    }
  }, []);
  const choosePhoto = useCallback(() => {
    setPanel(null);
    photoInput.current?.click();
  }, []);
  const addAsset = (a: Asset) => {
    const s = useStudio.getState();
    if (a.kind === 'video' && !VIDEO_MODE_ENABLED) {
      notify('Video is coming soon. Choose an image for now.', 'info');
      return;
    }
    if (a.kind === 'video' && s.mode === 'photo') s.setMode('video');
    if (useStudio.getState().mode === 'photo')
      s.editScene((scene) => {
        scene.assetId = a.id;
        scene.name = a.name.replace(/\.[^.]+$/, '');
        scene.kind = 'media';
        scene.trimIn = 0;
        scene.trimOut = a.duration || 4;
      });
    else {
      const scene = makeScene(a);
      s.edit((p) => p.scenes.push(scene));
      s.selectScene(scene.id);
      const span = timelineSpans(useStudio.getState().project!).find(
        (x) => x.scene.id === scene.id,
      )!;
      runtime.set({ time: span.start, playing: false });
    }
    setPanel(null);
  };
  useEffect(() => {
    const editable = (t: EventTarget | null) =>
      t instanceof HTMLElement && !!t.closest('input,textarea,select,[contenteditable="true"]');
    const paste = (e: ClipboardEvent) => {
      if (editable(e.target)) return;
      const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        void importFiles(files);
        return;
      }
      const buffer = copyBuffer.current;
      if (buffer) {
        e.preventDefault();
        const s = useStudio.getState();
        if (buffer.kind === 'scene' && !VIDEO_MODE_ENABLED) return;
        if (buffer.kind === 'layer') {
          const l = clone(buffer.value);
          l.id = uid();
          l.x = Math.min(1, l.x + 0.025);
          l.y = Math.min(1, l.y + 0.025);
          s.editScene((scene) => scene.layers.push(l));
          s.selectLayer(l.id);
        } else {
          const scene = clone(buffer.value);
          scene.id = uid();
          scene.layers.forEach((l) => (l.id = uid()));
          scene.keyframes.forEach((k) => (k.id = uid()));
          s.edit((p) => p.scenes.push(scene));
          s.setMode('video');
          s.selectScene(scene.id);
        }
      }
    };
    const keydown = (e: KeyboardEvent) => {
      if (
        editable(e.target) ||
        exporting ||
        (e.target as Element)?.closest('[role="dialog"]') ||
        document.querySelector('[data-studio-popup]')
      )
        return;
      const s = useStudio.getState(),
        current = selectedScene(s);
      const cmd = e.ctrlKey || e.metaKey;
      if (
        (e.key === ' ' || e.key === 'Enter') &&
        (e.target as Element)?.closest('button,summary,a[href],[role="button"]')
      )
        return;
      const widget = (e.target as Element)?.closest(
        '[role="slider"],[role="tab"],[role="radio"],[role="menuitem"],[role="option"]',
      );
      if (cmd && e.shiftKey && e.key.toLowerCase() === 'c' && s.mode === 'photo') {
        e.preventDefault();
        void copyImage();
      } else if (cmd && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        chooseFiles('media');
      } else if (cmd && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const p = s.project;
        if (p && (s.mode === 'video' ? p.scenes.length : p.photo.assetId || p.photo.layers.length))
          setExporting(true);
      } else if (cmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (saving.current) clearTimeout(saving.current);
        if (s.project) void persist(s.project);
        notify('Saved. Projects also save automatically while you work.', 'success');
      } else if (!cmd && e.key === '?') {
        e.preventDefault();
        setPanel('help');
      } else if (
        !cmd &&
        !widget &&
        s.mode === 'video' &&
        s.project?.scenes.length &&
        ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
      ) {
        e.preventDefault();
        const spans = timelineSpans(s.project);
        const total = spans.at(-1)?.end || 0;
        const now = runtime.get().time;
        const step = e.shiftKey ? 1 : 1 / 30;
        const time =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? total
              : Math.max(0, Math.min(total, now + (e.key === 'ArrowRight' ? step : -step)));
        const active = spans.filter((x) => time >= x.start && time < x.end).at(-1) || spans.at(-1);
        if (active && active.scene.id !== s.sceneId) s.selectScene(active.scene.id);
        runtime.set({ time, playing: false });
      } else if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (cmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (e.key === ' ' && s.mode === 'video' && s.project?.scenes.length) {
        e.preventDefault();
        if (!runtime.get().playing) s.selectKey(null);
        runtime.set({ playing: !runtime.get().playing });
      } else if (e.key === 'Enter' && s.mode === 'video') {
        runtime.set({ time: 0, playing: false });
      } else if (e.key === 'Escape') {
        if (e.defaultPrevented || document.querySelector('[data-studio-popup]')) return;
        setPanel(null);
        s.selectLayer(null);
        s.selectKey(null);
      } else if (current && cmd && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
        e.preventDefault();
        const layer = current.layers.find((l) => l.id === s.layerId);
        copyBuffer.current = layer
          ? { kind: 'layer', value: clone(layer) }
          : { kind: 'scene', value: clone(current) };
        if (e.key.toLowerCase() === 'x') {
          if (layer) {
            s.editScene((scene) => {
              scene.layers = scene.layers.filter((l) => l.id !== layer.id);
            });
            s.selectLayer(null);
          } else if (s.mode === 'video') {
            s.edit((p) => {
              p.scenes = p.scenes.filter((x) => x.id !== current.id);
            });
            s.selectScene(useStudio.getState().project!.scenes[0]?.id || null);
            runtime.set({ time: 0, playing: false });
          }
        }
        notify(
          layer ? 'Layer copied. Paste to duplicate.' : 'Scene copied. Paste to duplicate.',
          'info',
        );
      } else if (current && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (s.keyId) {
          s.editScene((scene) => {
            scene.keyframes = scene.keyframes.filter((k) => k.id !== s.keyId);
          });
          s.selectKey(null);
        } else if (s.layerId) {
          s.editScene((scene) => {
            scene.layers = scene.layers.filter((l) => l.id !== s.layerId);
          });
          s.selectLayer(null);
        } else if (s.mode === 'video') {
          s.edit((p) => {
            p.scenes = p.scenes.filter((x) => x.id !== current.id);
          });
          s.selectScene(useStudio.getState().project!.scenes[0]?.id || null);
          runtime.set({ time: 0, playing: false });
        }
      }
    };
    window.addEventListener('paste', paste);
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('paste', paste);
      window.removeEventListener('keydown', keydown);
    };
  }, [importFiles, exporting, notify, persist, chooseFiles, copyImage]);
  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      notify(
        'Screen recording is unavailable in this browser. Use a current desktop browser on localhost or HTTPS, or import a video file.',
      );
      return;
    }
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      stream.current = media;
      const mime = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/mp4',
        'video/webm',
      ].find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime) {
        media.getTracks().forEach((t) => t.stop());
        throw new Error(
          'This browser cannot encode a screen recording. Import an existing video instead.',
        );
      }
      const rec = new MediaRecorder(media, { mimeType: mime });
      recorder.current = rec;
      const chunks: Blob[] = [];
      const started = performance.now();
      let failed = false;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onerror = () => {
        failed = true;
        notify('Screen recording failed. Try a different source or import a video.');
        if (rec.state !== 'inactive') rec.stop();
      };
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        stream.current = null;
        recorder.current = null;
        if (timer.current) clearInterval(timer.current);
        setRecording(false);
        if (failed || !chunks.length) return;
        setImportStatus('Preparing screen recording');
        try {
          const blob = new Blob(chunks, { type: mime });
          const file = new File(
            [blob],
            `Screen recording ${new Date().toLocaleTimeString().replace(/:/g, '-')}.${mime.includes('mp4') ? 'mp4' : 'webm'}`,
            { type: mime },
          );
          const { record, saveError } = await importMedia(
            file,
            (performance.now() - started) / 1000,
          );
          if (saveError) notify(storageError(saveError));
          const scene = makeScene(record.meta);
          useStudio.getState().edit((p) => p.scenes.push(scene));
          useStudio.getState().setMode('video');
          useStudio.getState().selectScene(scene.id);
          await refresh();
        } catch (e) {
          notify(e instanceof Error ? e.message : 'Could not import the recording.');
        } finally {
          setImportStatus('');
        }
      };
      media.getVideoTracks()[0].onended = () => {
        if (rec.state !== 'inactive') rec.stop();
      };
      rec.start(1000);
      setRecording(true);
      setRecordTime(0);
      timer.current = setInterval(
        () => setRecordTime(Math.floor((performance.now() - started) / 1000)),
        1000,
      );
      setPanel(null);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      if (e instanceof Error && e.name !== 'NotAllowedError' && e.name !== 'AbortError')
        notify(e.message);
    }
  };
  const switchProject = async (id: string) => {
    try {
      if (project) await saveProject(project);
      const p = await getProject(id);
      if (p) {
        useStudio.getState().load(p);
        localStorage.setItem('studio-last-project', id);
        setPanel(null);
      }
    } catch (e) {
      notify(storageError(e));
    }
  };
  const newProject = async () => {
    const p = makeProject();
    try {
      if (project) await saveProject(project);
      await saveProject(p);
      useStudio.getState().load(p);
      setPanel(null);
      await refresh();
    } catch (e) {
      notify(storageError(e));
    }
  };
  const duplicateProject = async (p: Project) => {
    const next = clone(p);
    next.id = uid();
    next.name = `${p.name} · copy`;
    next.createdAt = Date.now();
    next.updatedAt = Date.now();
    try {
      await saveProject(next);
      useStudio.getState().load(next);
      await refresh();
    } catch (e) {
      notify(storageError(e));
    }
  };
  const removeProject = async (p: Project) => {
    try {
      const remaining = projects.filter((x) => x.id !== p.id);
      if (p.id === project?.id) {
        const next = remaining[0] || makeProject();
        if (!remaining.length) await saveProject(next);
        useStudio.getState().load(next);
      }
      await deleteProject(p.id);
      await refresh();
    } catch (e) {
      notify(storageError(e));
    }
  };
  const packageExport = async () => {
    if (!project) return;
    setImportStatus('Preparing project package');
    try {
      const { packProject } = await import('@/lib/storage/package');
      download(await packProject(project), `${filename(project.name)}.studio.zip`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not package the project.');
    } finally {
      setImportStatus('');
    }
  };
  const compose = () => {
    if (!scene) return;
    const state = useStudio.getState();
    if (mode === 'photo') {
      const composed = composeScene(scene, direction);
      composed.id = uid();
      state.edit((p) => p.scenes.push(composed));
      state.setMode('video');
      state.selectScene(composed.id);
      const span = timelineSpans(useStudio.getState().project!).find(
        (s) => s.scene.id === composed.id,
      )!;
      runtime.set({ time: span.start, playing: false });
    } else {
      state.editScene((s) => {
        const composed = composeScene(s, direction, true);
        const ratio = s.duration / composed.duration;
        composed.keyframes.forEach((key) => {
          key.time *= ratio;
        });
        composed.duration = s.duration;
        Object.assign(s, composed);
      });
      const span = timelineSpans(state.project!).find((s) => s.scene.id === scene.id)!;
      runtime.set({ time: span.start, playing: false });
    }
    setPanel(null);
    notify('Camera path ready. Edit its positions in the timeline.', 'success');
  };
  const titleFor = (v: InspectorKind) =>
    ({
      background: 'Background',
      focus: 'Focus',
      blur: 'Depth of field',
      zoom: 'Zoom',
      fov: 'Field of view',
      camera: 'Camera',
      frame: 'Surface',
      rotation: 'Rotation',
      shadow: 'Shadow',
      aspect: 'Output format',
      inspector: 'Scene & layers',
      settings: 'Settings',
    })[v];
  return (
    <Theme
      asChild
      appearance={theme === 'dark' ? 'dark' : 'light'}
      accentColor="blue"
      grayColor="gray"
      radius="large"
    >
      <main
        className={`studio ${mode === 'video' ? 'video-studio' : 'photo-studio'}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void importFiles([...e.dataTransfer.files]);
        }}
      >
        <section className="desktop-only" aria-labelledby="desktop-only-title">
          <span className="studio-mark" aria-hidden="true">
            <Focus size={22} />
          </span>
          <h1 id="desktop-only-title">Please open Studio on a desktop</h1>
          <p>
            Studio is built for a larger screen, a mouse and a keyboard. Visit this page on your
            computer to edit your images.
          </p>
          <button
            className="primary"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => notify('Link copied. Open it on your computer.', 'success'))
                .catch(() => notify(window.location.href, 'info'));
            }}
          >
            <Copy size={16} /> Copy link
          </button>
        </section>
        <header className="topbar">
          <div className="topbar-left">
            <span className="studio-brand" aria-label="Interface Studio">
              <span className="studio-mark" aria-hidden="true">
                <Focus size={15} />
              </span>
              <span className="studio-wordmark">Studio</span>
            </span>
            <span className="top-divider" />
            <button
              className={`project-trigger ${panel === 'projects' ? 'selected' : ''}`}
              aria-label="Projects"
              title="All projects"
              aria-expanded={panel === 'projects'}
              onClick={() => {
                void refresh();
                setPanel(panel === 'projects' ? null : 'projects');
              }}
            >
              <FolderOpen size={15} />
              <ChevronDown size={12} />
            </button>
            {project ? (
              <input
                className="project-name-input"
                aria-label="Project name"
                title="Rename project"
                value={project.name}
                size={Math.max(6, Math.min(32, project.name.length + 1))}
                spellCheck={false}
                onFocus={(e) => {
                  useStudio.getState().begin();
                  e.currentTarget.select();
                }}
                onBlur={() => {
                  const s = useStudio.getState();
                  if (!s.project?.name.trim())
                    s.edit((p) => {
                      p.name = 'Untitled project';
                    });
                  s.commit();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
                }}
                onChange={(e) =>
                  useStudio.getState().edit((p) => {
                    p.name = e.target.value;
                  })
                }
              />
            ) : (
              <span className="project-name-placeholder">Opening project</span>
            )}
            {project && (
              <span
                className="save-indicator"
                data-state={saveState}
                role="status"
                title={
                  saveState === 'error'
                    ? 'Could not save to this browser. Download a project package as a backup.'
                    : 'Projects save automatically in this browser.'
                }
              >
                {saveState === 'error' ? (
                  <CloudOff size={15} />
                ) : saveState === 'saved' ? (
                  <CloudCheck size={15} />
                ) : (
                  <CloudUp size={15} />
                )}
                <span>
                  {saveState === 'error'
                    ? 'Not saved'
                    : saveState === 'saved'
                      ? 'Saved'
                      : 'Saving…'}
                </span>
              </span>
            )}
          </div>
          {VIDEO_MODE_ENABLED ? (
            <PaperSegmentedControl
              className="workspace-mode"
              aria-label="Studio mode"
              value={mode}
              onValueChange={(value) => {
                if (value === 'photo' || value === 'video') {
                  setPanel(null);
                  useStudio.getState().setMode(value);
                }
              }}
              options={[
                { value: 'photo', label: 'Photo', 'aria-label': 'PHOTO' },
                { value: 'video', label: 'Video', 'aria-label': 'VIDEO' },
              ]}
            />
          ) : (
            <div className="mode-switch" role="group" aria-label="Studio mode">
              <button className="mode-option" aria-pressed="true">
                Photo
              </button>
              <span
                className="mode-option mode-soon"
                role="button"
                tabIndex={0}
                aria-disabled="true"
                aria-describedby="video-soon-tip"
              >
                Video
                <span className="soon-badge">Soon</span>
                <span role="tooltip" id="video-soon-tip" className="soon-tip">
                  <b>Video is coming soon</b>
                  Animated camera moves and clips are being rebuilt.
                </span>
              </span>
            </div>
          )}
          <div className="topbar-right">
            <div className="history-tools">
              <IconButton
                label={`Undo · ${mod} Z`}
                disabled={!canUndo}
                onClick={() => useStudio.getState().undo()}
              >
                <Undo2 size={17} />
              </IconButton>
              <IconButton
                label={`Redo · ${mod} Shift Z`}
                disabled={!canRedo}
                onClick={() => useStudio.getState().redo()}
              >
                <Redo2 size={17} />
              </IconButton>
            </div>
            <span className="top-divider" />
            <button
              className="header-import"
              aria-label="Import media"
              title={`Import an image · ${mod} O`}
              disabled={!project || !!importStatus}
              onClick={() => chooseFiles('media')}
            >
              <Plus size={16} />
              <span>Import</span>
            </button>
            <button
              className="header-import header-copy"
              aria-label="Copy image"
              title={`Copy image to clipboard · ${mod} Shift C`}
              disabled={!canExport || copying}
              onClick={() => void copyImage()}
            >
              {copying ? <span className="spinner" /> : <Clipboard size={16} />}
              <span>Copy</span>
            </button>
            <button
              className="export-button"
              disabled={!canExport}
              title={`Export · ${mod} E`}
              onClick={() => setExporting(true)}
            >
              <Download size={15} />
              <span>Export</span>
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="workspace-menu-trigger"
                  aria-label="Workspace options"
                  title="Workspace options"
                >
                  <UIIcon name="more" size={19} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="paper-menu"
                  data-studio-popup
                  align="end"
                  sideOffset={8}
                  collisionPadding={12}
                >
                  <DropdownMenu.Item
                    className="paper-menu-item"
                    onSelect={() => {
                      void refresh();
                      setPanel('library');
                    }}
                  >
                    <span>Media library</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="paper-menu-item"
                    onSelect={() => setPanel('settings')}
                  >
                    <span>Settings</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="paper-menu-item"
                    onSelect={() => {
                      const next = theme === 'dark' ? 'light' : 'dark';
                      // Toggling back to the OS appearance resumes following the system.
                      setThemePreference(next === systemTheme ? 'system' : next);
                    }}
                  >
                    <span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="paper-menu-separator" />
                  <DropdownMenu.Item className="paper-menu-item" onSelect={() => setPanel('help')}>
                    <span>Help and shortcuts</span>
                    <kbd className="menu-shortcut">?</kbd>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <div className="workspace">
          <section className="preview-column" aria-label="Preview workspace">
            {project &&
            (mode === 'video'
              ? !project.scenes.length
              : !project.photo.assetId && !project.photo.layers.length) ? (
              <section className="stage-wrap empty-stage" aria-label="Empty project">
                <div className="empty-stage-content">
                  <span className="empty-stage-icon">
                    {mode === 'video' ? <Film size={28} /> : <ImagePlus size={28} />}
                  </span>
                  <h1>
                    {mode === 'video' ? 'Your video starts here.' : 'Your canvas starts here.'}
                  </h1>
                  <p>
                    {mode === 'video'
                      ? 'Bring in a video or image to create your first scene.'
                      : 'Upload a photo or screenshot to get started.'}
                  </p>
                  <div className="empty-stage-actions">
                    <button
                      className="primary"
                      onClick={mode === 'video' ? () => chooseFiles('media') : choosePhoto}
                    >
                      <Upload size={16} />
                      {mode === 'video' ? 'Import media' : 'Upload photo'}
                    </button>
                    {mode === 'video' && (
                      <button className="secondary" onClick={() => void startRecording()}>
                        <Monitor size={16} /> Record screen
                      </button>
                    )}
                  </div>
                  <ul className="empty-stage-hints" aria-label="Other ways to add media">
                    <li>
                      <kbd>Drag</kbd> files anywhere
                    </li>
                    <li>
                      <kbd>{mod} V</kbd> paste a screenshot
                    </li>
                    <li>
                      <kbd>{mod} O</kbd> open files
                    </li>
                  </ul>
                  <small className="empty-stage-formats">
                    {mode === 'video'
                      ? 'MP4, MOV, WebM and images'
                      : 'PNG, JPG, WebP, AVIF, GIF and SVG'}
                  </small>
                  {(() => {
                    const recent = assets
                      .filter((a) => mode === 'video' || a.kind === 'image')
                      .slice(0, 6);
                    return recent.length ? (
                      <div className="empty-stage-recent">
                        <div className="section-label">Recent media</div>
                        <div className="empty-stage-recent-grid">
                          {recent.map((a) => (
                            <button
                              key={a.id}
                              className="empty-stage-recent-item"
                              aria-label={`Use ${a.name}`}
                              title={a.name}
                              onClick={() => addAsset(a)}
                            >
                              <img src={a.thumbnail} alt="" />
                              {a.kind === 'video' && (
                                <span className="asset-kind">
                                  <Film size={11} />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </section>
            ) : project ? (
              <Stage
                quality={quality}
                focusRequest={focusRequest}
                onLayers={() => {
                  if (mode === 'photo') setPanel('inspector');
                }}
                assets={assets}
                onImport={chooseFiles}
                onPickFocus={pickFocus}
                onError={error}
                locked={exporting}
                minimal={mode === 'video'}
              />
            ) : (
              <div className="stage-wrap stage-placeholder">
                <span className="spinner" />
                Opening your studio
              </div>
            )}
            {mode === 'video' && (
              <Timeline
                assets={assets}
                onAdd={() => chooseFiles('media')}
                onInspector={() => setPanel(null)}
              />
            )}
          </section>
          {mode === 'video' ? (
            <VideoSidebar
              assets={assets}
              onImport={chooseFiles}
              onPickFocus={pickFocus}
              onAnimate={() => setPanel('compose')}
            />
          ) : (
            <ShotSidebar
              assets={assets}
              onImport={chooseFiles}
              onPickFocus={pickFocus}
              onAdvanced={() => setPanel('inspector')}
              onLibrary={() => {
                void refresh();
                setPanel('library');
              }}
              onUseAsset={addAsset}
            />
          )}
        </div>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept={VIDEO_MODE_ENABLED ? ACCEPT : 'image/*,.svg'}
          multiple
          onChange={(e) => {
            void importFiles([...(e.target.files || [])], target.current);
            e.target.value = '';
          }}
        />
        <input
          ref={photoInput}
          className="visually-hidden"
          type="file"
          accept="image/*,.svg"
          aria-label="Upload a photo or screenshot"
          onChange={(e) => {
            const files = [...(e.target.files || [])];
            e.target.value = '';
            if (!files.length) return;
            useStudio.getState().setMode('photo');
            void importFiles(files, 'replace');
          }}
        />
        <input
          ref={packageInput}
          className="visually-hidden"
          type="file"
          accept=".zip"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setImportStatus('Opening project package');
            try {
              const { unpackProject } = await import('@/lib/storage/package');
              const p = await unpackProject(f);
              if (project) await saveProject(project);
              useStudio.getState().load(p);
              await refresh();
              setPanel(null);
              notify('Project and referenced media imported.', 'success');
            } catch (e) {
              notify(e instanceof Error ? e.message : 'This project package could not be read.');
            } finally {
              setImportStatus('');
            }
          }}
        />
        {panel === 'projects' && (
          <Panel title="Projects" onClose={closePanel} centered wide>
            <Field label="Project name">
              <input
                value={project?.name || ''}
                onChange={(e) =>
                  useStudio.getState().edit((p) => {
                    p.name = e.target.value;
                  })
                }
              />
            </Field>
            <div className="project-list">
              {[...projects]
                .sort((a, b) => (b.id === project?.id ? 1 : 0) - (a.id === project?.id ? 1 : 0))
                .map((p) => {
                  const current = p.id === project?.id;
                  const doc = current ? project : p;
                  const thumb = assets.find(
                    (a) => a.id === (doc.photo.assetId || doc.scenes[0]?.assetId),
                  )?.thumbnail;
                  const parts = [
                    doc.photo.assetId ? 'Photo' : '',
                    doc.scenes.length
                      ? `${doc.scenes.length} ${doc.scenes.length === 1 ? 'clip' : 'clips'}`
                      : '',
                  ].filter(Boolean);
                  return (
                    <div key={p.id} className={current ? 'current' : ''}>
                      <button onClick={() => void switchProject(p.id)} aria-current={current}>
                        <span className="project-thumb" aria-hidden="true">
                          {thumb ? <img src={thumb} alt="" /> : <ImagePlus size={16} />}
                        </span>
                        <span>
                          <b>{doc.name || 'Untitled project'}</b>
                          <small>
                            {current ? 'Open now' : `Edited ${relativeTime(doc.updatedAt)}`}
                            {' · '}
                            {parts.join(' · ') || 'Empty'}
                          </small>
                        </span>
                        {current && <Check size={14} />}
                      </button>
                      {confirmDelete === p.id ? (
                        <div className="project-confirm" role="group" aria-label="Confirm delete">
                          <button
                            className="danger-button"
                            onClick={() => {
                              setConfirmDelete(null);
                              void removeProject(p);
                            }}
                          >
                            Delete
                          </button>
                          <button className="text-button" onClick={() => setConfirmDelete(null)}>
                            Keep
                          </button>
                        </div>
                      ) : (
                        <>
                          <IconButton
                            label={`Duplicate ${p.name}`}
                            onClick={() => void duplicateProject(p)}
                          >
                            <Copy size={14} />
                          </IconButton>
                          <IconButton
                            label={`Delete ${p.name}`}
                            onClick={() => setConfirmDelete(p.id)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
            <button className="secondary full" onClick={() => void newProject()}>
              <Plus size={15} /> New project
            </button>
            <div className="section-label">Project files</div>
            <button className="text-button full" onClick={() => void packageExport()}>
              <Download size={15} /> Download project package
            </button>
            <button className="text-button full" onClick={() => packageInput.current?.click()}>
              <Upload size={15} /> Open project package
            </button>
          </Panel>
        )}
        {(panel === 'media' || panel === 'library') && (
          <Panel
            title={panel === 'media' ? 'Add media' : 'Media library'}
            onClose={closePanel}
            centered
            wide
          >
            <div className="media-import-actions">
              <button className="secondary" onClick={() => chooseFiles()}>
                <Upload size={16} /> Import files
              </button>
              {VIDEO_MODE_ENABLED && (
                <button className="secondary" onClick={() => void startRecording()}>
                  <Monitor size={16} /> Record screen
                </button>
              )}
            </div>
            <p className="panel-note">
              PNG, JPG, WEBP, AVIF, GIF, SVG{VIDEO_MODE_ENABLED ? ' · MP4, MOV, WEBM' : ''}
              <br />
              Drop files anywhere, or paste an image.
            </p>
            {!assets.length && (
              <div className="library-empty">
                <ImagePlus size={28} />
                <h3>Your media, all in one place</h3>
                <p>Import images or videos to use in any project.</p>
              </div>
            )}
            {!!assets.length && (
              <div className="section-label">
                {assets.length} {assets.length === 1 ? 'file' : 'files'}
              </div>
            )}
            <div className="media-grid">
              {assets.map((a) => (
                <article className="asset-card" key={a.id}>
                  <button
                    className="asset-thumb"
                    aria-label={`Use ${a.name}`}
                    onClick={() => addAsset(a)}
                  >
                    <img src={a.thumbnail} alt={a.name} />
                    <span className="asset-kind">
                      {a.kind === 'video' ? <Film size={12} /> : <ImagePlus size={12} />}
                    </span>
                    <span className="asset-add">
                      <Plus size={20} />
                    </span>
                  </button>
                  <div className="asset-info">
                    <b title={a.name}>{a.name}</b>
                    <small>
                      {a.width} × {a.height}
                      {a.kind === 'video' ? ` · ${a.duration.toFixed(1)}s` : ''}
                    </small>
                    {a.note && <small className="asset-note">{a.note}</small>}
                    <div className="asset-actions">
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            const r = await resolveAsset(a.id);
                            download(r.blob, mediaFilename(r));
                          } catch (e) {
                            notify(
                              e instanceof Error ? e.message : 'Could not download this file.',
                            );
                          }
                        }}
                      >
                        <Download size={12} /> Download
                      </button>
                      <IconButton
                        label={`Delete media ${a.name}`}
                        onClick={async () => {
                          try {
                            if (project) {
                              const { referencedAssetIds } = await import('@/lib/studio/model');
                              if (referencedAssetIds(project).includes(a.id))
                                throw new Error(
                                  'This media is used in the current project. Replace it before deleting.',
                                );
                            }
                            await deleteAsset(a.id);
                            forgetAsset(a.id);
                            await refresh();
                          } catch (e) {
                            notify(e instanceof Error ? e.message : 'Could not delete the media.');
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        )}
        {panel === 'compose' && (
          <Panel title="Camera motion" onClose={closePanel} centered wide>
            <p className="panel-note compose-intro">
              Choose a movement. Every position stays editable in the timeline.
            </p>
            <div className="direction-list">
              {(
                [
                  {
                    value: 'macroGlide',
                    label: 'Macro glide',
                    detail:
                      'Travel slowly across a close crop, with a subtle change in perspective.',
                  },
                  {
                    value: 'focusPull',
                    label: 'Focus pull',
                    detail: 'Hold the camera steady and shift focus between two image details.',
                  },
                  {
                    value: 'hero',
                    label: 'Hero reveal',
                    detail: 'Open from a close detail into a complete, floating product view.',
                  },
                ] as const
              ).map((d) => (
                <button
                  key={d.value}
                  aria-label={d.label}
                  className={direction === d.value ? 'selected' : ''}
                  aria-pressed={direction === d.value}
                  onClick={() => setDirection(d.value)}
                >
                  <span className={`motion-demo motion-${d.value}`} aria-hidden="true">
                    <i />
                  </span>
                  <span>
                    <b>{d.label}</b>
                    <small>{d.detail}</small>
                  </span>
                  {direction === d.value && <Check size={15} />}
                </button>
              ))}
            </div>
            <p className="panel-note motion-focus-note">
              {scene?.points.length
                ? `${scene.points.length} marked ${scene.points.length === 1 ? 'detail' : 'details'} will guide the focus.`
                : 'Uses your current focus point.'}
            </p>
            {!!scene?.points.length && (
              <button
                className="text-button"
                onClick={() =>
                  useStudio.getState().editScene((s) => {
                    s.points = [];
                  })
                }
              >
                <Trash2 size={13} /> Clear marked details
              </button>
            )}
            <button className="compose-primary full" onClick={compose}>
              <Focus size={16} /> {mode === 'photo' ? 'Create video clip' : 'Apply camera motion'}
            </button>
          </Panel>
        )}
        {panel &&
          [
            'background',
            'focus',
            'blur',
            'zoom',
            'fov',
            'camera',
            'rotation',
            'frame',
            'shadow',
            'aspect',
            'inspector',
          ].includes(panel) && (
            <Panel
              title={titleFor(panel as InspectorKind)}
              onClose={closePanel}
              centered={panel === 'inspector'}
              wide={panel === 'inspector'}
            >
              <Inspector
                kind={panel as InspectorKind}
                assets={assets}
                onImport={chooseFiles}
                onPickFocus={pickFocus}
              />
            </Panel>
          )}
        {panel === 'help' && (
          <Panel title="Help & shortcuts" onClose={closePanel} centered>
            <p className="panel-note">
              Import media, frame it on the canvas, and refine it in Properties.
            </p>
            <ol className="help-steps">
              <li>Import, drop or paste an image or screenshot.</li>
              <li>Pick a background preset or gradient, then set the angle and zoom.</li>
              <li>Round the corners, adjust the shadow and add text or a logo.</li>
              <li>Choose Manual focus and click your subject for depth blur.</li>
              <li>Copy the result to the clipboard or export a full-resolution PNG.</li>
            </ol>
            <div className="section-label">Shortcuts</div>
            <dl className="shortcuts">
              {[
                ['Import media', `${mod} O`],
                ['Export', `${mod} E`],
                ['Save now', `${mod} S`],
                ['Undo', `${mod} Z`],
                ['Redo', `${mod} Shift Z`],
                ['Copy / cut / paste', `${mod} C / X / V`],
                ['Delete selection', 'Delete'],
                ['Play / pause', 'Space'],
                ['Step one frame', '← / →'],
                ['Step one second', 'Shift ← / →'],
                ['Timeline start / end', 'Home / End'],
                ['Split clip', `${mod} B`],
                ['Zoom timeline', `${mod} + scroll`],
                ['Rotate on canvas', `${mod} + drag`],
                ['Zoom on canvas', `${mod} + scroll`],
                ['Show shortcuts', '?'],
                ['Close panel', 'Esc'],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd>
                    <kbd>{b}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="panel-note">Download a project package to keep an editable backup.</p>
          </Panel>
        )}
        {panel === 'settings' && (
          <Panel title="Settings" onClose={closePanel} centered wide>
            <WorkspaceSettings
              theme={themeOverride ?? 'system'}
              onTheme={setThemePreference}
              quality={quality}
              onQuality={setQuality}
              assets={assets}
              onImport={chooseFiles}
              onPickFocus={pickFocus}
            />
          </Panel>
        )}
        {recording && (
          <div className="recording-bar" role="status">
            <span className="record-dot" /> Recording · {Math.floor(recordTime / 60)}:
            {(recordTime % 60).toString().padStart(2, '0')}
            <button onClick={() => recorder.current?.stop()}>
              <Square size={13} fill="currentColor" /> Stop recording
            </button>
          </div>
        )}
        {importStatus && (
          <div className="import-status" role="status">
            <span className="spinner" />
            {importStatus}
          </div>
        )}
        {toast && (
          <div
            key={toast.text}
            className="toast"
            data-tone={toast.tone}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-icon" aria-hidden="true">
              {toast.tone === 'error' ? (
                <AlertCircle size={16} />
              ) : toast.tone === 'success' ? (
                <CircleCheck size={16} />
              ) : (
                <Info size={16} />
              )}
            </span>
            <span>{toast.text}</span>
            <IconButton label="Dismiss message" onClick={() => setToast(null)}>
              <X size={14} />
            </IconButton>
          </div>
        )}
        {dragOver && (
          <div className="drop-overlay">
            <Upload size={36} />
            <strong>Drop it into the studio.</strong>
            <span>Images, videos, and SVG logos</span>
          </div>
        )}
        {exporting && project && (
          <ExportDialog onClose={closeExport} onSaved={() => void refresh()} />
        )}
      </main>
    </Theme>
  );
}
