'use client';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type RefObject,
} from 'react';
import { DropdownMenu } from 'radix-ui';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  Type,
  Copy,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Diamond,
  Upload,
  Square,
  Minus,
  ImagePlus,
  Scissors,
} from '@/components/ui/studio-icons';
import { useStudio } from '@/lib/studio/store';
import { runtime } from '@/lib/studio/runtime';
import { timelineSpans, totalDuration } from '@/lib/studio/evaluate';
import { clone, makeScene, uid, clamp, type Asset, type Scene } from '@/lib/studio/model';
import { moveClip, resizeClip, splitClip } from '@/lib/studio/timeline-edit';
import { IconButton } from './primitives';
import TransitionPicker from './TransitionPicker';

export function timeLabel(time: number) {
  const hundredths = Math.max(0, Math.round(time * 100));
  return `${Math.floor(hundredths / 6000)
    .toString()
    .padStart(2, '0')}:${((hundredths % 6000) / 100).toFixed(2).padStart(5, '0')}`;
}
export function PlaybackControls() {
  const r = useSyncExternalStore(runtime.subscribe, runtime.get, runtime.get);
  const duration = useStudio((s) => (s.project ? totalDuration(s.project) : 0));
  return (
    <div className="playback">
      <IconButton
        label="Go to beginning"
        disabled={!duration}
        onClick={() => runtime.set({ time: 0, playing: false })}
      >
        <SkipBack size={15} />
      </IconButton>
      <IconButton
        label={r.playing ? 'Pause' : 'Play'}
        disabled={!duration}
        onClick={() => {
          useStudio.getState().selectKey(null);
          runtime.set({ playing: !r.playing, time: r.time >= duration ? 0 : r.time });
        }}
      >
        {r.playing ? <Pause size={16} /> : <Play size={16} />}
      </IconButton>
      <IconButton
        label="Go to end"
        disabled={!duration}
        onClick={() => runtime.set({ time: duration, playing: false })}
      >
        <SkipForward size={15} />
      </IconButton>
      <span className="time-code">
        {timeLabel(Math.min(r.time, duration))} <em>/ {timeLabel(duration)}</em>
      </span>
    </div>
  );
}
function Playhead({
  scale,
  scroller,
}: {
  scale: number;
  scroller: RefObject<HTMLDivElement | null>;
}) {
  const r = useSyncExternalStore(runtime.subscribe, runtime.get, runtime.get);
  useEffect(() => {
    // Keep the playhead visible during playback by paging the track along with it.
    const element = scroller.current;
    if (!r.playing || !element) return;
    const x = r.time * scale;
    if (x < element.scrollLeft || x > element.scrollLeft + element.clientWidth - 24)
      element.scrollTo({ left: Math.max(0, x - 48) });
  }, [r.time, r.playing, scale, scroller]);
  return (
    <div className="playhead" style={{ left: r.time * scale }}>
      <span />
    </div>
  );
}

function splitAtPlayhead() {
  const state = useStudio.getState();
  if (!state.project) return;
  const span = timelineSpans(state.project).find((s) => s.scene.id === state.sceneId);
  if (!span) return;
  const pair = splitClip(span.scene, runtime.get().time - span.start);
  if (!pair) return;
  runtime.set({ playing: false });
  state.edit((p) =>
    p.scenes.splice(
      p.scenes.findIndex((s) => s.id === span.scene.id),
      1,
      ...pair,
    ),
  );
  state.selectScene(pair[1].id);
}
function SplitButton() {
  const r = useSyncExternalStore(runtime.subscribe, runtime.get, runtime.get);
  const project = useStudio((s) => s.project);
  const selected = useStudio((s) => s.sceneId);
  const span = project && timelineSpans(project).find((s) => s.scene.id === selected);
  const local = span ? r.time - span.start : 0;
  const enabled = !!span && local >= 0.1 && local <= span.scene.duration - 0.1;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b') return;
      if (
        (e.target instanceof Element &&
          e.target.closest('input,textarea,[contenteditable], [role="dialog"]')) ||
        document.querySelector('[role="dialog"], [data-studio-popup]')
      )
        return;
      e.preventDefault();
      splitAtPlayhead();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <button
      className="text-button split-clip-button"
      disabled={!enabled}
      title="Split at playhead · Ctrl B"
      onClick={splitAtPlayhead}
    >
      <Scissors size={14} /> Split
    </button>
  );
}
type Drag = {
  id: string;
  x: number;
  scale: number;
  original: Scene;
  edge?: 'start' | 'end';
  center: number;
  centers: number[];
  target: number;
  moved: boolean;
};

