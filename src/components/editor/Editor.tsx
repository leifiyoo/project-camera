'use client';
import dynamic from 'next/dynamic';
import { Theme } from '@radix-ui/themes';
import { DropdownMenu } from 'radix-ui';
import { UIIcon } from './UIIcon';
import { PaperSegmentedControl } from '@/components/ui/paper-segmented-control';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  Plus,
  FolderOpen,
  Undo2,
  Redo2,
  Download,
  Scan,
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
} from 'lucide-react';
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
import { timelineSpans } from '@/lib/studio/evaluate';
import { composeScene, type Direction } from '@/lib/studio/compose';
import { createDemo } from '@/lib/studio/demo';
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
let bootstrap: Promise<Project> | undefined;
async function boot() {
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
    [theme, setTheme] = useState('light'),
    [saveStatus, setSaveStatus] = useState('Saved'),
    [message, setMessage] = useState(''),
    [importStatus, setImportStatus] = useState(''),
    [dragOver, setDragOver] = useState(false),
    [recording, setRecording] = useState(false),
    [recordTime, setRecordTime] = useState(0),
    [direction, setDirection] = useState<Direction>('macroGlide');
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
  const closePanel = useCallback(() => setPanel(null), []),
    error = useCallback((s: string) => setMessage(s), []),
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
    const storedTheme =
        localStorage.getItem('studio-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      storedQuality = localStorage.getItem('studio-quality') === 'draft' ? 'draft' : 'high';
    setTheme(storedTheme);
    setQuality(storedQuality);
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
        setMessage(storageError(e));
        try {
          const p = makeProject();
          if (active) {
            useStudio.getState().load(p);
            void refresh();
          }
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Could not open the project.');
        }
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('studio-theme', theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('studio-quality', quality);
  }, [quality]);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(''), 9000);
    return () => clearTimeout(timeout);
  }, [message]);
  useEffect(() => {
    if (!project) return;
    // Remember the selected document immediately. A field transaction can replace
    // the debounce timer, so selection must not depend on that timer firing.
    localStorage.setItem('studio-last-project', project.id);
    setSaveStatus('Saving');
    if (saving.current) clearTimeout(saving.current);
    saving.current = setTimeout(() => {
      const p = useStudio.getState().project!;
      void saveProject(p)
        .then(() => {
          setSaveStatus('Saved');
          if (useStudio.getState().project?.id === p.id)
            localStorage.setItem('studio-last-project', p.id);
        })
        .catch((e) => {
          setSaveStatus('Unsaved');
          setMessage(storageError(e));
        });
    }, 600);
    return () => {
      if (saving.current) clearTimeout(saving.current);
    };
  }, [project]);
  useEffect(() => {
    const unsub = useStudio.subscribe((s, prev) => {
      if (prev.transaction && !s.transaction && s.project) {
        if (saving.current) clearTimeout(saving.current);
        saving.current = setTimeout(
          () =>
            void saveProject(s.project!)
              .then(() => setSaveStatus('Saved'))
              .catch((e) => {
                setSaveStatus('Unsaved');
                setMessage(storageError(e));
              }),
          600,
        );
      }
    });
    return unsub;
  }, []);
  const importFiles = useCallback(
    async (files: File[], purpose: MediaTarget = 'media') => {
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
            current!.assetId = imported[0].id;
            current!.name = imported[0].name.replace(/\.[^.]+$/, '');
            current!.kind = 'media';
            current!.trimIn = 0;
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
      setMessage(
        errors.join(' ') || `${successful} ${successful === 1 ? 'file' : 'files'} imported.`,
      );
      await refresh();
    },
    [refresh],
  );
  const chooseFiles = useCallback((purpose: MediaTarget = 'media') => {
    target.current = purpose;
    if (fileInput.current) {
      fileInput.current.accept =
        purpose === 'logo' || purpose === 'background' ? 'image/*,.svg' : ACCEPT;
      fileInput.current.click();
    }
  }, []);
  const choosePhoto = useCallback(() => {
    setPanel(null);
    photoInput.current?.click();
  }, []);
  const addAsset = (a: Asset) => {
    const s = useStudio.getState();
    if (s.mode === 'photo')
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
      if (editable(e.target) || exporting) return;
      const s = useStudio.getState(),
        current = selectedScene(s);
      const cmd = e.ctrlKey || e.metaKey;
      if (
        (e.key === ' ' || e.key === 'Enter') &&
        (e.target as Element)?.closest('button,summary,a[href],[role="button"]')
      )
        return;
      if (cmd && e.key.toLowerCase() === 'z') {
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
        setMessage(
          layer ? 'Layer copied. Paste to duplicate.' : 'Scene copied. Paste to duplicate.',
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
  }, [importFiles, exporting]);
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
      setMessage(
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
        setMessage('Screen recording failed. Try a different source or import a video.');
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
          if (saveError) setMessage(storageError(saveError));
          const scene = makeScene(record.meta);
          useStudio.getState().edit((p) => p.scenes.push(scene));
          useStudio.getState().setMode('video');
          useStudio.getState().selectScene(scene.id);
          await refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Could not import the recording.');
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
        setMessage(e.message);
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
      setMessage(storageError(e));
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
      setMessage(storageError(e));
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
      setMessage(storageError(e));
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
      setMessage(storageError(e));
    }
  };
  const packageExport = async () => {
    if (!project) return;
    setImportStatus('Preparing project package');
    try {
      const { packProject } = await import('@/lib/storage/package');
      download(await packProject(project), `${filename(project.name)}.studio.zip`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not package the project.');
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
      state.editScene((s) => Object.assign(s, composeScene(s, direction, true)));
      const span = timelineSpans(state.project!).find((s) => s.scene.id === scene.id)!;
      runtime.set({ time: span.start, playing: false });
    }
    setPanel(null);
    setMessage('Camera path ready. Edit its positions in the timeline.');
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
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="studio-mark"
              title="Interface Studio help"
              aria-label="Interface Studio help"
              onClick={() => setPanel('help')}
            >
              <Camera size={20} />
            </button>
            <span className="studio-wordmark">Studio</span>
            <span className="top-divider" />
            <button
              className={`project-trigger ${panel === 'projects' ? 'selected' : ''}`}
              aria-label="Projects"
              aria-expanded={panel === 'projects'}
              onClick={() => {
                void refresh();
                setPanel(panel === 'projects' ? null : 'projects');
              }}
            >
              <span>{project?.name || 'Opening project'}</span>
              <ChevronDown size={13} />
            </button>
          </div>
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
          <div className="topbar-right">
            {mode === 'photo' ? (
              <button
                className="secondary upload-photo-button"
                aria-label="Upload photo"
                disabled={!project || !!importStatus}
                onClick={choosePhoto}
              >
                <ImagePlus size={16} />
                <span>Upload photo</span>
              </button>
            ) : (
              <button
                className="secondary add-media-button"
                aria-label="Import media"
                disabled={!project}
                onClick={() => chooseFiles('media')}
              >
                <Plus size={16} />
                <span>Import media</span>
              </button>
            )}
            <button
              className="export-button"
              disabled={
                !project ||
                (mode === 'video' && !project.scenes.length) ||
                (mode === 'photo' && !project.photo.assetId && !project.photo.layers.length)
              }
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
                    title="Preview quality. Export always uses full resolution."
                    onSelect={() => setQuality(quality === 'high' ? 'draft' : 'high')}
                  >
                    <UIIcon name="settings" />
                    <span>Preview quality</span>
                    <small>{quality === 'high' ? 'High' : 'Draft'}</small>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="paper-menu-item"
                    aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                    onSelect={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  >
                    <UIIcon name="settings" />
                    <span>{theme === 'light' ? 'Dark appearance' : 'Light appearance'}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="paper-menu-separator" />
                  <DropdownMenu.Item
                    className="paper-menu-item"
                    onSelect={() => setPanel('settings')}
                  >
                    <UIIcon name="settings" />
                    <span>Settings</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className="paper-menu-item" onSelect={() => setPanel('help')}>
                    <UIIcon name="help" />
                    Help and shortcuts
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <div className="workspace">
          <section className="preview-column" aria-label="Preview workspace">
            <div className="workspace-toolbar">
              <button
                className="text-button library-button"
                onClick={() => {
                  void refresh();
                  setPanel(panel === 'library' ? null : 'library');
                }}
              >
                <FolderOpen size={15} />
                Library
              </button>
              {mode === 'photo' && (
                <button
                  className={`text-button compose-button ${panel === 'compose' ? 'active' : ''}`}
                  aria-label="Compose"
                  disabled={!scene?.assetId}
                  onClick={() => setPanel(panel === 'compose' ? null : 'compose')}
                >
                  <Film size={15} />
                  <span>Animate camera</span>
                </button>
              )}
              <div className="history-tools">
                <IconButton
                  label="Undo · Ctrl Z"
                  disabled={!canUndo}
                  onClick={() => useStudio.getState().undo()}
                >
                  <Undo2 size={16} />
                </IconButton>
                <IconButton
                  label="Redo · Ctrl Shift Z"
                  disabled={!canRedo}
                  onClick={() => useStudio.getState().redo()}
                >
                  <Redo2 size={16} />
                </IconButton>
              </div>
            </div>
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
                  <button
                    className="primary"
                    onClick={mode === 'video' ? () => chooseFiles('media') : choosePhoto}
                  >
                    <Upload size={16} />
                    {mode === 'video' ? 'Import media' : 'Upload photo'}
                  </button>
                  <small>Or drag a file into this workspace</small>
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
        <footer className="studio-footer">
          <span>
            <span className={`save-dot ${saveStatus === 'Unsaved' ? 'unsaved' : ''}`} />
            {saveStatus}
            <span className="footer-separator">/</span>Stored on this device
          </span>
          <span>
            {mode === 'video'
              ? 'Space to play · Ctrl Z to undo'
              : 'Drag to move. Ctrl + drag to rotate.'}
          </span>
        </footer>

        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept={ACCEPT}
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
              setMessage('Project and referenced media imported.');
            } catch (e) {
              setMessage(
                e instanceof Error ? e.message : 'This project package could not be read.',
              );
            } finally {
              setImportStatus('');
            }
          }}
        />
        {panel === 'projects' && (
          <Panel title="Your projects" onClose={closePanel} side>
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
              {projects.map((p) => (
                <div key={p.id} className={p.id === project?.id ? 'current' : ''}>
                  <button onClick={() => void switchProject(p.id)}>
                    <Camera size={17} />
                    <span>
                      <b>{p.id === project?.id ? project.name : p.name}</b>
                      <small>
                        {new Date(p.updatedAt).toLocaleDateString()} · {p.scenes.length} scenes
                      </small>
                    </span>
                    {p.id === project?.id && <Check size={14} />}
                  </button>
                  <IconButton
                    label={`Duplicate ${p.name}`}
                    onClick={() => void duplicateProject(p)}
                  >
                    <Copy size={14} />
                  </IconButton>
                  <IconButton label={`Delete ${p.name}`} onClick={() => void removeProject(p)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
            <button className="secondary full" onClick={() => void newProject()}>
              <Plus size={15} /> New project
            </button>
            <div className="section-label">PORTABLE PROJECT</div>
            <button className="text-button full" onClick={() => void packageExport()}>
              <Download size={15} /> Download project package
            </button>
            <button className="text-button full" onClick={() => packageInput.current?.click()}>
              <Upload size={15} /> Open project package
            </button>
            <p className="panel-note">
              Packages include the document and original media. No account or cloud needed.
            </p>
          </Panel>
        )}
        {(panel === 'media' || panel === 'library') && (
          <Panel
            title={panel === 'media' ? 'Add media' : 'Media library'}
            onClose={closePanel}
            side
            wide
          >
            <div className="media-import-actions">
              <button className="secondary" onClick={() => chooseFiles()}>
                <Upload size={16} /> Import files
              </button>
              <button className="secondary" onClick={() => void startRecording()}>
                <Monitor size={16} /> Record screen
              </button>
            </div>
            <p className="panel-note">
              PNG, JPG, WEBP, AVIF, GIF, SVG · MP4, MOV, WEBM
              <br />
              Drop files anywhere, or paste an image.
            </p>
            <div className="section-label">
              {panel === 'library' ? 'SAVED MEDIA' : 'YOUR ASSETS'} <span>{assets.length}</span>
            </div>
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
                    <small>{new Date(a.createdAt).toLocaleDateString()}</small>
                    {a.note && <small className="asset-note">{a.note}</small>}
                    <div className="asset-actions">
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            const r = await resolveAsset(a.id);
                            download(r.blob, mediaFilename(r));
                          } catch (e) {
                            setMessage(
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
                            setMessage(
                              e instanceof Error ? e.message : 'Could not delete the media.',
                            );
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
          <Panel title="Compose a camera path" onClose={closePanel}>
            <p className="panel-note compose-intro">
              Smooth four to six second camera paths, built locally from your surface and marked
              details.
            </p>
            <div className="direction-list">
              {(
                [
                  {
                    value: 'macroGlide',
                    label: 'Macro Glide',
                    detail:
                      'Travel slowly across a close crop, with a subtle change in perspective.',
                    icon: Film,
                  },
                  {
                    value: 'focusPull',
                    label: 'Focus Pull',
                    detail: 'Hold the camera steady and shift focus between two image details.',
                    icon: Focus,
                  },
                  {
                    value: 'hero',
                    label: 'Hero Reveal',
                    detail: 'Open from a close detail into a complete, floating product view.',
                    icon: Scan,
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
                  <d.icon size={23} />
                  <span>
                    <b>{d.label}</b>
                    <small>{d.detail}</small>
                  </span>
                  {direction === d.value && <Check size={15} />}
                </button>
              ))}
            </div>
            <p className="panel-note">
              {scene?.points.length
                ? `${scene.points.length} marked ${scene.points.length === 1 ? 'detail' : 'details'}. ${direction === 'focusPull' ? 'The first two details guide the focus; a missing second mark uses the opposite side.' : 'The first detail guides the focus.'}`
                : 'Use the mark tool beside the canvas to choose image details. Your current manual focus is used when no detail is marked; Focus Pull adds a second point on the opposite side.'}
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
              <Focus size={16} />{' '}
              {mode === 'photo' ? 'Create motion scene' : 'Compose new variation'}
            </button>
            <p className="panel-note">
              Generated positions remain editable in the timeline. Undo restores the previous path.
            </p>
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
            'settings',
            'frame',
            'shadow',
            'aspect',
            'inspector',
          ].includes(panel) && (
            <Panel title={titleFor(panel as InspectorKind)} onClose={closePanel}>
              <Inspector
                kind={panel as InspectorKind}
                assets={assets}
                onImport={chooseFiles}
                onPickFocus={pickFocus}
              />
            </Panel>
          )}
        {panel === 'help' && (
          <Panel title="Using the studio" onClose={closePanel}>
            <p className="panel-note">
              Bring in a screenshot, find an angle, and take a photo. Switch to Video to tell a
              longer story.
            </p>
            <ol className="help-steps">
              <li>Import or choose a demo from Add media.</li>
              <li>Choose a look, or adjust your angle in Camera.</li>
              <li>Select MF and click your subject to focus.</li>
              <li>Compose a camera path, or add keyframes yourself.</li>
              <li>Export a full-resolution PNG or silent video.</li>
            </ol>
            <div className="section-label">SHORTCUTS</div>
            <dl className="shortcuts">
              {[
                ['Undo', 'Ctrl Z'],
                ['Redo', 'Ctrl Shift Z'],
                ['Copy / cut / paste', 'Ctrl C / X / V'],
                ['Delete selection', 'Delete'],
                ['Play / pause', 'Space'],
                ['Timeline beginning', 'Enter'],
                ['Rotate on canvas', 'Ctrl + drag'],
                ['Zoom on canvas', 'Ctrl + scroll'],
                ['Close panel', 'Esc'],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd>{b}</dd>
                </div>
              ))}
            </dl>
            <button
              className="secondary full"
              onClick={async () => {
                try {
                  if (project) await saveProject(project);
                  const p = await createDemo();
                  useStudio.getState().load(p);
                  await refresh();
                  setPanel(null);
                } catch (e) {
                  setMessage(storageError(e));
                }
              }}
            >
              <Camera size={15} /> Open a fresh example project
            </button>
            <p className="panel-note">
              Everything stays in this browser. Keep a project package as a portable backup. Video
              support depends on the browser and source codec.
            </p>
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
        {message && (
          <div className="toast" role="status">
            <span>{message}</span>
            <IconButton label="Dismiss message" onClick={() => setMessage('')}>
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
