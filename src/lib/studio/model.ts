import { current, isDraft } from 'immer';
export type Vec2 = { x: number; y: number };
export type CameraPose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  zoom: number;
  fov: number;
  focusX: number;
  focusY: number;
  autoFocus: boolean;
};
export type Easing = 'linear' | 'ease' | 'in' | 'out' | 'inOut' | 'smooth' | 'custom';
export type Keyframe = {
  id: string;
  time: number;
  pose: CameraPose;
  easing: Easing;
  bezier: [number, number, number, number];
};
export type Asset = {
  id: string;
  name: string;
  kind: 'image' | 'video';
  mime: string;
  width: number;
  height: number;
  duration: number;
  createdAt: number;
  thumbnail: string;
  note?: string;
};
export type AssetRecord = { meta: Asset; blob: Blob };
export type FrameStyle = {
  kind: 'plain' | 'laptop' | 'phone' | 'monitor';
  radius: number;
  border: number;
  padding: number;
  color: string;
  header: boolean;
  fit: 'fit' | 'fill';
  cropX: number;
  cropY: number;
  cropZoom: number;
};
export type Background = {
  kind: 'color' | 'image' | 'transparent';
  color: string;
  assetId?: string;
  fit: 'fit' | 'fill';
  x: number;
  y: number;
};
export type TextLayer = {
  id: string;
  kind: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  font: 'Inter' | 'Arial' | 'Georgia' | 'monospace';
  weight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  animation: 'none' | 'simple' | 'typewriter' | 'letters' | 'words' | 'blur';
  start: number;
  duration: number;
  end: number;
  opacity: number;
};
export type LogoLayer = {
  id: string;
  kind: 'logo';
  assetId: string;
  x: number;
  y: number;
  width: number;
  opacity: number;
  start: number;
  end: number;
};
export type Layer = TextLayer | LogoLayer;
export type Scene = {
  id: string;
  name: string;
  kind: 'media' | 'text';
  assetId?: string;
  duration: number;
  trimIn: number;
  trimOut: number;
  loop: boolean;
  pose: CameraPose;
  frame: FrameStyle;
  background: Background;
  blur: number;
  focusWidth: number;
  dofEnabled: boolean;
  maxBlur: number;
  shadow: 'off' | 'small' | 'medium' | 'large';
  shadowIntensity: number;
  layers: Layer[];
  keyframes: Keyframe[];
  transition: { kind: 'cut' | 'fade' | 'push' | 'zoom'; duration: number };
  points: (Vec2 & { w: number; h: number })[];
  seed: number;
};
export type Project = {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  output: { width: number; height: number };
  photo: Scene;
  scenes: Scene[];
};
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T =>
  structuredClone(isDraft(value) ? current(value as object) : value) as T;
export const defaultPose = (): CameraPose => ({
  x: 0,
  y: 0,
  z: 0,
  rx: 18,
  ry: -22,
  rz: -6,
  zoom: 1,
  fov: 38,
  focusX: 0.35,
  focusY: 0.35,
  autoFocus: true,
});
export function makeScene(asset?: Asset, text = false): Scene {
  return {
    id: uid(),
    name: text ? 'Text scene' : asset?.name.replace(/\.[^.]+$/, '') || 'Blank scene',
    kind: text ? 'text' : 'media',
    assetId: asset?.id,
    duration: asset?.kind === 'video' ? clamp(asset.duration, 0.1, 86400) : 4,
    trimIn: 0,
    trimOut: asset?.duration || 4,
    loop: false,
    pose: asset?.kind === 'video' ? { ...defaultPose(), rx: 0, ry: 0, rz: 0 } : defaultPose(),
    frame: {
      kind: 'plain',
      radius: 0,
      border: 0,
      padding: 0,
      color: '#ffffff',
      header: false,
      fit: 'fit',
      cropX: 0.5,
      cropY: 0.5,
      cropZoom: 1,
    },
    background: { kind: 'color', color: '#f4f4f5', fit: 'fill', x: 0.5, y: 0.5 },
    blur: 0,
    focusWidth: 0.12,
    dofEnabled: true,
    maxBlur: 0.7,
    shadow: asset?.kind === 'video' ? 'off' : 'medium',
    shadowIntensity: 0.3,
    layers: text ? [makeText('Text')] : [],
    keyframes: [],
    transition: { kind: 'cut', duration: 0.6 },
    points: [],
    seed: 1,
  };
}
export function makeText(text = 'Text'): TextLayer {
  return {
    id: uid(),
    kind: 'text',
    text,
    x: 0.5,
    y: 0.43,
    width: 0.75,
    size: 0.065,
    font: 'Inter',
    weight: 600,
    color: '#17181b',
    align: 'center',
    animation: 'none',
    start: 0,
    duration: 0.8,
    end: 3600,
    opacity: 1,
  };
}
export function makeProject(asset?: Asset): Project {
  const now = Date.now();
  const photo = makeScene(asset);
  return {
    version: 1,
    id: uid(),
    name: 'Untitled project',
    createdAt: now,
    updatedAt: now,
    output: { width: 16, height: 9 },
    photo,
    scenes: [],
  };
}
export function referencedAssetIds(project: Project): string[] {
  const ids = new Set<string>();
  for (const s of [project.photo, ...project.scenes]) {
    if (s.assetId) ids.add(s.assetId);
    if (s.background.assetId) ids.add(s.background.assetId);
    for (const l of s.layers) if (l.kind === 'logo') ids.add(l.assetId);
  }
  return [...ids];
}
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
