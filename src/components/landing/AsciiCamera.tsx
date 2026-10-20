'use client';
import { useEffect, useRef } from 'react';

/**
 * The hero: a page in 3D, ray-cast into characters. Detail falls off into noise away from the
 * focus point, like the studio's depth blur. It orbits on its own, and a horizontal drag turns
 * it. Text only, so the server renders the first frame and the headline stays the big paint.
 */

const COLS = 72;
const ROWS = 24;
// A monospace cell is about 0.6em wide and 1.15em tall (the line height in polish.css).
const ASPECT = (ROWS * 1.15) / (COLS * 0.6);
const TAN = 0.62;
const DISTANCE = 2.35;
const HALF_W = 1;
const HALF_H = 0.625;
const RAMP = ' .,:;-=+*#%@';
// The focus point on the page, in the 320×200 layout below.
const FOCUS = { x: 66, y: 78 };

type View = { yaw: number; pitch: number; roll: number };

const STILL: View = { yaw: 0.52, pitch: 0.2, roll: -0.07 };

// How bright the drawn page is at a point: a browser bar, a hero band with a headline, and cards.
function shade(x: number, y: number) {
  if (x < 3 || x > 317 || y < 3 || y > 197) return 1;
  if (y < 22) {
    for (const cx of [13, 23, 33]) if ((x - cx) ** 2 + (y - 11) ** 2 < 16) return 0.9;
    return x > 110 && x < 210 && y > 6 && y < 16 ? 0.12 : 0.45;
  }
  if (x > 14 && x < 306 && y > 34 && y < 122) {
    if ((x - 66) ** 2 + (y - 78) ** 2 < 26 ** 2) return 0.5;
    if (x > 112 && x < 240 && y > 56 && y < 67) return 0.08;
    if (x > 112 && x < 204 && y > 73 && y < 84) return 0.08;
    if (x > 112 && x < 262 && y > 93 && y < 98) return 0.45;
    return 0.86;
  }
  if (y > 134 && y < 186) {
    for (const left of [14, 115, 216]) {
      if (x > left && x < left + 90) return y > 164 && y < 172 && x < left + 58 ? 0.85 : 0.42;
    }
  }
  return 0.1;
}

function hash(a: number, b: number, c: number) {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function draw({ yaw, pitch, roll }: View, seed: number) {
  const [cy, sy, cp, sp, cr, sr] = [yaw, yaw, pitch, pitch, roll, roll].map((a, i) =>
    i % 2 ? Math.sin(a) : Math.cos(a),
  );
  // Roll · pitch · yaw, applied to the page's own axes.
  const rotate = (x: number, y: number, z: number) => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [x1 * cr - y2 * sr, x1 * sr + y2 * cr, z2];
  };
  const ex = rotate(1, 0, 0);
  const ey = rotate(0, 1, 0);
  const n = rotate(0, 0, 1);
  const light = 0.8 + 0.2 * Math.abs(-0.4 * n[0] + 0.5 * n[1] - 0.77 * n[2]);

  const fu = (FOCUS.x / 160 - 1) * HALF_W;
  const fv = (1 - FOCUS.y / 100) * HALF_H;
  const focus = [0, 1, 2].map((i) => fu * ex[i] + fv * ey[i]);

  let text = '';
  for (let r = 0; r < ROWS; r++) {
    const dy = -((r + 0.5) / ROWS) * 2 + 1;
    for (let c = 0; c < COLS; c++) {
      const dx = (((c + 0.5) / COLS) * 2 - 1) * TAN;
      const d = [dx, dy * TAN * ASPECT, 1];
      const facing = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
      const t = Math.abs(facing) > 1e-6 ? (DISTANCE * n[2]) / facing : -1;
      const hit = [d[0] * t, d[1] * t, d[2] * t - DISTANCE];
      const u = (hit[0] * ex[0] + hit[1] * ex[1] + hit[2] * ex[2]) / HALF_W;
      const v = (hit[0] * ey[0] + hit[1] * ey[1] + hit[2] * ey[2]) / HALF_H;
      if (t <= 0 || Math.abs(u) > 1 || Math.abs(v) > 1) {
        text += c % 6 === 3 && r % 3 === 1 ? '·' : ' ';
        continue;
      }
      const blur = Math.min(1, Math.max(0, Math.abs(hit[2] - focus[2]) - 0.1) * 1.5);
      const sharp = shade((u + 1) * 160, (1 - v) * 100) * light;
      const soft = sharp * (1 - blur) + 0.3 * blur + (hash(c, r, seed) - 0.5) * 0.5 * blur;
      const level = Math.round(Math.min(1, Math.max(0, soft)) * (RAMP.length - 1));
      text += RAMP[Math.max(1, level)];
    }
    if (r < ROWS - 1) text += '\n';
  }

  const depth = focus[2] + DISTANCE;
  return {
    text,
    focusX: ((focus[0] / depth / TAN + 1) / 2) * 100,
    focusY: ((-focus[1] / depth / (TAN * ASPECT) + 1) / 2) * 100,
  };
}

