'use client';
import { useState } from 'react';
import {
  Film,
  ImagePlus,
  Layers,
  SlidersHorizontal,
  Type,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { selectedScene, useStudio } from '@/lib/studio/store';
import { resizeClip } from '@/lib/studio/timeline-edit';
import type { Asset } from '@/lib/studio/model';
import Inspector, { type MediaTarget } from './Inspector';
import { Field, NumberField, Select, SelectOption } from './primitives';

function CanvasSettings() {
  const output = useStudio((s) => s.project?.output);
  if (!output) return null;
  return (
    <Field label="Aspect ratio">
      <Select
        value={`${output.width}:${output.height}`}
        onValueChange={(value) => {
          const [width, height] = value.split(':').map(Number);
          useStudio.getState().edit((p) => {
            p.output = { width, height };
          });
        }}
      >
        {['16:9', '16:10', '4:3', '1:1', '4:5', '9:16'].map((value) => (
          <SelectOption value={value} key={value}>
            {value}
          </SelectOption>
        ))}
        {!['16:9', '16:10', '4:3', '1:1', '4:5', '9:16'].includes(
          `${output.width}:${output.height}`,
        ) && <SelectOption value={`${output.width}:${output.height}`}>Custom</SelectOption>}
      </Select>
    </Field>
  );
}

export default function VideoSidebar({
  assets,
  onImport,
  onPickFocus,
  onAnimate,
}: {
  assets: Asset[];
  onImport: (target: MediaTarget) => void;
  onPickFocus: () => void;
  onAnimate: () => void;
}) {
  const scene = useStudio(selectedScene);
  const layerId = useStudio((s) => s.layerId);
  const keyId = useStudio((s) => s.keyId);
  const [tab, setTab] = useState<'clip' | 'design' | 'layers'>('clip');
  const active = layerId ? 'layers' : keyId ? 'design' : tab;
  const asset = assets.find((a) => a.id === scene?.assetId);
  const state = useStudio.getState();
  const inspectorProps = { assets, onImport, onPickFocus, compact: true };
  return (
    <aside className="video-sidebar" aria-label="Video properties">
      <header className="video-sidebar-heading">
        <SlidersHorizontal size={16} />
        <h2>{scene ? 'Scene properties' : 'Video settings'}</h2>
      </header>
      {!scene ? (
        <div className="video-sidebar-body">
          <section className="video-property-section">
            <h3>Canvas</h3>
            <CanvasSettings />
          </section>
          <div className="video-sidebar-empty">
            <Film size={22} />
            <strong>No scenes yet</strong>
            <p>Import a video or image, or add a blank scene from the timeline.</p>
            <button className="secondary full" onClick={() => onImport('media')}>
              <Upload size={14} /> Import media
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="video-source">
            <span>
              {scene.kind === 'text' ? (
                <Type size={16} />
              ) : asset?.kind === 'video' ? (
                <Film size={16} />
              ) : (
                <ImagePlus size={16} />
              )}
            </span>
            <strong title={scene.name}>{scene.name}</strong>
          </div>
          <div className="video-property-tabs" role="tablist" aria-label="Scene properties">
            {(['clip', 'design', 'layers'] as const).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={active === value}
                aria-controls={`video-panel-${value}`}
                id={`video-tab-${value}`}
                tabIndex={active === value ? 0 : -1}
                onClick={() => {
                  state.selectLayer(null);
                  state.selectKey(null);
                  setTab(value);
                }}
                onKeyDown={(e) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                  e.preventDefault();
                  const tabs = ['clip', 'design', 'layers'] as const;
                  const index = tabs.indexOf(value);
                  const next =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? 2
                        : (index + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
                  state.selectLayer(null);
                  state.selectKey(null);
                  setTab(tabs[next]);
                  document.getElementById(`video-tab-${tabs[next]}`)?.focus();
                }}
              >
                {value === 'clip' ? (
                  'Clip'
                ) : value === 'design' ? (
                  'Design'
                ) : (
                  <>
                    <Layers size={13} /> Layers
                  </>
                )}
              </button>
            ))}
          </div>
          <div
            className="video-sidebar-body"
            role="tabpanel"
            id={`video-panel-${active}`}
            aria-labelledby={`video-tab-${active}`}
          >
            {active === 'clip' && (
              <>
                <section className="video-property-section">
                  <Field label="Scene name">
                    <input
                      value={scene.name}
                      onChange={(e) =>
                        state.editScene((s) => {
                          s.name = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <NumberField
                    label="Scene duration"
                    value={scene.duration}
                    min={0.1}
                    max={
                      asset?.kind === 'video' && !scene.loop
                        ? Math.max(0.1, asset.duration - scene.trimIn)
                        : 86400
                    }
                    step={0.1}
                    unit="s"
                    onChange={(value) =>
                      state.editScene((s) =>
                        Object.assign(s, resizeClip(scene, 'end', value - scene.duration, asset)),
                      )
                    }
                  />
                  <p className="video-property-note">
                    Drag either edge in the timeline to change the length.
                  </p>
                </section>
                <section className="video-property-section">
                  <h3>Source</h3>
                  <p className="video-source-name">
                    {asset?.name || (scene.kind === 'text' ? 'Text scene' : 'No media added')}
                  </p>
                  <button className="secondary full" onClick={() => onImport('replace')}>
                    <Upload size={14} /> {asset ? 'Replace media' : 'Choose media'}
                  </button>
                  {asset?.kind === 'video' && (
                    <>
                      <div className="field-grid">
                        <NumberField
                          label="Video in"
                          value={scene.trimIn}
                          min={0}
                          max={scene.trimOut - 0.1}
                          unit="s"
                          onChange={(value) =>
                            state.editScene((s) => {
                              if (scene.loop) s.trimIn = value;
                              else
                                Object.assign(
                                  s,
                                  resizeClip(scene, 'start', value - scene.trimIn, asset),
                                );
                            })
                          }
                        />
                        <NumberField
                          label="Video out"
                          value={scene.trimOut}
                          min={scene.trimIn + 0.1}
                          max={asset.duration}
                          unit="s"
                          onChange={(value) =>
                            state.editScene((s) => {
                              if (scene.loop) s.trimOut = value;
                              else
                                Object.assign(
                                  s,
                                  resizeClip(scene, 'end', value - scene.trimOut, asset),
                                );
                            })
                          }
                        />
                      </div>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={scene.loop}
                          onChange={(e) =>
                            state.editScene((s) => {
                              s.loop = e.target.checked;
                              if (!s.loop && s.duration > s.trimOut - s.trimIn) {
                                Object.assign(
                                  s,
                                  resizeClip(
                                    { ...scene, loop: false },
                                    'end',
                                    s.trimOut - s.trimIn - s.duration,
                                    asset,
                                  ),
                                );
                              }
                            })
                          }
                        />{' '}
                        Loop video
                      </label>
                    </>
                  )}
                </section>
                <details className="video-property-details">
                  <summary>
                    Transition <ChevronDown size={14} />
                  </summary>
                  <Field label="Transition">
                    <Select
                      value={scene.transition.kind}
                      onValueChange={(value) =>
                        state.editScene((s) => {
                          s.transition.kind = value as typeof s.transition.kind;
                        })
                      }
                    >
                      {(['cut', 'fade', 'push', 'zoom'] as const).map((value) => (
                        <SelectOption value={value} key={value}>
                          {value === 'cut' ? 'None' : value[0].toUpperCase() + value.slice(1)}
                        </SelectOption>
                      ))}
                    </Select>
                  </Field>
                  {scene.transition.kind !== 'cut' && (
                    <NumberField
                      label="Transition duration"
                      value={scene.transition.duration}
                      min={0}
                      max={30}
                      step={0.1}
                      unit="s"
                      onChange={(value) =>
                        state.editScene((s) => {
                          s.transition.duration = value;
                        })
                      }
                    />
                  )}
                </details>
              </>
            )}
            {active === 'design' && (
              <>
                <section className="video-property-section">
                  <h3>Background</h3>
                  <Inspector kind="background" {...inspectorProps} />
                </section>
                <section className="video-property-section">
                  <h3>Canvas</h3>
                  <CanvasSettings />
                </section>
                <details className="video-property-details" open={keyId ? true : undefined}>
                  <summary>
                    Camera &amp; motion <ChevronDown size={14} />
                  </summary>
                  <Inspector kind="inspector" section="camera" {...inspectorProps} />
                  {scene.assetId && (
                    <button className="secondary full" onClick={onAnimate}>
                      <Film size={14} /> Animate camera
                    </button>
                  )}
                </details>
                <details className="video-property-details">
                  <summary>
                    Focus &amp; depth <ChevronDown size={14} />
                  </summary>
                  <Inspector kind="focus" {...inspectorProps} />
                </details>
                <details className="video-property-details">
                  <summary>
                    Shadow <ChevronDown size={14} />
                  </summary>
                  <Inspector kind="shadow" {...inspectorProps} />
                </details>
              </>
            )}
            {active === 'layers' && (
              <section className="video-property-section">
                <Inspector kind="inspector" section="layers" {...inspectorProps} />
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
