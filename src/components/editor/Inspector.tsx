'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  Type,
  ImagePlus,
  Trash2,
  Plus,
  Diamond,
  Copy,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from '@/components/ui/studio-icons';
import { Button } from '@radix-ui/themes';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useStudio, selectedScene } from '@/lib/studio/store';
import { runtime } from '@/lib/studio/runtime';
import { cameraAtTime, timelineSpans } from '@/lib/studio/evaluate';
import {
  type Asset,
  type CameraPose,
  type Stroke,
  clone,
  uid,
  clamp,
  makeStroke,
  makeText,
} from '@/lib/studio/model';
import { Field, NumberField, Range, IconButton, Select, SelectOption } from './primitives';
import ColorPicker from './ColorPicker';
import { UIIcon } from './UIIcon';
export type InspectorKind =
  | 'background'
  | 'focus'
  | 'blur'
  | 'camera'
  | 'rotation'
  | 'zoom'
  | 'fov'
  | 'frame'
  | 'shadow'
  | 'aspect'
  | 'settings'
  | 'inspector';
export type MediaTarget = 'media' | 'background' | 'logo' | 'replace';
function RotationFields({
  pose,
  onChange,
}: {
  pose: CameraPose;
  onChange: (fn: (p: CameraPose) => void) => void;
}) {
  return (
    <div className="rotation-fields">
      {(['rx', 'ry', 'rz'] as const).map((axis) => (
        <NumberField
          key={axis}
          label={axis.slice(1).toUpperCase() + ' rotation'}
          value={pose[axis]}
          min={-180}
          max={180}
          step={0.1}
          unit="°"
          scrub
          onChange={(value) =>
            onChange((p) => {
              p[axis] = value;
            })
          }
        />
      ))}
    </div>
  );
}
const aspectPresets = [
  { value: '16:9', label: '16:9 · Slides' },
  { value: '16:10', label: '16:10 · Laptop' },
  { value: '191:100', label: '1.91:1 · Link card' },
  { value: '3:2', label: '3:2 · Photo' },
  { value: '4:3', label: '4:3 · Classic' },
  { value: '1:1', label: '1:1 · Square' },
  { value: '4:5', label: '4:5 · Portrait' },
  { value: '9:16', label: '9:16 · Story' },
  { value: '3:1', label: '3:1 · Banner' },
  { value: '21:9', label: '21:9 · Wide' },
] as const;
/** A short row of gradient starting points; solid colors live in the color picker. */
const gradientPresets = [
  { name: 'Mist', color: '#e0eafc', color2: '#cfdef3' },
  { name: 'Sand', color: '#f6f1e7', color2: '#e3d5bd' },
  { name: 'Sunset', color: '#ff9a8b', color2: '#ff6a88' },
  { name: 'Violet', color: '#a18cd1', color2: '#fbc2eb' },
  { name: 'Night', color: '#0f2027', color2: '#2c5364' },
] as const;
function PoseFields({
  pose,
  onChange,
  compact = false,
}: {
  pose: CameraPose;
  onChange: (fn: (p: CameraPose) => void) => void;
  compact?: boolean;
}) {
  return (
    <>
      <Range
        label="Zoom"
        value={pose.zoom}
        min={0.25}
        max={4}
        unit="×"
        onChange={(value) =>
          onChange((p) => {
            p.zoom = value;
          })
        }
      />
      <RotationFields pose={pose} onChange={onChange} />
      {!compact && (
        <section className="advanced-settings-group">
          <h3>Camera position</h3>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <NumberField
              key={axis}
              label={'Position ' + axis.toUpperCase()}
              value={pose[axis]}
              min={-3}
              max={3}
              scrub
              onChange={(value) =>
                onChange((p) => {
                  p[axis] = value;
                })
              }
            />
          ))}
          <Range
            label="Field of view"
            value={pose.fov}
            min={20}
            max={80}
            step={1}
            onChange={(value) =>
              onChange((p) => {
                p.fov = value;
              })
            }
          />
        </section>
      )}
    </>
  );
}
export default function Inspector({
  kind,
  assets,
  onImport,
  onPickFocus,
  compact = false,
  section,
}: {
  kind: InspectorKind;
  assets: Asset[];
  onImport: (t: MediaTarget) => void;
  onPickFocus: () => void;
  compact?: boolean;
  section?: 'scene' | 'layers' | 'camera';
}) {
  const scene = useStudio(selectedScene),
    project = useStudio((s) => s.project),
    mode = useStudio((s) => s.mode),
    keyId = useStudio((s) => s.keyId),
    layerId = useStudio((s) => s.layerId);
  const [tab, setTab] = useState<'scene' | 'layers' | 'camera'>('scene');
  const state = useStudio.getState();
  const subscribeTime = useCallback(
    (fn: () => void) =>
      ['camera', 'rotation', 'zoom', 'fov', 'settings'].includes(kind) ||
      ((kind === 'focus' || kind === 'blur') && mode === 'video') ||
      (kind === 'inspector' && (section === 'camera' || tab === 'camera' || keyId))
        ? runtime.subscribe(fn)
        : () => {},
    [kind, mode, tab, keyId, section],
  );
  const r = useSyncExternalStore(subscribeTime, runtime.get, runtime.get);
  if (!scene || !project) return null;
  const key = scene.keyframes.find((k) => k.id === keyId);
  const span = timelineSpans(project).find((s) => s.scene.id === scene.id);
  const local = mode === 'photo' ? 0 : clamp(r.time - (span?.start || 0), 0, scene.duration);
  const pose =
    mode === 'video' && r.playing
      ? cameraAtTime(scene, local)
      : key?.pose || (mode === 'video' ? cameraAtTime(scene, local) : scene.pose);
  const layer = scene.layers.find((l) => l.id === layerId);
  const activeTab = section || (key ? 'camera' : layer ? 'layers' : tab);
  const images = assets.filter((a) => a.kind === 'image');
  const edit = state.editScene,
    editLayer = state.editLayer;
  const editPose = state.editCamera;
  const background = (
    <>
      <SegmentedControl
        className="background-kind-switch"
        size="sm"
        fullWidth
        aria-label="Background type"
        value={scene.background.kind}
        onValueChange={(value) =>
          edit((s) => {
            s.background.kind = value as typeof s.background.kind;
            if (value === 'gradient' && !s.background.color2) {
              s.background.color = '#e0eafc';
              s.background.color2 = '#cfdef3';
              s.background.angle = 135;
            }
          })
        }
        options={[
          { value: 'color', label: 'Solid' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'image', label: 'Image' },
          { value: 'transparent', label: 'None', 'aria-label': 'Transparent' },
        ]}
      />
      {scene.background.kind === 'gradient' && (
        <div className="gradient-presets" role="group" aria-label="Gradient presets">
          {gradientPresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              title={preset.name}
              aria-label={`${preset.name} gradient`}
              aria-pressed={
                scene.background.color.toLowerCase() === preset.color &&
                (scene.background.color2 || '').toLowerCase() === preset.color2
              }
              style={{ background: `linear-gradient(135deg, ${preset.color}, ${preset.color2})` }}
              onClick={() =>
                edit((s) => {
                  s.background.color = preset.color;
                  s.background.color2 = preset.color2;
                  s.background.angle ??= 135;
                })
              }
            />
          ))}
        </div>
      )}
      {scene.background.kind === 'color' && (
        <Field label="Color">
          <ColorPicker
            key={scene.id + 'bg'}
            value={scene.background.color}
            onChange={(value) =>
              edit((s) => {
                s.background.color = value;
              })
            }
          />
        </Field>
      )}
      {scene.background.kind === 'gradient' && (
        <>
          <Field label="From">
            <ColorPicker
              key={scene.id + 'bg1'}
              value={scene.background.color}
              onChange={(value) =>
                edit((s) => {
                  s.background.color = value;
                })
              }
            />
          </Field>
          <Field label="To">
            <ColorPicker
              key={scene.id + 'bg2'}
              value={scene.background.color2 || scene.background.color}
              onChange={(value) =>
                edit((s) => {
                  s.background.color2 = value;
                })
              }
            />
          </Field>
          <Range
            label="Angle"
            value={scene.background.angle ?? 135}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={(value) =>
              edit((s) => {
                s.background.angle = value;
              })
            }
          />
        </>
      )}
      {scene.background.kind === 'image' && (
        <>
          <Field label="Image">
            <div className="background-image-control">
              <Select
                aria-label="Background image"
                value={scene.background.assetId || ''}
                onValueChange={(value) =>
                  edit((s) => {
                    s.background.assetId = value;
                  })
                }
              >
                <SelectOption value="" icon="image">
                  Choose image
                </SelectOption>
                {images.map((asset) => (
                  <SelectOption key={asset.id} value={asset.id} icon="image">
                    {asset.name}
                  </SelectOption>
                ))}
              </Select>
              <IconButton label="Import background" onClick={() => onImport('background')}>
                <UIIcon name="image" />
              </IconButton>
            </div>
          </Field>
          {!compact && (
            <>
              <Field label="Image fit">
                <Select
                  value={scene.background.fit}
                  onValueChange={(value) =>
                    edit((s) => {
                      s.background.fit = value as 'fit' | 'fill';
                    })
                  }
                >
                  <SelectOption value="fill">Fill</SelectOption>
                  <SelectOption value="fit">Fit</SelectOption>
                </Select>
              </Field>
              <Range
                label="Horizontal position"
                value={scene.background.x}
                onChange={(value) =>
                  edit((s) => {
                    s.background.x = value;
                  })
                }
              />
              <Range
                label="Vertical position"
                value={scene.background.y}
                onChange={(value) =>
                  edit((s) => {
                    s.background.y = value;
                  })
                }
              />
            </>
          )}
        </>
      )}
    </>
  );
  const frame = (
    <>
      <Field label="Image fit">
        <Select
          value={scene.frame.fit}
          onValueChange={(value) =>
            edit((s) => {
              s.frame.fit = value as 'fit' | 'fill';
            })
          }
        >
          <SelectOption value="fit">Fit</SelectOption>
          <SelectOption value="fill">Fill</SelectOption>
        </Select>
      </Field>
      <Range
        label="Crop zoom"
        value={scene.frame.cropZoom}
        min={1}
        max={4}
        onChange={(value) =>
          edit((s) => {
            s.frame.cropZoom = value;
          })
        }
      />
      <Range
        label="Horizontal crop"
        value={scene.frame.cropX}
        onChange={(value) =>
          edit((s) => {
            s.frame.cropX = value;
          })
        }
      />
      <Range
        label="Vertical crop"
        value={scene.frame.cropY}
        onChange={(value) =>
          edit((s) => {
            s.frame.cropY = value;
          })
        }
      />
    </>
  );
  const focus = (
    <>
      <Field label="Mode">
        <SegmentedControl
          className="focus-mode-switch"
          size="sm"
          fullWidth
          aria-label="Focus mode"
          value={pose.autoFocus ? 'auto' : 'manual'}
          onValueChange={(value) => {
            if (value === 'auto') {
              runtime.set({ playing: false });
              editPose((p) => {
                p.autoFocus = true;
                const point = scene.points[0];
                p.focusX = point?.x ?? 0.35;
                p.focusY = point?.y ?? 0.35;
              });
            } else if (value === 'manual') onPickFocus();
          }}
          options={[
            { value: 'auto', label: 'Auto', 'aria-label': 'Auto focus' },
            { value: 'manual', label: 'Manual', 'aria-label': 'Manual focus' },
          ]}
        />
      </Field>
      <Button className="choose-focus-button" variant="soft" color="gray" onClick={onPickFocus}>
        <UIIcon name="focus" />
        Choose focus point
      </Button>
      <Range
        label="Depth blur"
        value={scene.dofEnabled ? scene.blur * 100 : 0}
        max={100}
        step={1}
        unit="%"
        onChange={(value) =>
          edit((s) => {
            s.blur = value / 100;
            s.dofEnabled = value > 0;
          })
        }
      />
    </>
  );
  const stroke = scene.frame.stroke ?? makeStroke();
  const editStroke = (fn: (stroke: Stroke) => void) =>
    edit((s) => {
      s.frame.stroke ??= makeStroke();
      fn(s.frame.stroke);
    });
  const shadow = (
    <>
      <Range
        label="Corners"
        value={Math.round((scene.frame.radius || 0) * 500)}
        max={100}
        step={1}
        onChange={(v) =>
          edit((s) => {
            s.frame.radius = v / 500;
          })
        }
      />
      <Range
        label="Stroke"
        value={stroke.width * 1000}
        max={50}
        step={0.5}
        onChange={(v) =>
          editStroke((st) => {
            st.width = v / 1000;
          })
        }
      />
      {stroke.width > 0 && (
        <>
          <Field label="Stroke color">
            <ColorPicker
              key={scene.id + 'stroke'}
              value={stroke.color}
              onChange={(value) =>
                editStroke((st) => {
                  st.color = value;
                })
              }
            />
          </Field>
          <Range
            label="Stroke opacity"
            value={Math.round(stroke.opacity * 100)}
            max={100}
            step={1}
            unit="%"
            onChange={(v) =>
              editStroke((st) => {
                st.opacity = v / 100;
              })
            }
          />
        </>
      )}
      <Field label="Shadow size">
        <Select
          value={scene.shadow}
          onValueChange={(value) =>
            edit((s) => {
              s.shadow = value as typeof s.shadow;
            })
          }
        >
          {['off', 'small', 'medium', 'large'].map((v) => (
            <SelectOption key={v} value={v}>
              {v[0].toUpperCase() + v.slice(1)}
            </SelectOption>
          ))}
        </Select>
      </Field>
      <Range
        label="Intensity"
        value={Math.round(scene.shadowIntensity * 100)}
        max={100}
        step={1}
        unit="%"
        onChange={(v) =>
          edit((s) => {
            s.shadowIntensity = v / 100;
          })
        }
      />
    </>
  );
  const aspectKey = project.output.width + ':' + project.output.height;
  const aspect = (
    <Field label="Aspect ratio">
      <Select
        value={aspectPresets.some((preset) => preset.value === aspectKey) ? aspectKey : ''}
        onValueChange={(value) => {
          if (!value) return;
          const [width, height] = value.split(':').map(Number);
          state.edit((p) => {
            p.output = { width, height };
          });
        }}
      >
        <SelectOption value="" disabled>
          Custom
        </SelectOption>
        {aspectPresets.map((preset) => (
          <SelectOption key={preset.value} value={preset.value}>
            {preset.label}
          </SelectOption>
        ))}
      </Select>
    </Field>
  );
  const cameraControls = (
    <section className="camera-controls" aria-label="Camera controls">
      <PoseFields pose={pose} onChange={editPose} compact={compact} />
    </section>
  );
  if (kind === 'settings')
    return (
      <div className="advanced-settings-page">
        <section>
          <h3>Image cropping</h3>
          {frame}
        </section>
        <section>
          <h3>Depth precision</h3>
          <Range
            label="Focus width"
            value={scene.focusWidth * 100}
            max={100}
            step={1}
            unit="%"
            onChange={(value) =>
              edit((s) => {
                s.focusWidth = value / 100;
              })
            }
          />
          <Range
            label="Blur limit"
            value={scene.maxBlur * 100}
            max={100}
            step={1}
            unit="%"
            onChange={(value) =>
              edit((s) => {
                s.maxBlur = value / 100;
              })
            }
          />
        </section>
        <section>
          <h3>Camera position</h3>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <NumberField
              key={axis}
              label={axis.toUpperCase()}
              value={pose[axis]}
              min={-3}
              max={3}
              scrub
              onChange={(value) =>
                editPose((p) => {
                  p[axis] = value;
                })
              }
            />
          ))}
          <Range
            label="Field of view"
            value={pose.fov}
            min={20}
            max={80}
            step={1}
            onChange={(value) =>
              editPose((p) => {
                p.fov = value;
              })
            }
          />
        </section>
        <section>
          <h3>Background</h3>
          {background}
        </section>
        <section>
          <h3>Canvas dimensions</h3>
          <NumberField
            label="Width"
            value={project.output.width}
            min={1}
            max={16384}
            step={1}
            onChange={(value) =>
              state.edit((p) => {
                p.output.width = value;
              })
            }
          />
          <NumberField
            label="Height"
            value={project.output.height}
            min={1}
            max={16384}
            step={1}
            onChange={(value) =>
              state.edit((p) => {
                p.output.height = value;
              })
            }
          />
        </section>
      </div>
    );
  if (kind !== 'inspector')
    return kind === 'background' ? (
      background
    ) : kind === 'frame' ? (
      frame
    ) : kind === 'focus' || kind === 'blur' ? (
      focus
    ) : kind === 'camera' ? (
      cameraControls
    ) : kind === 'rotation' ? (
      <RotationFields pose={pose} onChange={editPose} />
    ) : kind === 'shadow' ? (
      shadow
    ) : kind === 'aspect' ? (
      aspect
    ) : kind === 'zoom' ? (
      <Range
        label="Zoom"
        value={pose.zoom}
        min={0.25}
        max={4}
        unit="×"
        onChange={(v) =>
          editPose((p) => {
            p.zoom = v;
          })
        }
      />
    ) : (
      <Range
        label="Field of view"
        value={pose.fov}
        min={20}
        max={80}
        step={1}
        unit="°"
        onChange={(v) =>
          editPose((p) => {
            p.fov = v;
          })
        }
      />
    );
  return (
    <>
      {!section && (
        <div className="inspector-tabs">
          {(['scene', 'layers', 'camera'] as const).map((t) => (
            <Button
              variant="soft"
              color="gray"
              key={t}
              className={(key ? 'camera' : layer ? 'layers' : tab) === t ? 'selected' : ''}
              onClick={() => {
                state.selectKey(null);
                state.selectLayer(null);
                setTab(t);
              }}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      )}
      {activeTab === 'scene' && (
        <>
          <Field label="Scene name">
            <input
              value={scene.name}
              onChange={(e) =>
                edit((s) => {
                  s.name = e.target.value;
                })
              }
            />
          </Field>
          <Field label="Surface">
            <Select
              value={scene.assetId || ''}
              onValueChange={(value) =>
                edit((s) => {
                  s.assetId = value;
                  s.kind = 'media';
                  const a = assets.find((x) => x.id === value);
                  if (a) s.trimOut = a.duration || 4;
                })
              }
            >
              <SelectOption value="">Text card · no surface</SelectOption>
              {assets.map((a) => (
                <SelectOption key={a.id} value={a.id}>
                  {a.name}
                </SelectOption>
              ))}
            </Select>
          </Field>
          <Button
            variant="soft"
            color="gray"
            className="secondary full"
            onClick={() => onImport('replace')}
          >
            Replace with a file
          </Button>
          {mode === 'video' && (
            <>
              <NumberField
                label="Scene duration"
                value={scene.duration}
                min={0.1}
                max={86400}
                step={0.1}
                unit="s"
                onChange={(v) =>
                  edit((s) => {
                    s.duration = v;
                    s.keyframes.forEach((k) => (k.time = Math.min(k.time, v)));
                  })
                }
              />
              {assets.find((a) => a.id === scene.assetId)?.kind === 'video' && (
                <>
                  <div className="field-grid">
                    <NumberField
                      label="Video in"
                      value={scene.trimIn}
                      min={0}
                      max={scene.trimOut - 0.01}
                      unit="s"
                      onChange={(v) =>
                        edit((s) => {
                          s.trimIn = v;
                        })
                      }
                    />
                    <NumberField
                      label="Video out"
                      value={scene.trimOut}
                      min={scene.trimIn + 0.01}
                      max={assets.find((a) => a.id === scene.assetId)!.duration}
                      unit="s"
                      onChange={(v) =>
                        edit((s) => {
                          s.trimOut = v;
                        })
                      }
                    />
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={scene.loop}
                      onChange={(e) =>
                        edit((s) => {
                          s.loop = e.target.checked;
                        })
                      }
                    />{' '}
                    Loop trimmed video
                  </label>
                </>
              )}
              <div className="section-label">INCOMING TRANSITION</div>
              <div className="field-grid">
                <Field label="Style">
                  <Select
                    value={scene.transition.kind}
                    onValueChange={(value) =>
                      edit((s) => {
                        s.transition.kind = value as typeof s.transition.kind;
                      })
                    }
                  >
                    {['cut', 'fade', 'push', 'zoom'].map((t) => (
                      <SelectOption key={t} value={t}>
                        {t[0].toUpperCase() + t.slice(1)}
                      </SelectOption>
                    ))}
                  </Select>
                </Field>
                <NumberField
                  label="Transition duration"
                  value={scene.transition.duration}
                  min={0}
                  max={30}
                  step={0.1}
                  unit="s"
                  onChange={(v) =>
                    edit((s) => {
                      s.transition.duration = v;
                    })
                  }
                />
              </div>
              <p className="panel-note">
                The incoming transition overlaps the previous scene, up to half of each scene.
              </p>
            </>
          )}
          {background}
          <div className="section-label">SURFACE &amp; SHADOW</div>
          {frame}
          {shadow}
        </>
      )}
      {activeTab === 'layers' && (
        <>
          <div className="layer-list">
            {scene.layers.map((l) => (
              <Button
                variant="soft"
                color="gray"
                key={l.id}
                className={layerId === l.id ? 'selected' : ''}
                onClick={() => state.selectLayer(l.id)}
              >
                {l.kind === 'text' ? <Type size={14} /> : <ImagePlus size={14} />}
                <span>
                  {l.kind === 'text'
                    ? l.text.slice(0, 25)
                    : assets.find((a) => a.id === l.assetId)?.name || 'Logo'}
                </span>
              </Button>
            ))}
          </div>
          <div className="button-row">
            <Button
              variant="soft"
              color="gray"
              className="secondary"
              onClick={() => {
                const l = makeText();
                edit((s) => s.layers.push(l));
                state.selectLayer(l.id);
              }}
            >
              <Plus size={14} /> Text
            </Button>
            <Button
              variant="soft"
              color="gray"
              className="secondary"
              onClick={() => onImport('logo')}
            >
              <ImagePlus size={14} /> Logo
            </Button>
            {layer && (
              <>
                <IconButton
                  label="Duplicate layer"
                  onClick={() => {
                    const l = clone(layer);
                    l.id = uid();
                    l.x = clamp(l.x + 0.03, 0, 1);
                    l.y = clamp(l.y + 0.03, 0, 1);
                    edit((s) => s.layers.push(l));
                    state.selectLayer(l.id);
                  }}
                >
                  <Copy size={14} />
                </IconButton>
                <IconButton
                  label="Delete layer"
                  onClick={() => {
                    edit((s) => {
                      s.layers = s.layers.filter((l) => l.id !== layerId);
                    });
                    state.selectLayer(null);
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </>
            )}
          </div>
          {!layer && (
            <p className="panel-note">
              Select a layer to format it. Drag it on the canvas to position it.
            </p>
          )}
          {layer && (
            <>
              {layer.kind === 'text' ? (
                <>
                  <Field label="Text">
                    <textarea
                      value={layer.text}
                      rows={3}
                      onChange={(e) =>
                        editLayer((l) => {
                          if (l.kind === 'text') l.text = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <div className="field-grid">
                    <Field label="Font">
                      <Select
                        value={layer.font}
                        onValueChange={(value) =>
                          editLayer((l) => {
                            if (l.kind === 'text') l.font = value as typeof l.font;
                          })
                        }
                      >
                        {['Inter', 'Arial', 'Georgia', 'monospace'].map((f) => (
                          <SelectOption key={f} value={f}>
                            {f}
                          </SelectOption>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Weight">
                      <Select
                        value={String(layer.weight)}
                        onValueChange={(value) =>
                          editLayer((l) => {
                            if (l.kind === 'text') l.weight = +value;
                          })
                        }
                      >
                        {[400, 500, 600, 700].map((v) => (
                          <SelectOption key={v} value={String(v)}>
                            {v}
                          </SelectOption>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Range
                    label="Text size"
                    value={layer.size}
                    min={0.01}
                    max={0.2}
                    step={0.005}
                    onChange={(v) =>
                      editLayer((l) => {
                        if (l.kind === 'text') l.size = v;
                      })
                    }
                  />
                  <Field label="Text color">
                    <ColorPicker
                      value={layer.color}
                      onChange={(v) =>
                        editLayer((l) => {
                          if (l.kind === 'text') l.color = v;
                        })
                      }
                    />
                  </Field>
                  <div className="field-grid">
                    <Field label="Alignment">
                      <SegmentedControl
                        aria-label="Text alignment"
                        size="sm"
                        fullWidth
                        value={layer.align}
                        onValueChange={(value) =>
                          editLayer((l) => {
                            if (l.kind === 'text') l.align = value as typeof l.align;
                          })
                        }
                        options={[
                          {
                            value: 'left',
                            label: null,
                            icon: <AlignLeft size={16} />,
                            'aria-label': 'Align left',
                          },
                          {
                            value: 'center',
                            label: null,
                            icon: <AlignCenter size={16} />,
                            'aria-label': 'Align center',
                          },
                          {
                            value: 'right',
                            label: null,
                            icon: <AlignRight size={16} />,
                            'aria-label': 'Align right',
                          },
                        ]}
                      />
                    </Field>
                    {mode === 'video' && (
                      <Field label="Animation">
                        <Select
                          value={layer.animation}
                          onValueChange={(value) =>
                            editLayer((l) => {
                              if (l.kind === 'text') l.animation = value as typeof l.animation;
                            })
                          }
                        >
                          <SelectOption value="none">None</SelectOption>
                          <SelectOption value="simple">Simple</SelectOption>
                          <SelectOption value="typewriter">Typewriter</SelectOption>
                          <SelectOption value="letters">Letters</SelectOption>
                          <SelectOption value="words">Words</SelectOption>
                          <SelectOption value="blur">Blur fade</SelectOption>
                        </Select>
                      </Field>
                    )}
                  </div>
                  {mode === 'video' && (
                    <NumberField
                      label="Animation duration"
                      value={layer.duration}
                      min={0.01}
                      unit="s"
                      onChange={(v) =>
                        editLayer((l) => {
                          if (l.kind === 'text') l.duration = v;
                        })
                      }
                    />
                  )}
                </>
              ) : (
                <Field label="Logo image">
                  <Select
                    value={layer.assetId}
                    onValueChange={(value) =>
                      editLayer((l) => {
                        if (l.kind === 'logo') l.assetId = value;
                      })
                    }
                  >
                    {images.map((a) => (
                      <SelectOption key={a.id} value={a.id}>
                        {a.name}
                      </SelectOption>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="field-grid">
                <NumberField
                  label="Layer X"
                  value={layer.x}
                  min={0}
                  max={1}
                  onChange={(v) =>
                    editLayer((l) => {
                      l.x = v;
                    })
                  }
                />
                <NumberField
                  label="Layer Y"
                  value={layer.y}
                  min={0}
                  max={1}
                  onChange={(v) =>
                    editLayer((l) => {
                      l.y = v;
                    })
                  }
                />
              </div>
              <Range
                label={layer.kind === 'logo' ? 'Logo scale' : 'Text area width'}
                value={layer.width}
                min={0.02}
                max={1}
                onChange={(v) =>
                  editLayer((l) => {
                    l.width = v;
                  })
                }
              />
              <Range
                label="Layer opacity"
                value={layer.opacity}
                onChange={(v) =>
                  editLayer((l) => {
                    l.opacity = v;
                  })
                }
              />
              {mode === 'video' && (
                <div className="field-grid">
                  <NumberField
                    label="Visible from"
                    value={layer.start}
                    min={0}
                    unit="s"
                    onChange={(v) =>
                      editLayer((l) => {
                        l.start = v;
                      })
                    }
                  />
                  <NumberField
                    label="Visible until"
                    value={layer.end}
                    min={layer.start}
                    unit="s"
                    onChange={(v) =>
                      editLayer((l) => {
                        l.end = v;
                      })
                    }
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
      {activeTab === 'camera' && (
        <>
          {mode === 'video' && (
            <>
              <div className="key-list">
                {[...scene.keyframes]
                  .sort((a, b) => a.time - b.time)
                  .map((k, i) => (
                    <Button
                      variant="soft"
                      color="gray"
                      key={k.id}
                      className={keyId === k.id ? 'selected' : ''}
                      onClick={() => {
                        state.selectKey(k.id);
                        runtime.set({ time: (span?.start || 0) + k.time, playing: false });
                      }}
                    >
                      <Diamond size={12} />
                      <span>
                        {i === 0
                          ? 'Start'
                          : i === scene.keyframes.length - 1
                            ? 'End'
                            : `Position ${i + 1}`}
                      </span>
                      <small>{k.time.toFixed(2)}s</small>
                    </Button>
                  ))}
              </div>
              <Button
                variant="soft"
                color="gray"
                className="secondary full"
                onClick={() => {
                  const id = uid();
                  edit((s) =>
                    s.keyframes.push({
                      id,
                      time: local,
                      pose: clone(pose),
                      easing: 'smooth',
                      bezier: [0.25, 0.1, 0.25, 1],
                    }),
                  );
                  state.selectKey(id);
                }}
              >
                <Plus size={14} /> Capture at playhead
              </Button>
              {key && (
                <>
                  <div className="field-grid">
                    <NumberField
                      label="Keyframe time"
                      value={key.time}
                      min={0}
                      max={scene.duration}
                      unit="s"
                      onChange={(v) => {
                        edit((s) => {
                          s.keyframes.find((k) => k.id === keyId)!.time = v;
                        });
                        runtime.set({ time: (span?.start || 0) + v, playing: false });
                      }}
                    />
                    <Field label="Easing to next">
                      <Select
                        value={key.easing}
                        onValueChange={(value) =>
                          edit((s) => {
                            const target = s.keyframes.find((k) => k.id === keyId)!;
                            target.easing = value as typeof key.easing;
                            delete target.easingWindow;
                          })
                        }
                      >
                        {[
                          ['linear', 'Linear'],
                          ['ease', 'Ease'],
                          ['in', 'Ease in'],
                          ['out', 'Ease out'],
                          ['inOut', 'Ease in out'],
                          ['smooth', 'Smooth'],
                          ['custom', 'Custom Bézier'],
                        ].map(([v, label]) => (
                          <SelectOption key={v} value={v}>
                            {label}
                          </SelectOption>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  {key.easing === 'custom' && (
                    <>
                      <svg
                        className="bezier-editor"
                        viewBox="0 0 200 120"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          state.begin();
                        }}
                        onPointerMove={(e) => {
                          if (e.buttons !== 1) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = clamp((e.clientX - rect.left) / rect.width, 0, 1),
                            y = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
                          const which =
                            Math.abs(x - key.bezier[0]) + Math.abs(y - key.bezier[1]) <
                            Math.abs(x - key.bezier[2]) + Math.abs(y - key.bezier[3])
                              ? 0
                              : 2;
                          edit((s) => {
                            const k = s.keyframes.find((k) => k.id === keyId)!;
                            k.bezier[which] = x;
                            k.bezier[which + 1] = y;
                            delete k.easingWindow;
                          });
                        }}
                        onPointerUp={state.commit}
                      >
                        <path
                          d={`M 0 120 C ${key.bezier[0] * 200} ${120 - key.bezier[1] * 120} ${key.bezier[2] * 200} ${120 - key.bezier[3] * 120} 200 0`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <circle
                          cx={key.bezier[0] * 200}
                          cy={120 - key.bezier[1] * 120}
                          r="6"
                          fill="currentColor"
                        />
                        <circle
                          cx={key.bezier[2] * 200}
                          cy={120 - key.bezier[3] * 120}
                          r="6"
                          fill="currentColor"
                        />
                      </svg>
                      <div className="field-grid">
                        {key.bezier.map((v, i) => (
                          <NumberField
                            key={i}
                            label={['Control 1 X', 'Control 1 Y', 'Control 2 X', 'Control 2 Y'][i]}
                            value={v}
                            min={i % 2 ? -2 : 0}
                            max={i % 2 ? 3 : 1}
                            onChange={(v) =>
                              edit((s) => {
                                const target = s.keyframes.find((k) => k.id === keyId)!;
                                target.bezier[i] = v;
                                delete target.easingWindow;
                              })
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="button-row">
                    <Button
                      variant="soft"
                      color="gray"
                      className="secondary"
                      onClick={() =>
                        edit((s) => {
                          s.keyframes.find((k) => k.id === keyId)!.pose = clone(s.pose);
                        })
                      }
                    >
                      Update from composition
                    </Button>
                    <IconButton
                      label="Delete keyframe"
                      onClick={() => {
                        edit((s) => {
                          s.keyframes = s.keyframes.filter((k) => k.id !== keyId);
                        });
                        state.selectKey(null);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </>
              )}
            </>
          )}
          {cameraControls}
          <section className="advanced-settings-group">
            <h3>Focus and depth</h3>
            <div className="inspector-disclosure-body">{focus}</div>
          </section>
        </>
      )}
    </>
  );
}
