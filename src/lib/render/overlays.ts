import type { Logo, Scene, TextLayer } from '../studio/model';
import { clamp } from '../studio/model';
import { MediaSession } from '../media/pool';
type Ctx = CanvasRenderingContext2D;
let measurer: Ctx | null = null;
/** The drawn area of a text layer, in canvas fractions, for hit testing and outlines. */
export function textBounds(l: TextLayer, w: number, h: number) {
  measurer ??= document.createElement('canvas').getContext('2d')!;
  const size = l.size * h;
  measurer.font = `${l.weight} ${size}px ${l.font}`;
  const lines = wrap(measurer, l.text, l.width * w);
  const width = Math.max(size * 0.5, ...lines.map((line) => measurer!.measureText(line).width));
  const left =
    l.align === 'left' ? l.x * w : l.align === 'right' ? l.x * w - width : l.x * w - width / 2;
  return { x: left / w, y: l.y, w: width / w, h: (lines.length * size * 1.25) / h };
}
function wrap(ctx: Ctx, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}
function text(ctx: Ctx, l: TextLayer, time: number, w: number, h: number) {
  if (time < l.start || time > l.end) return;
  const p = clamp((time - l.start + (l.animationOffset ?? 0)) / Math.max(0.01, l.duration), 0, 1);
  const smooth = 1 - (1 - p) ** 3;
  let content = l.text;
  if (l.animation === 'typewriter') content = content.slice(0, Math.ceil(content.length * p));
  if (l.animation === 'words') {
    const words = content.split(/(\s+)/);
    content = words.slice(0, Math.ceil(words.length * p)).join('');
  }
  const size = l.size * h;
  ctx.save();
  ctx.font = `${l.weight} ${size}px ${l.font}`;
  ctx.fillStyle = l.color;
  ctx.textBaseline = 'top';
  ctx.textAlign = l.align;
  ctx.globalAlpha = l.opacity;
  if (l.animation === 'simple' || l.animation === 'blur') {
    ctx.globalAlpha *= smooth;
    if (l.animation === 'blur') ctx.filter = `blur(${(1 - smooth) * 0.015 * h}px)`;
  }
  const lines = wrap(ctx, content, l.width * w);
  const x = l.x * w;
  let y = l.y * h;
  if (l.animation === 'simple') y += (1 - smooth) * 0.03 * h;
  if (l.animation === 'letters') {
    let index = 0;
    const count = l.text.length;
    for (const line of lines) {
      let cursor =
        l.align === 'left'
          ? x
          : l.align === 'center'
            ? x - ctx.measureText(line).width / 2
            : x - ctx.measureText(line).width;
      ctx.textAlign = 'left';
      for (const char of line) {
        const a = clamp(p * 1.35 - (index / Math.max(1, count)) * 0.35, 0, 1);
        ctx.globalAlpha = l.opacity * a;
        ctx.fillText(char, cursor, y + (1 - a) * size * 0.35);
        cursor += ctx.measureText(char).width;
        index++;
      }
      y += size * 1.25;
    }
  } else
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += size * 1.25;
    }
  ctx.restore();
}
/** Top-left corner for a box anchored to one of the nine canvas positions. */
export function anchorBox(logo: Logo, boxW: number, boxH: number, w: number, h: number) {
  const m = logo.margin * Math.min(w, h);
  const [vertical, horizontal] = logo.position.includes('-')
    ? logo.position.split('-')
    : logo.position === 'top' || logo.position === 'bottom'
      ? [logo.position, 'center']
      : ['center', logo.position];
  const x = horizontal === 'left' ? m : horizontal === 'right' ? w - m - boxW : (w - boxW) / 2;
  const y = vertical === 'top' ? m : vertical === 'bottom' ? h - m - boxH : (h - boxH) / 2;
  return { x, y };
}
export const logoFontSize = (logo: Logo, w: number) => logo.size * w * 0.3;
async function drawLogo(ctx: Ctx, logo: Logo, w: number, h: number, media: MediaSession) {
  ctx.save();
  ctx.globalAlpha = logo.opacity;
  if (logo.kind === 'image') {
    if (!logo.assetId) return ctx.restore();
    const { source, record } = await media.get(logo.assetId);
    const width = logo.size * w,
      height = (width * record.meta.height) / record.meta.width;
    const { x, y } = anchorBox(logo, width, height, w, h);
    ctx.drawImage(source, x, y, width, height);
  } else if (logo.text.trim()) {
    const size = logoFontSize(logo, w);
    ctx.font = `${logo.weight} ${size}px ${logo.font}`;
    ctx.fillStyle = logo.color;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const { x, y } = anchorBox(logo, ctx.measureText(logo.text).width, size, w, h);
    ctx.fillText(logo.text, x, y);
  }
  ctx.restore();
}
export async function drawOverlays(
  ctx: Ctx,
  scene: Scene,
  time: number,
  w: number,
  h: number,
  media: MediaSession,
  still = false,
) {
  for (const layer of scene.layers) {
    if (layer.kind === 'text') text(ctx, layer, still ? layer.start + layer.duration : time, w, h);
    else if (still || (time >= layer.start && time <= layer.end)) {
      const { source, record } = await media.get(layer.assetId);
      const width = layer.width * w,
        height = (width * record.meta.height) / record.meta.width;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(source, layer.x * w - width / 2, layer.y * h - height / 2, width, height);
      ctx.restore();
    }
  }
  if (scene.logo?.enabled) await drawLogo(ctx, scene.logo, w, h, media);
}
export function drawFitted(
  ctx: Ctx,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  w: number,
  h: number,
  fit: 'fit' | 'fill',
  x = 0.5,
  y = 0.5,
) {
  const s = fit === 'fill' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * s,
    dh = sh * s;
  ctx.drawImage(source, (w - dw) * x, (h - dh) * y, dw, dh);
}