export default function Timeline({
  assets,
  onAdd,
  onInspector,
}: {
  assets: Asset[];
  onAdd: () => void;
  onInspector: () => void;
}) {
  const project = useStudio((s) => s.project);
  const selected = useStudio((s) => s.sceneId);
  const keyId = useStudio((s) => s.keyId);
  const track = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const gesture = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(600);
  const [dragScale, setDragScale] = useState<number | null>(null);
  const [visual, setVisual] = useState<{ id: string; x: number; target: number } | null>(null);
  const duration = project ? totalDuration(project) : 0;
  const scale = dragScale ?? clamp((width * 0.9) / Math.max(2, duration + 0.8), 12, 480) * zoom;
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((v) => clamp(v * (e.deltaY < 0 ? 1.25 : 0.8), 0.25, 4));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener('wheel', wheel);
    };
  }, []);
  useEffect(
    () => () => {
      useStudio.getState().commit();
    },
    [],
  );
  if (!project) return null;
  const spans = timelineSpans(project);
  const selectedSpan = spans.find((s) => s.scene.id === selected);
  const state = useStudio.getState();
  const select = (id: string) => {
    state.selectScene(id);
    const span = timelineSpans(useStudio.getState().project!).find((s) => s.scene.id === id);
    runtime.set({ time: span?.start || 0, playing: false });
  };
  const addScene = (text: boolean) => {
    const scene = makeScene(undefined, text);
    state.edit((p) => p.scenes.push(scene));
    select(scene.id);
    if (text) {
      state.selectLayer(scene.layers[0].id);
      onInspector();
    }
  };
  const reorder = (delta: number) => {
    if (!selectedSpan) return;
    state.edit((p) =>
      moveClip(
        p.scenes,
        selectedSpan.scene.id,
        p.scenes.findIndex((s) => s.id === selectedSpan.scene.id) + delta,
      ),
    );
    select(selectedSpan.scene.id);
  };
  const remove = () => {
    if (!selectedSpan) return;
    const index = project.scenes.findIndex((s) => s.id === selectedSpan.scene.id);
    state.edit((p) => {
      p.scenes.splice(index, 1);
    });
    const remaining = useStudio.getState().project!.scenes;
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) select(next.id);
    else {
      state.selectScene(null);
      runtime.set({ time: 0, playing: false });
    }
  };
  const scrub = (e: PointerEvent) => {
    if (!track.current || !duration) return;
    const time = clamp(
      (e.clientX - track.current.getBoundingClientRect().left) / scale,
      0,
      duration,
    );
    const active = spans.filter((s) => time >= s.start && time < s.end).at(-1) || spans.at(-1);
    if (active) state.selectScene(active.scene.id);
    runtime.set({ time, playing: false });
  };
  const startDrag = (e: PointerEvent<HTMLButtonElement>, scene: Scene, edge?: 'start' | 'end') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    select(scene.id);
    if (edge) state.begin();
    const span = spans.find((s) => s.scene.id === scene.id)!;
    gesture.current = {
      id: scene.id,
      x: e.clientX,
      scale,
      original: clone(scene),
      edge,
      center: span.start + scene.duration / 2,
      centers: spans
        .filter((s) => s.scene.id !== scene.id)
        .map((s) => s.start + s.scene.duration / 2),
      target: project.scenes.findIndex((s) => s.id === scene.id),
      moved: false,
    };
    suppressClick.current = false;
    setDragScale(scale);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: PointerEvent<HTMLButtonElement>) => {
    const d = gesture.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    if (!d.moved) return;
    if (d.edge) {
      const updated = resizeClip(
        d.original,
        d.edge,
        dx / d.scale,
        assets.find((a) => a.id === d.original.assetId),
      );
      state.edit((p) => {
        const scene = p.scenes.find((s) => s.id === d.id);
        if (scene) Object.assign(scene, updated);
      });
    } else {
      d.target = d.centers.filter((center) => center < d.center + dx / d.scale).length;
      setVisual({ id: d.id, x: dx, target: d.target });
    }
  };
  const finishDrag = (cancelled = false) => {
    const d = gesture.current;
    if (!d) return;
    if (!cancelled && d.moved && !d.edge) state.edit((p) => moveClip(p.scenes, d.id, d.target));
    if (cancelled && d.edge)
      state.edit((p) => {
        const scene = p.scenes.find((s) => s.id === d.id);
        if (scene) Object.assign(scene, d.original);
      });
    state.commit();
    suppressClick.current = d.moved;
    gesture.current = null;
    setDragScale(null);
    setVisual(null);
    select(d.id);
  };
  const rulerStep = scale >= 300 && duration < 3 ? 0.5 : scale >= 48 ? 1 : scale >= 24 ? 2 : 5;
  const rulerEnd = Math.max(duration, width / scale);
  return (
    <section
      className="timeline video-timeline"
      data-empty={!spans.length || undefined}
      aria-label="Video timeline"
    >
      <div className="timeline-head">
        <div className="timeline-title">
          Timeline{' '}
          <span>
            {spans.length} {spans.length === 1 ? 'scene' : 'scenes'}
          </span>
        </div>
        {!!spans.length && <PlaybackControls />}
        <div className="timeline-add-actions">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="secondary add-scene-button" aria-label="Add scene">
                <Plus size={15} /> Add scene
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="paper-menu"
                data-studio-popup
                side="top"
                align="end"
                sideOffset={8}
              >
                <DropdownMenu.Item className="paper-menu-item" onSelect={onAdd}>
                  <Upload size={14} /> From a file
                </DropdownMenu.Item>
                <DropdownMenu.Item className="paper-menu-item" onSelect={() => addScene(false)}>
                  <Square size={14} /> Blank scene
                </DropdownMenu.Item>
                <DropdownMenu.Item className="paper-menu-item" onSelect={() => addScene(true)}>
                  <Type size={14} /> Text scene
                </DropdownMenu.Item>
                {!!project.photo.assetId && (
                  <DropdownMenu.Item
                    className="paper-menu-item"
                    onSelect={() => {
                      const scene = clone(project.photo);
                      scene.id = uid();
                      scene.layers.forEach((layer) => {
                        layer.id = uid();
                      });
                      scene.keyframes = [];
                      state.edit((p) => p.scenes.push(scene));
                      select(scene.id);
                    }}
                  >
                    <ImagePlus size={14} /> Use current photo
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
      <div className="timeline-scroll" ref={scroll}>
        {spans.length ? (
          <div
            className="timeline-track"
            ref={track}
            style={{ width: Math.max(width, duration * scale + 100) }}
            onPointerDown={(e) => {
              if (e.target !== e.currentTarget || e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              scrub(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1 && e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e);
            }}
          >
            <div
              className="time-ruler"
              aria-label="Seek video"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrub(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) scrub(e);
              }}
            >
              {Array.from(
                { length: Math.min(2000, Math.ceil(rulerEnd / rulerStep) + 1) },
                (_, i) => (
                  <span key={i} style={{ left: i * rulerStep * scale }}>
                    {i * rulerStep}s
                  </span>
                ),
              )}
            </div>
            {spans.map(({ scene, start, overlap }, i) => {
              const asset = assets.find((a) => a.id === scene.assetId);
              const moving = visual?.id === scene.id;
              const displayDuration =
                scene.duration - overlap / 2 - (spans[i + 1]?.overlap || 0) / 2;
              return (
                <div
                  key={scene.id}
                  data-scene-id={scene.id}
                  data-compact={displayDuration * scale < 145 || undefined}
                  className={`scene-clip${selected === scene.id ? ' selected' : ''}${moving ? ' is-moving' : ''}`}
                  style={{
                    left: (start + overlap / 2) * scale,
                    width: displayDuration * scale,
                    transform: moving ? `translateX(${visual.x}px)` : undefined,
                    zIndex: moving ? spans.length + 1 : i + 1,
                  }}
                >
                  <button
                    className="clip-content"
                    aria-label={`Select scene ${i + 1}: ${scene.name}`}
                    title="Drag to reorder · drag either edge to change length"
                    onPointerDown={(e) => startDrag(e, scene)}
                    onPointerMove={moveDrag}
                    onPointerUp={() => finishDrag()}
                    onPointerCancel={() => finishDrag(true)}
                    onLostPointerCapture={() => {
                      if (gesture.current) finishDrag(true);
                    }}
                    onClick={() => {
                      if (!suppressClick.current) select(scene.id);
                      suppressClick.current = false;
                    }}
                    onDoubleClick={onInspector}
                  >
                    {asset ? (
                      <img src={asset.thumbnail} alt="" draggable={false} />
                    ) : (
                      <div className="text-thumb">
                        {scene.kind === 'text' ? 'Aa' : <Square size={18} />}
                      </div>
                    )}
                    <span>
                      <b>{scene.name}</b>
                      <small>
                        {scene.duration.toFixed(1)}s
                        {asset?.kind === 'video'
                          ? ' · Video'
                          : scene.kind === 'text'
                            ? ' · Text'
                            : ' · Still'}
                      </small>
                    </span>
                  </button>
                  {(['start', 'end'] as const).map((edge) => (
                    <button
                      key={edge}
                      className={`clip-handle clip-handle-${edge}`}
                      aria-label={`${edge === 'start' ? 'Resize start of' : 'Resize end of'} ${scene.name}`}
                      title={`${edge === 'start' ? 'Start' : 'End'} · drag to resize`}
                      onPointerDown={(e) => startDrag(e, scene, edge)}
                      onPointerMove={moveDrag}
                      onPointerUp={() => finishDrag()}
                      onPointerCancel={() => finishDrag(true)}
                      onLostPointerCapture={() => {
                        if (gesture.current) finishDrag(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                        e.preventDefault();
                        const updated = resizeClip(
                          scene,
                          edge,
                          (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1),
                          asset,
                        );
                        state.edit((p) =>
                          Object.assign(
                            p.scenes.find((s) => s.id === scene.id)!,
                            updated,
                          ),
                        );
                      }}
                    />
                  ))}
                  {scene.keyframes.map((key) => (
                    <button
                      key={key.id}
                      className={`key-dot ${keyId === key.id ? 'active' : ''}`}
                      style={{ left: clamp(key.time - overlap / 2, 0, displayDuration) * scale }}
                      aria-label={`Camera keyframe at ${key.time.toFixed(2)} seconds in ${scene.name}`}
                      onClick={() => {
                        state.selectScene(scene.id);
                        state.selectKey(key.id);
                        runtime.set({ time: start + key.time, playing: false });
                        onInspector();
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        runtime.set({ playing: false });
                        state.begin();
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons !== 1 || !track.current) return;
                        const time = clamp(
                          (e.clientX - track.current.getBoundingClientRect().left) / scale - start,
                          0,
                          scene.duration,
                        );
                        state.edit((p) => {
                          p.scenes
                            .find((s) => s.id === scene.id)!
                            .keyframes.find((k) => k.id === key.id)!.time = time;
                        });
                      }}
                      onPointerUp={state.commit}
                      onPointerCancel={state.commit}
                    >
                      <Diamond size={10} fill="currentColor" />
                    </button>
                  ))}
                </div>
              );
            })}
            {spans.slice(1).map(({ scene, start, overlap }) => (
              <div
                className="timeline-transition"
                key={`transition-${scene.id}`}
                style={{ left: (start + overlap / 2) * scale }}
              >
                <TransitionPicker sceneId={scene.id} />
              </div>
            ))}
            {visual && (
              <div
                className="clip-drop-marker"
                style={{ left: (spans[visual.target]?.start ?? duration) * scale }}
              />
            )}
            <Playhead scale={scale} scroller={scroll} />
          </div>
        ) : (
          <button className="empty-timeline" onClick={onAdd}>
            <Plus size={18} />
            <span>Add your first clip</span>
          </button>
        )}
      </div>
      {!!spans.length && (
        <div className="timeline-bottom">
          <div className="timeline-actions">
            <SplitButton />
            <IconButton
              label="Move scene left"
              disabled={!selectedSpan || selectedSpan === spans[0]}
              onClick={() => reorder(-1)}
            >
              <ArrowLeft size={14} />
            </IconButton>
            <IconButton
              label="Move scene right"
              disabled={!selectedSpan || selectedSpan === spans.at(-1)}
              onClick={() => reorder(1)}
            >
              <ArrowRight size={14} />
            </IconButton>
            <IconButton
              label="Duplicate scene"
              disabled={!selectedSpan}
              onClick={() => {
                if (!selectedSpan) return;
                const scene = clone(selectedSpan.scene);
                scene.id = uid();
                scene.layers.forEach((l) => {
                  l.id = uid();
                });
                scene.keyframes.forEach((k) => {
                  k.id = uid();
                });
                state.edit((p) =>
                  p.scenes.splice(
                    p.scenes.findIndex((s) => s.id === selectedSpan.scene.id) + 1,
                    0,
                    scene,
                  ),
                );
                select(scene.id);
              }}
            >
              <Copy size={14} />
            </IconButton>
            <IconButton label="Delete selected scene" disabled={!selectedSpan} onClick={remove}>
              <Trash2 size={14} />
            </IconButton>
            <span className="timeline-help">Drag to reorder · trim from either edge</span>
          </div>
          <div className="timeline-zoom">
            <button
              className="text-button fit-timeline"
              title="Fit timeline to workspace"
              onClick={() => setZoom(1)}
            >
              Fit
            </button>
            <IconButton
              label="Zoom out timeline"
              disabled={zoom <= 0.25}
              onClick={() => setZoom((v) => Math.max(0.25, v / 2))}
            >
              <Minus size={13} />
            </IconButton>
            <span>{Math.round(zoom * 100)}%</span>
            <IconButton
              label="Zoom in timeline"
              disabled={zoom >= 4}
              onClick={() => setZoom((v) => Math.min(4, v * 2))}
            >
              <Plus size={13} />
            </IconButton>
          </div>
        </div>
      )}
    </section>
  );
}
