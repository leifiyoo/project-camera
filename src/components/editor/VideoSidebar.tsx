'use client';
import { useState } from 'react';
import { Film, ImagePlus, Type, Upload, ChevronDown } from '@/components/ui/studio-icons';
import { selectedScene, useStudio } from '@/lib/studio/store';
import { resizeClip } from '@/lib/studio/timeline-edit';
import type { Asset } from '@/lib/studio/model';
import Inspector, { type MediaTarget } from './Inspector';
import { Field, NumberField, Select, SelectOption } from './primitives';
import TransitionPicker from './TransitionPicker';

export function CanvasSettings() {
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
        <h2>Properties</h2>
        <span>{scene ? 'Video' : 'Canvas'}</span>
      </header>
      {!scene ? (
        <div className="video-sidebar-body">
          <section className="video-property-section">
            <h3>Canvas</h3>
            <CanvasSettings />
          </section>
          <div className="video-sidebar-empty">
            <p>Select a clip in the timeline to edit it.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="video-source">
            {asset ? (
              <img src={asset.thumbnail} alt="" />
            ) : (
              <span>{scene.kind === 'text' ? <Type size={16} /> : <ImagePlus size={16} />}</span>
            )}
            <div>
              <strong title={scene.name}>{scene.name}</strong>
              <small>
                {asset
                  ? `${asset.kind === 'video' ? 'Video' : 'Image'} · ${asset.width} × ${asset.height}`
                  : 'Blank clip'}
              </small>
            </div>
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
                {value === 'clip' ? 'Clip' : value === 'design' ? 'Design' : 'Layers'}
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
                    <details className="video-trim-details">
                      <summary>
                        Trim &amp; playback <ChevronDown size={14} />
                      </summary>
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
                    </details>
                  )}
                </section>
                <TransitionPicker sceneId={scene.id} inline />
              </>
            )}
            {active === 'design' && (
              <>
                <section className="video-property-section">
                  <h3>Camera</h3>
                  <Inspector kind="camera" {...inspectorProps} />
                  {scene.assetId && (
                    <button
                      className="motion-action"
                      aria-label={
                        scene.keyframes.length ? 'Edit camera motion' : 'Add camera motion'
                      }
                      onClick={onAnimate}
                    >
                      <Film size={14} />
                      <span>
                        {scene.keyframes.length ? 'Edit camera motion' : 'Add camera motion'}
                      </span>
                      <small>
                        {scene.keyframes.length ? `${scene.keyframes.length} positions` : '+'}
                      </small>
                    </button>
                  )}
                </section>
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
                    {keyId ? 'Selected camera position' : 'Camera keyframes'}{' '}
                    <ChevronDown size={14} />
                  </summary>
                  <Inspector kind="inspector" section="camera" {...inspectorProps} />
                  {!!scene.keyframes.length && (
                    <button
                      className="text-button"
                      onClick={() => {
                        state.editScene((s) => {
                          s.keyframes = [];
                        });
                        state.selectKey(null);
                      }}
                    >
                      Remove motion
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
