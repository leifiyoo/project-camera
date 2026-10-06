'use client';
import { Switch } from 'radix-ui';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Image as ImageIcon,
  Plus,
  Trash2,
  Type,
  Upload,
} from '@/components/ui/studio-icons';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { selectedScene, useStudio } from '@/lib/studio/store';
import {
  makeLogo,
  makeText,
  type Asset,
  type Logo,
  type LogoPosition,
  type TextLayer,
} from '@/lib/studio/model';
import { Field, IconButton, Range, Select, SelectOption } from './primitives';
import ColorPicker from './ColorPicker';
import type { MediaTarget } from './Inspector';

const fonts = ['Inter', 'Arial', 'Georgia', 'monospace'] as const;
const weights = [400, 500, 600, 700];
const positions: { value: LogoPosition; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top', label: 'Top' },
  { value: 'top-right', label: 'Top right' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'bottom-right', label: 'Bottom right' },
];

function FontFields({
  font,
  weight,
  onFont,
  onWeight,
}: {
  font: TextLayer['font'];
  weight: number;
  onFont: (font: TextLayer['font']) => void;
  onWeight: (weight: number) => void;
}) {
  return (
    <div className="field-grid">
      <Field label="Font">
        <Select value={font} onValueChange={(value) => onFont(value as TextLayer['font'])}>
          {fonts.map((f) => (
            <SelectOption key={f} value={f}>
              {f === 'monospace' ? 'Mono' : f}
            </SelectOption>
          ))}
        </Select>
      </Field>
      <Field label="Weight">
        <Select value={String(weight)} onValueChange={(value) => onWeight(+value)}>
          {weights.map((w) => (
            <SelectOption key={w} value={String(w)}>
              {{ 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' }[w]}
            </SelectOption>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function PositionGrid({
  value,
  onChange,
}: {
  value: LogoPosition;
  onChange: (value: LogoPosition) => void;
}) {
  return (
    <div className="position-grid" role="radiogroup" aria-label="Logo position">
      {positions.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          aria-label={p.label}
          title={p.label}
          onClick={() => onChange(p.value)}
        >
          <i />
        </button>
      ))}
    </div>
  );
}

export function LogoSection({
  assets,
  onImport,
}: {
  assets: Asset[];
  onImport: (target: MediaTarget) => void;
}) {
  const scene = useStudio(selectedScene);
  if (!scene) return null;
  const logo = scene.logo ?? makeLogo();
  const images = assets.filter((a) => a.kind === 'image');
  const image = images.find((a) => a.id === logo.assetId);
  const edit = (fn: (l: Logo) => void) =>
    useStudio.getState().editScene((s) => {
      s.logo ??= makeLogo();
      fn(s.logo);
    });
  return (
    <section className="shot-sidebar-section logo-section" aria-label="Logo settings">
      <div className="section-heading">
        <h2 id="logo-heading">Logo</h2>
        <Switch.Root
          className="studio-switch"
          aria-labelledby="logo-heading"
          checked={logo.enabled}
          onCheckedChange={(enabled) =>
            edit((l) => {
              l.enabled = enabled;
            })
          }
        >
          <Switch.Thumb className="studio-switch-thumb" />
        </Switch.Root>
      </div>
      {logo.enabled && (
        <div className="logo-settings">
          <SegmentedControl
            className="logo-kind-switch"
            size="sm"
            fullWidth
            aria-label="Logo type"
            value={logo.kind}
            onValueChange={(value) =>
              edit((l) => {
                l.kind = value as Logo['kind'];
              })
            }
            options={[
              { value: 'image', label: 'Image', icon: <ImageIcon size={14} /> },
              { value: 'text', label: 'Text', icon: <Type size={14} /> },
            ]}
          />
          {logo.kind === 'image' ? (
            <div className="logo-image">
              <button
                type="button"
                className="logo-image-thumb checker"
                aria-label={image ? 'Upload a different logo' : 'Upload a logo'}
                title="Upload an image"
                onClick={() => onImport('logo')}
              >
                {image ? <img src={image.thumbnail} alt="" /> : <Upload size={16} />}
              </button>
              {images.length ? (
                <Select
                  aria-label="Logo image"
                  value={image ? image.id : ''}
                  onValueChange={(value) =>
                    edit((l) => {
                      l.assetId = value || undefined;
                    })
                  }
                >
                  <SelectOption value="" disabled>
                    Choose an image
                  </SelectOption>
                  {images.map((a) => (
                    <SelectOption key={a.id} value={a.id}>
                      {a.name}
                    </SelectOption>
                  ))}
                </Select>
              ) : (
                <button type="button" className="logo-upload" onClick={() => onImport('logo')}>
                  Upload PNG or SVG
                </button>
              )}
            </div>
          ) : (
            <>
              <Field label="Text">
                <input
                  value={logo.text}
                  maxLength={500}
                  placeholder="Your brand"
                  onChange={(e) =>
                    edit((l) => {
                      l.text = e.target.value;
                    })
                  }
                />
              </Field>
              <FontFields
                font={logo.font}
                weight={logo.weight}
                onFont={(font) =>
                  edit((l) => {
                    l.font = font;
                  })
                }
                onWeight={(weight) =>
                  edit((l) => {
                    l.weight = weight;
                  })
                }
              />
              <Field label="Color">
                <ColorPicker
                  value={logo.color}
                  onChange={(color) =>
                    edit((l) => {
                      l.color = color;
                    })
                  }
                />
              </Field>
            </>
          )}
          <div className="logo-placement">
            <Field label="Position">
              <PositionGrid
                value={logo.position}
                onChange={(position) =>
                  edit((l) => {
                    l.position = position;
                  })
                }
              />
            </Field>
            <div className="logo-sliders">
              <Range
                label="Size"
                value={Math.round(logo.size * 100)}
                min={2}
                max={40}
                step={1}
                unit="%"
                onChange={(v) =>
                  edit((l) => {
                    l.size = v / 100;
                  })
                }
              />
              <Range
                label="Opacity"
                value={Math.round(logo.opacity * 100)}
                min={5}
                max={100}
                step={1}
                unit="%"
                onChange={(v) =>
                  edit((l) => {
                    l.opacity = v / 100;
                  })
                }
              />
              <Range
                label="Spacing"
                value={Math.round(logo.margin * 100)}
                max={20}
                step={1}
                unit="%"
                onChange={(v) =>
                  edit((l) => {
                    l.margin = v / 100;
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function TextSection() {
  const scene = useStudio(selectedScene);
  const layerId = useStudio((s) => s.layerId);
  if (!scene) return null;
  const state = useStudio.getState();
  const layers = scene.layers;
  const selected = layers.find((l) => l.id === layerId);
  const edit = (fn: (l: TextLayer) => void) =>
    state.editLayer((l) => {
      if (l.kind === 'text') fn(l);
    });
  return (
    <section className="shot-sidebar-section text-section" aria-label="Text settings">
      <div className="section-heading">
        <h2>Text</h2>
        <button
          type="button"
          className="section-reset"
          onClick={() => {
            const l = makeText();
            state.editScene((s) => s.layers.push(l));
            state.selectLayer(l.id);
          }}
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {!layers.length && (
        <p className="panel-note">Add a headline or caption, then drag it on the canvas.</p>
      )}
      {!!layers.length && (
        <ul className="text-layer-list">
          {layers.map((l) => (
            <li key={l.id} data-selected={l.id === layerId || undefined}>
              <button
                type="button"
                aria-pressed={l.id === layerId}
                onClick={() => state.selectLayer(l.id === layerId ? null : l.id)}
              >
                {l.kind === 'text' ? <Type size={14} /> : <ImageIcon size={14} />}
                <span>{l.kind === 'text' ? l.text.trim() || 'Empty text' : 'Image'}</span>
              </button>
              <IconButton
                label="Delete"
                onClick={() => {
                  state.editScene((s) => {
                    s.layers = s.layers.filter((x) => x.id !== l.id);
                  });
                  if (l.id === layerId) state.selectLayer(null);
                }}
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {selected?.kind === 'text' && (
        <div className="text-layer-editor">
          <Field label="Content">
            <textarea
              value={selected.text}
              rows={2}
              onChange={(e) =>
                edit((l) => {
                  l.text = e.target.value;
                })
              }
            />
          </Field>
          <FontFields
            font={selected.font}
            weight={selected.weight}
            onFont={(font) =>
              edit((l) => {
                l.font = font;
              })
            }
            onWeight={(weight) =>
              edit((l) => {
                l.weight = weight;
              })
            }
          />
          <Range
            label="Size"
            value={Math.round(selected.size * 1000) / 10}
            min={1}
            max={20}
            step={0.5}
            onChange={(v) =>
              edit((l) => {
                l.size = v / 100;
              })
            }
          />
          <Field label="Color">
            <ColorPicker
              value={selected.color}
              onChange={(color) =>
                edit((l) => {
                  l.color = color;
                })
              }
            />
          </Field>
          <Field label="Align">
            <SegmentedControl
              aria-label="Text alignment"
              size="sm"
              fullWidth
              value={selected.align}
              onValueChange={(value) =>
                edit((l) => {
                  l.align = value as TextLayer['align'];
                })
              }
              options={[
                { value: 'left', label: null, icon: <AlignLeft size={15} />, 'aria-label': 'Left' },
                {
                  value: 'center',
                  label: null,
                  icon: <AlignCenter size={15} />,
                  'aria-label': 'Center',
                },
                {
                  value: 'right',
                  label: null,
                  icon: <AlignRight size={15} />,
                  'aria-label': 'Right',
                },
              ]}
            />
          </Field>
          <Range
            label="Opacity"
            value={Math.round(selected.opacity * 100)}
            max={100}
            step={1}
            unit="%"
            onChange={(v) =>
              edit((l) => {
                l.opacity = v / 100;
              })
            }
          />
        </div>
      )}
    </section>
  );
}