function readout({ yaw, pitch }: View) {
  const deg = (a: number) => {
    const d = (a * 180) / Math.PI;
    return `${d < 0 ? '-' : '+'}${Math.abs(d).toFixed(1).padStart(4, '0')}°`;
  };
  return `yaw ${deg(yaw)}  pitch ${deg(pitch)}`;
}

export function AsciiCamera() {
  const stageRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const focusRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const first = draw(STILL, 0);

  useEffect(() => {
    const stage = stageRef.current!;
    const pre = preRef.current!;
    const marker = focusRef.current!;
    const label = readoutRef.current!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const view = { ...STILL };
    let drag: { x: number; yaw: number } | null = null;
    let dragYaw = view.yaw;
    let visible = false;
    let frame = 0;
    let last = 0;
    let start = 0;

    const render = (seed: number) => {
      const out = draw(view, seed);
      pre.textContent = out.text;
      marker.style.left = `${out.focusX}%`;
      marker.style.top = `${out.focusY}%`;
      label.textContent = readout(view);
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // A terminal's frame rate, about 30 fps.
      if (now - last < 32) return;
      last = now;
      // Start the orbit at the current angle, so it never jumps.
      start ||= now - (Math.asin(Math.max(-1, Math.min(1, view.yaw / 0.62))) / 0.45) * 1000;
      const t = (now - start) / 1000;
      const goal = drag
        ? { yaw: dragYaw, pitch: 0.2, roll: -0.05 }
        : {
            yaw: 0.62 * Math.sin(t * 0.45),
            pitch: 0.2 + 0.08 * Math.sin(t * 0.31),
            roll: -0.06 + 0.04 * Math.sin(t * 0.27),
          };
      view.yaw += (goal.yaw - view.yaw) * 0.14;
      view.pitch += (goal.pitch - view.pitch) * 0.14;
      view.roll += (goal.roll - view.roll) * 0.14;
      render(Math.floor(now / 120));
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      if (visible && !still.matches) frame = requestAnimationFrame(tick);
    };

    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, yaw: view.yaw };
      dragYaw = view.yaw;
      stage.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      dragYaw = Math.max(-1.2, Math.min(1.2, drag.yaw + (e.clientX - drag.x) * 0.008));
      // Without the loop, follow the finger directly.
      if (still.matches) {
        view.yaw = dragYaw;
        render(0);
      }
    };
    const up = () => {
      drag = null;
      start = 0;
    };

    // Hidden on wide screens (display: none), so it never animates behind the studio.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(stage);
    still.addEventListener('change', sync);
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      still.removeEventListener('change', sync);
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <figure className="lp-cam" aria-hidden="true">
      <figcaption className="lp-cam-bar">
        <span>
          <i /> cam_01.view
        </span>
        <span ref={readoutRef} suppressHydrationWarning>
          {readout(STILL)}
        </span>
      </figcaption>
      <div className="lp-cam-stage" ref={stageRef}>
        <pre ref={preRef} suppressHydrationWarning>
          {first.text}
        </pre>
        <span
          className="lp-cam-focus"
          ref={focusRef}
          style={{ left: `${first.focusX}%`, top: `${first.focusY}%` }}
          suppressHydrationWarning
        >
          [+]
        </span>
      </div>
      <p className="lp-cam-bar">
        <span>f/1.8 · focus locked</span>
        <span>← drag to orbit →</span>
      </p>
    </figure>
  );
}
