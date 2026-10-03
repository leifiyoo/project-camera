'use client';
import { useEffect, useRef, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { useStudio, selectedScene } from '@/lib/studio/store';
import { runtime } from '@/lib/studio/runtime';
import {
  evaluateProjectAtTime,
  totalDuration,
  timelineSpans,
  cameraAtTime,
} from '@/lib/studio/evaluate';
import { clamp } from '@/lib/studio/model';
import type { StudioRenderer } from '@/lib/render/engine';
import type { Asset } from '@/lib/studio/model';
import type { MediaTarget } from './Inspector';
import QuickAccessBar, { type CanvasTool as Tool } from './QuickAccessBar';
export default function Stage({
  quality,
  focusRequest,
  onLayers,
  assets,
  onImport,
  onPickFocus,
  onError,
  locked,
  minimal = false,
}: {
  quality: 'high' | 'draft';
  focusRequest: number;
  onLayers: () => void;
  assets: Asset[];
  onImport: (target: MediaTarget) => void;
  onPickFocus: () => void;
  onError: (s: string) => void;
  locked: boolean;
  minimal?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    focusMarker = useRef<HTMLDivElement>(null),
    engine = useRef<StudioRenderer | null>(null);
  const [toolSelection, setToolSelection] = useState({ tool: 'move' as Tool, focusRequest });
  const requestedTool = toolSelection.focusRequest === focusRequest ? toolSelection.tool : 'focus';
  const setTool = (next: Tool) => setToolSelection({ tool: next, focusRequest });
  const [loading, setLoading] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [size, setSize] = useState({ width: 900, height: 506 });
  const [region, setRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const scene = useStudio(selectedScene);
  const output = useStudio((s) => s.project?.output);
  const layerId = useStudio((s) => s.layerId);
  const mode = useStudio((s) => s.mode);
  const manualFocus = !!scene && !scene.pose.autoFocus;
  const tool = requestedTool === 'focus' && !manualFocus ? 'move' : requestedTool;
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    rx: number;
    ry: number;
    panX: number;
    panY: number;
    layer: boolean;
    focusCandidate: boolean;
    moved: boolean;
    kind: Tool;
    point: { x: number; y: number } | null;
  } | null>(null);
  const qualityRef = useRef(quality);
  const lockedRef = useRef(locked);
  qualityRef.current = quality;
  lockedRef.current = locked;
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let dirty = false;
    let raf = 0;
    let previous = performance.now();
    let measured = canvas.current?.getBoundingClientRect() || { width: 900, height: 506 };
    const render = async () => {
      if (cancelled || !engine.current) return;
      if (busy) {
        dirty = true;
        return;
      }
      busy = true;
      try {
        do {
          dirty = false;
          const s = useStudio.getState();
          if (s.project && canvas.current) {
            const dpr =
              qualityRef.current === 'draft' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
            const frame = evaluateProjectAtTime(s.project, runtime.get().time, s.mode);
            await engine.current.render(
              frame,
              Math.max(2, Math.round(measured.width * dpr)),
              Math.max(2, Math.round(measured.height * dpr)),
              { quality: qualityRef.current },
            );
            // The marker belongs to the editor DOM, never to the exported canvas. Move it
            // imperatively with the rendered camera so playback does not re-render React.
            const focused = frame.layers.at(-1);
            const marker = focusMarker.current;
            const projected =
              !cancelled &&
              focused &&
              (!focused.pose.autoFocus || (focused.scene.dofEnabled && focused.scene.blur > 0))
                ? (engine.current?.projectPoint(focused.pose.focusX, focused.pose.focusY) ?? null)
                : null;
            if (marker) {
              marker.hidden =
                lockedRef.current ||
                !projected ||
                projected.x < 0 ||
                projected.x > 1 ||
                projected.y < 0 ||
                projected.y > 1;
              if (projected) {
                marker.style.left = `${projected.x * 100}%`;
                marker.style.top = `${projected.y * 100}%`;
              }
            }
          }
        } while (dirty && !cancelled);
      } catch (e) {
        if (!cancelled)
          onError(e instanceof Error ? e.message : 'The preview could not be rendered.');
      } finally {
        busy = false;
        if (!cancelled) setLoading(false);
      }
    };
    const request = () => {
      dirty = true;
      void render();
    };
    void import('@/lib/render/engine').then(({ StudioRenderer }) => {
      if (cancelled || !canvas.current) return;
      engine.current = new StudioRenderer(canvas.current);
      setReduced(engine.current.reduced);
      request();
    });
    const unsub = useStudio.subscribe(request);
    const unsubRuntime = runtime.subscribe(() => {
      const s = useStudio.getState();
      if (s.project && s.mode === 'video' && runtime.get().playing) {
        const active = evaluateProjectAtTime(s.project, runtime.get().time).layers.at(-1)?.scene.id;
        if (active && active !== s.sceneId) s.selectScene(active);
      }
      request();
    });
    const resize = new ResizeObserver((entries) => {
      measured = entries[0].contentRect;
      request();
    });
    if (canvas.current) resize.observe(canvas.current);
    const tick = (now: number) => {
      const r = runtime.get();
      if (r.playing) {
        const p = useStudio.getState().project;
        if (p) {
          const t = r.time + (now - previous) / 1000;
          const duration = totalDuration(p);
          runtime.set({ time: Math.min(t, duration), playing: t < duration });
        }
      }
      previous = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      unsub();
      unsubRuntime();
      resize.disconnect();
      cancelAnimationFrame(raf);
      const renderer = engine.current;
      engine.current = null;
      if (busy) {
        const finish = () => {
          if (busy) setTimeout(finish, 20);
          else renderer?.dispose();
        };
        finish();
      } else renderer?.dispose();
    };
  }, [onError]);
  useEffect(() => {
    runtime.set({});
  }, [quality, tool, locked]);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !output) return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect,
        ratio = output.width / output.height;
      const width = Math.max(
        100,
        Math.min(r.width - 48, (r.height - (minimal ? 56 : 108)) * ratio),
      );
      setSize({ width, height: width / ratio });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [output, minimal]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || locked) return;
      e.preventDefault();
      useStudio.getState().begin();
      useStudio.getState().editCamera((p) => {
        p.zoom = clamp(p.zoom - e.deltaY * 0.002, 0.25, 4);
      });
      clearTimeout(timer);
      timer = setTimeout(() => useStudio.getState().commit(), 180);
    };
    let timer: ReturnType<typeof setTimeout>;
    c.addEventListener('wheel', wheel, { passive: false });
    return () => {
      c.removeEventListener('wheel', wheel);
      clearTimeout(timer);
    };
  }, [locked]);
  const point = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };
  const fit = () => {
    const fittedZoom = engine.current?.fitZoom() ?? 1;
    useStudio.getState().editCamera((p) => {
      p.x = 0;
      p.y = 0;
      p.z = 0;
      p.zoom = fittedZoom;
    });
  };
  return (
    <section className="stage-wrap" ref={wrap} aria-label="Composition studio">
      <div className="stage-meta">
        <span className="stage-format">
          {output ? `${output.width}:${output.height}` : '16:9'}
          <span className="tiny-dot" /> {mode === 'photo' ? 'STILL' : 'MOTION'}
        </span>
        <span className="stage-hint">
          {tool === 'point'
            ? 'Click or drag on the surface to mark a detail'
            : tool === 'focus'
              ? 'Click your subject to set focus'
              : tool === 'rotate'
                ? 'Drag your subject to rotate, or enter exact angles'
                : 'Drag to move. Ctrl + drag to rotate.'}
        </span>
      </div>
      <div className="artboard checker" style={{ width: size.width, height: size.height }}>
        <canvas
          ref={canvas}
          aria-label="Composition preview"
          style={{ cursor: tool === 'move' ? 'grab' : 'crosshair' }}
          tabIndex={0}
          onPointerDown={(e) => {
            if (e.button !== 0 || locked || !scene) return;
            const p = point(e);
            const hit = engine.current?.hitTest(p.x, p.y) || null;
            const kind = e.ctrlKey || e.metaKey ? 'rotate' : tool;
            const selected = scene.layers.find((l) => l.id === layerId);
            if (kind === 'move' && !selected) {
              const found = [...scene.layers].reverse().find((l) => {
                if (l.kind === 'logo')
                  return Math.abs(p.x - l.x) < l.width / 2 && Math.abs(p.y - l.y) < l.width / 2;
                return (
                  p.y >= l.y &&
                  p.y < l.y + l.size * 1.4 * l.text.split('\n').length &&
                  Math.abs(p.x - l.x) < l.width / 2
                );
              });
              if (found) {
                useStudio.getState().selectLayer(found.id);
                return;
              }
            }
            if (!hit && !selected) return;
            runtime.set({ playing: false });
            const state = useStudio.getState();
            const span = state.project
              ? timelineSpans(state.project).find((s) => s.scene.id === scene.id)
              : null;
            const pose =
              state.mode === 'photo'
                ? scene.pose
                : cameraAtTime(scene, Math.max(0, runtime.get().time - (span?.start || 0)));
            // Pan is stored in world units. Scale pointer motion by this camera's view,
            // rather than refitting the surface whenever its zoom or aspect changes.
            const visibleHeight =
              2 * Math.max(1.2, 6 / pose.zoom + pose.z) * Math.tan((pose.fov * Math.PI) / 360);
            state.begin();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              startX: selected?.x ?? pose.x,
              startY: selected?.y ?? pose.y,
              rx: pose.rx,
              ry: pose.ry,
              panX: (visibleHeight * (size.width / size.height)) / 4.8,
              panY: visibleHeight / 3,
              layer: !!selected && kind === 'move',
              focusCandidate:
                !pose.autoFocus &&
                kind === 'focus' &&
                !selected &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey,
              moved: false,
              kind,
              point: hit,
            };
            if (kind === 'point') setRegion({ x: p.x, y: p.y, w: 0, h: 0 });
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
            const dx = (e.clientX - d.x) / size.width,
              dy = (e.clientY - d.y) / size.height;
            const state = useStudio.getState();
            if (d.kind === 'point') {
              const p = point(e);
              setRegion((r) => (r ? { ...r, w: p.x - r.x, h: p.y - r.y } : null));
              return;
            }
            // A click in MF chooses focus; small pointer jitter must neither pan
            // the camera nor create an extra undo entry before that click.
            if (!d.moved) return;
            if (d.layer) {
              state.editLayer((l) => {
                l.x = clamp(d.startX + dx, 0, 1);
                l.y = clamp(d.startY + dy, 0, 1);
              });
            } else if (d.kind === 'move') {
              state.editCamera((p) => {
                p.x = clamp(d.startX + dx * d.panX, -2, 2);
                p.y = clamp(d.startY - dy * d.panY, -2, 2);
              });
            } else if (d.kind === 'rotate') {
              state.editCamera((p) => {
                p.ry = clamp(d.ry + dx * 150, -80, 80);
                p.rx = clamp(d.rx + dy * 150, -80, 80);
              });
            }
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (
              d?.focusCandidate &&
              !d.moved &&
              Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 4 &&
              !e.ctrlKey &&
              !e.metaKey &&
              !e.altKey
            ) {
              const p = point(e);
              const focus = engine.current?.hitTest(p.x, p.y);
              if (focus)
                useStudio.getState().editCamera((pose) => {
                  pose.focusX = focus.x;
                  pose.focusY = focus.y;
                  pose.autoFocus = false;
                });
            }
            if (d?.kind === 'point' && d.point) {
              const p = point(e);
              const end = engine.current?.hitTest(p.x, p.y) || d.point;
              const w = Math.abs(end.x - d.point.x),
                h = Math.abs(end.y - d.point.y);
              useStudio.getState().editScene((s) => {
                s.points.push({
                  x: (d.point!.x + end.x) / 2,
                  y: (d.point!.y + end.y) / 2,
                  w: w || 0.16,
                  h: h || 0.16,
                });
              });
            }
            drag.current = null;
            setRegion(null);
            useStudio.getState().commit();
          }}
          onPointerCancel={() => {
            drag.current = null;
            setRegion(null);
            useStudio.getState().commit();
          }}
        />
        <div
          ref={focusMarker}
          data-focus-marker
          hidden
          aria-hidden="true"
          title="Focus point"
          style={{
            position: 'absolute',
            width: 22,
            height: 22,
            border: '2px solid #0088ff',
            borderRadius: '50%',
            boxShadow: '0 0 0 2px #fff, 0 1px 6px #0006',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: 4,
              height: 4,
              left: 7,
              top: 7,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.8)',
              boxShadow: '0 0 0 1px rgba(0,0,0,.3)',
            }}
          />
        </div>
        {region && (
          <div
            className="region-guide"
            style={{
              left: `${Math.min(region.x, region.x + region.w) * 100}%`,
              top: `${Math.min(region.y, region.y + region.h) * 100}%`,
              width: `${Math.abs(region.w) * 100}%`,
              height: `${Math.abs(region.h) * 100}%`,
            }}
          />
        )}
        {loading && (
          <div className="stage-loading">
            <span className="spinner" /> Preparing the studio
          </div>
        )}
      </div>
      {!minimal && (
        <QuickAccessBar
          assets={assets}
          onImport={onImport}
          onPickFocus={onPickFocus}
          tool={tool}
          onToolChange={setTool}
          onLayers={onLayers}
          onFit={fit}
          onReset={() =>
            useStudio
              .getState()
              .editCamera((p) =>
                Object.assign(p, { x: 0, y: 0, z: 0, zoom: 1, rx: 0, ry: 0, rz: 0, fov: 38 }),
              )
          }
          disabled={locked}
        />
      )}
      {tool === 'focus' && (
        <div className="focus-tool-hint" role="status">
          Click your subject to set focus
        </div>
      )}
      <div className="stage-caption">
        <MousePointer2 size={12} />
        <span>
          {layerId ? 'Selected layer · drag to position' : scene?.name || 'Your canvas'}
          {scene?.points.length
            ? ` · ${scene.points.length} marked detail${scene.points.length > 1 ? 's' : ''}`
            : ''}
        </span>
      </div>
      {reduced && (
        <div className="reduced-notice">
          WebGL unavailable · using a flat preview. Perspective and depth blur need WebGL.
        </div>
      )}
    </section>
  );
}
