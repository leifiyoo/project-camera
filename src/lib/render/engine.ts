import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MediaSession } from '../media/pool';
import { resolveAsset } from '../media/pool';
import { mediaTime, type RenderState } from '../studio/evaluate';
import { type Scene, type Asset, clamp } from '../studio/model';
import { drawFitted, drawOverlays } from './overlays';
import { depthOfFieldShader } from './depth-of-field';
function roundedShape(w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  const x = -w / 2,
    y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
type Subject = { group: THREE.Group; screen: THREE.Mesh; w: number; h: number; signature: string };
export class StudioRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layerCanvas: HTMLCanvasElement;
  private layerCtx: CanvasRenderingContext2D;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 24);
  private composer: EffectComposer | null = null;
  private bokeh: BokehPass | null = null;
  private media = new MediaSession();
  private subjects = new Map<string, Subject>();
  private textures = new Map<string, THREE.Texture>();
  private active: Subject | null = null;
  private activeTransform = { offsetX: 0, scale: 1 };
  private ray = new THREE.Raycaster();
  private width = 0;
  private height = 0;
  private disposed = false;
  private shadowCanvas: HTMLCanvasElement;
  private shadowKey = '';
  private lights = new THREE.Group();
  reduced = false;
  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;
    this.layerCanvas = document.createElement('canvas');
    this.layerCtx = this.layerCanvas.getContext('2d', { alpha: true })!;
    this.shadowCanvas = document.createElement('canvas');
    this.lights.add(new THREE.HemisphereLight('#ffffff', '#6f737b', 2.0));
    const key = new THREE.DirectionalLight('#ffffff', 2.5);
    key.position.set(-3, 5, 7);
    this.lights.add(key);
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.setClearColor(0, 0);
      this.renderer.setPixelRatio(1);
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bokeh = new BokehPass(this.scene, this.camera, {
        focus: 7,
        aperture: 0.01,
        maxblur: 0.015,
      });
      // Three r186 renamed this internal material; keep the depth pass's side
      // consistent with the visible surface even when users turn it past 90°.
      const depthMaterial = Reflect.get(this.bokeh, '_materialDepth') ?? this.bokeh.materialDepth;
      if (depthMaterial instanceof THREE.MeshDepthMaterial) depthMaterial.side = THREE.DoubleSide;
      this.bokeh.materialBokeh.fragmentShader = depthOfFieldShader;
      this.bokeh.materialBokeh.uniforms.focusWidth = { value: 0.12 };
      this.bokeh.materialBokeh.uniforms.outputHeight = { value: 1 };
      this.composer.addPass(this.bokeh);
      const output = new OutputPass();
      // Unpremultiply linear RGBA before converting to sRGB. The final canvas
      // expects straight alpha; converting premultiplied RGB causes bright fringes.
      output.material.fragmentShader = output.material.fragmentShader.replace(
        'gl_FragColor = texture2D( tDiffuse, vUv );',
        'gl_FragColor = texture2D( tDiffuse, vUv ); if (gl_FragColor.a > 0.0001) { gl_FragColor.rgb /= gl_FragColor.a; } else { gl_FragColor = vec4(0.0); }',
      );
      this.composer.addPass(output);
      this.composer.renderTarget1.samples = 2;
      this.composer.renderTarget2.samples = 2;
      for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
        // Prefilter each disk sample's footprint. Without mipmaps a wide blur
        // undersamples tiny UI glyphs into a repeating dotted/mesh pattern.
        target.texture.generateMipmaps = true;
        target.texture.minFilter = THREE.LinearMipmapLinearFilter;
      }
    } catch {
      this.reduced = true;
      this.renderer?.dispose();
      this.renderer = null;
    }
  }
  private resize(w: number, h: number) {
    if (w === this.width && h === this.height) return;
    if (this.renderer) {
      const gl = this.renderer.getContext();
      const max = Math.min(
        this.renderer.capabilities.maxTextureSize,
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      );
      if (w > max || h > max)
        throw new Error(
          `This GPU supports exports up to ${max} pixels per edge. Choose a smaller resolution.`,
        );
    }
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.layerCanvas.width = w;
    this.layerCanvas.height = h;
    this.renderer?.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private clearSubject(subject: Subject) {
    subject.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshBasicMaterial && m.map && m.map.userData.owned)
            m.map.dispose();
          m.dispose();
        });
      }
    });
  }
  private texture(id: string, source: CanvasImageSource, video: boolean) {
    let t = this.textures.get(id);
    if (!t) {
      t = new THREE.Texture(source as TexImageSource);
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = Math.min(8, this.renderer?.capabilities.getMaxAnisotropy() || 1);
      this.textures.set(id, t);
      t.needsUpdate = true;
    } else if (video) {
      t.image = source;
      t.needsUpdate = true;
    }
    return t;
  }
  private subject(scene: Scene, asset: Asset): Subject {
    const signature = JSON.stringify([asset.width, asset.height]);
    const cached = this.subjects.get(scene.id);
    if (cached?.signature === signature) return cached;
    if (cached) this.clearSubject(cached);
    const group = new THREE.Group();
    const aspect = asset.width / asset.height;
    let w = 4.8,
      h = w / aspect;
    if (h > 4) {
      h = 4;
      w = h * aspect;
    }
    // Imported media is a single image plane. No backing, frame, rounded mask
    // or extrusion may fill transparent pixels or add a border to the source.
    const shape = roundedShape(w, h, 0);
    const geo = new THREE.ShapeGeometry(shape, 24);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.001,
      depthWrite: true,
    });
    const screen = new THREE.Mesh(geo, material);
    group.add(screen);
    const result = {
      group,
      screen,
      w,
      h,
      signature,
    };
    this.subjects.set(scene.id, result);
    return result;
  }
  async render(
    state: RenderState,
    w: number,
    h: number,
    options: { transparent?: boolean; quality?: 'high' | 'draft'; signal?: AbortSignal } = {},
  ) {
    if (this.disposed) throw new Error('The renderer was closed.');
    options.signal?.throwIfAborted();
    this.resize(w, h);
    this.ctx.clearRect(0, 0, w, h);
    this.active = null;
    const used = new Set<string>();
    for (const layer of state.layers) {
      options.signal?.throwIfAborted();
      const { scene } = layer;
      const ctx = this.layerCtx;
      ctx.clearRect(0, 0, w, h);
      if (!options.transparent && (scene.background.kind !== 'transparent' || !state.still)) {
        ctx.fillStyle = scene.background.color;
        ctx.fillRect(0, 0, w, h);
        if (scene.background.kind === 'image' && scene.background.assetId) {
          used.add(scene.background.assetId);
          const { source, record } = await this.media.get(scene.background.assetId);
          drawFitted(
            ctx,
            source,
            record.meta.width,
            record.meta.height,
            w,
            h,
            scene.background.fit,
            scene.background.x,
            scene.background.y,
          );
        }
      }
      if (scene.kind === 'media' && scene.assetId) {
        used.add(scene.assetId);
        const record = await resolveAsset(scene.assetId);
        const { source } = await this.media.get(
          scene.assetId,
          record.meta.kind === 'video'
            ? mediaTime(scene, layer.localTime, record.meta.duration)
            : 0,
        );
        if (this.renderer) {
          const subject = this.subject(scene, record.meta);
          this.active = subject;
          this.activeTransform = { offsetX: layer.offsetX, scale: layer.scale };
          this.scene.clear();
          this.scene.add(subject.group);
          this.scene.add(this.lights);
          const pose = layer.pose;
          subject.group.rotation.set(
            THREE.MathUtils.degToRad(pose.rx),
            THREE.MathUtils.degToRad(pose.ry),
            THREE.MathUtils.degToRad(pose.rz),
            'YXZ',
          );
          // Stable scene units: resizing, rotating or changing effects never
          // recomputes a fit. Fit is an explicit editor command (fitZoom below).
          this.camera.position.set(0, 0, Math.max(1.2, 6 / pose.zoom + pose.z));
          this.camera.fov = pose.fov;
          this.camera.near = 0.08;
          this.camera.far = Math.max(18, this.camera.position.z + 8);
          this.camera.lookAt(0, 0, 0);
          this.camera.updateProjectionMatrix();
          this.camera.updateMatrixWorld();
          subject.group.position.set(pose.x * 4.8, pose.y * 3, 0);
          subject.group.updateMatrixWorld(true);
          const tex = this.texture(scene.assetId, source, record.meta.kind === 'video');
          tex.repeat.set(1, 1);
          tex.offset.set(0, 0);
          const f = scene.frame;
          if (f.fit === 'fill' || f.cropZoom > 1) {
            const mRatio = record.meta.width / record.meta.height;
            const geo = subject.screen.geometry;
            geo.computeBoundingBox();
            const box = geo.boundingBox!;
            const ratio = (box.max.x - box.min.x) / (box.max.y - box.min.y);
            const rx = Math.min(1, ratio / mRatio) / f.cropZoom,
              ry = Math.min(1, mRatio / ratio) / f.cropZoom;
            tex.repeat.set(rx, ry);
            tex.offset.set((1 - rx) * f.cropX, (1 - ry) * (1 - f.cropY));
          }
          const mat = subject.screen.material as THREE.MeshBasicMaterial;
          if (mat.map !== tex) {
            mat.map = tex;
            mat.needsUpdate = true;
          }
          const focus = this.surfacePoint(pose.focusX, pose.focusY)!;
          focus.applyMatrix4(this.camera.matrixWorldInverse);
          const uniforms = this.bokeh!.materialBokeh.uniforms;
          uniforms.focus.value = -focus.z;
          uniforms.focusWidth.value = 0.025 + (scene.focusWidth ?? 0.12) * 0.9;
          uniforms.aperture.value = scene.blur * 0.075;
          uniforms.maxblur.value = scene.blur * (0.008 + (scene.maxBlur ?? 0.7) * 0.049);
          uniforms.outputHeight.value = h;
          this.bokeh!.enabled =
            (scene.dofEnabled ?? true) && scene.blur > 0 && options.quality !== 'draft';
          this.composer!.render();
          if (this.renderer.getContext().isContextLost())
            throw new Error(
              'The GPU ran out of rendering resources. Reload the studio and try a smaller export size. Your saved project is safe.',
            );
          if (scene.shadow !== 'off')
            this.drawShadow(
              subject,
              scene,
              w,
              h,
              record.meta.kind === 'video' ? layer.localTime : 0,
            );
          ctx.drawImage(this.renderer.domElement, 0, 0, w, h);
        } else {
          const scale = 0.75 * layer.pose.zoom;
          const dw = Math.min(w, (h * record.meta.width) / record.meta.height) * scale,
            dh = (dw * record.meta.height) / record.meta.width;
          ctx.save();
          ctx.translate(w / 2 + layer.pose.x * w * 0.45, h / 2 - layer.pose.y * h * 0.45);
          ctx.rotate((-layer.pose.rz * Math.PI) / 180);
          ctx.shadowColor = `rgba(0,0,0,${scene.shadowIntensity})`;
          ctx.shadowBlur = scene.shadow === 'off' ? 0 : h * 0.025;
          ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
          ctx.restore();
        }
      }
      for (const l of scene.layers) if (l.kind === 'logo') used.add(l.assetId);
      await drawOverlays(ctx, scene, layer.localTime, w, h, this.media, state.still);
      this.ctx.save();
      this.ctx.globalAlpha = layer.opacity;
      this.ctx.translate(w / 2 + layer.offsetX * w, h / 2);
      this.ctx.scale(layer.scale, layer.scale);
      this.ctx.drawImage(this.layerCanvas, -w / 2, -h / 2);
      this.ctx.restore();
    }
    this.media.releaseUnused(used);
    for (const [id, tex] of this.textures)
      if (!used.has(id)) {
        tex.dispose();
        this.textures.delete(id);
      }
    for (const [id, s] of this.subjects)
      if (!state.layers.some((l) => l.scene.id === id)) {
        this.clearSubject(s);
        this.subjects.delete(id);
      }
    return this.canvas;
  }
  private drawShadow(subject: Subject, scene: Scene, w: number, h: number, frameTime: number) {
    const key = JSON.stringify([
      w,
      h,
      subject.signature,
      scene.assetId,
      scene.frame,
      frameTime,
      scene.shadow,
      scene.shadowIntensity,
      scene.blur,
      scene.focusWidth,
      scene.maxBlur,
      this.bokeh!.enabled,
      this.bokeh!.materialBokeh.uniforms.focus.value,
      subject.group.rotation.toArray(),
      subject.group.position.toArray(),
      this.camera.position.z,
      this.camera.fov,
    ]);
    if (key !== this.shadowKey) {
      this.shadowCanvas.width = w;
      this.shadowCanvas.height = h;
      const ctx = this.shadowCanvas.getContext('2d')!;
      // Use the rendered source alpha so transparent corners and cutouts cannot
      // acquire the rectangular backing that a projected quad would produce.
      ctx.drawImage(this.renderer!.domElement, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = `rgba(24,24,24,${scene.shadowIntensity})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      this.shadowKey = key;
    }
    const size = { small: 1, medium: 1.04, large: 1.1 }[
      scene.shadow as 'small' | 'medium' | 'large'
    ];
    const softness = { small: 0.012, medium: 0.023, large: 0.04 }[
      scene.shadow as 'small' | 'medium' | 'large'
    ];
    this.layerCtx.save();
    this.layerCtx.filter = `blur(${h * softness * Math.min(2, 6 / this.camera.position.z)}px)`;
    this.layerCtx.drawImage(
      this.shadowCanvas,
      (w * (1 - size)) / 2 + w * 0.018,
      (h * (1 - size)) / 2 + h * 0.03,
      w * size,
      h * size,
    );
    this.layerCtx.restore();
  }
  private surfacePoint(x: number, y: number): THREE.Vector3 | null {
    const screen = this.active?.screen;
    if (!screen) return null;
    screen.geometry.computeBoundingBox();
    const box = screen.geometry.boundingBox!;
    const tex = (screen.material as THREE.MeshBasicMaterial).map;
    const rx = tex?.repeat.x || 1,
      ry = tex?.repeat.y || 1;
    const u = (x - (tex?.offset.x || 0)) / rx;
    const v = (y - (1 - ry - (tex?.offset.y || 0))) / ry;
    return screen.localToWorld(
      new THREE.Vector3(
        box.min.x + (box.max.x - box.min.x) * u,
        box.max.y - (box.max.y - box.min.y) * v,
        0,
      ),
    );
  }
  projectPoint(x: number, y: number): { x: number; y: number } | null {
    const point = this.surfacePoint(x, y);
    if (!point || !this.renderer) return null;
    const view = point.clone().applyMatrix4(this.camera.matrixWorldInverse);
    if (view.z >= -this.camera.near) return null;
    point.project(this.camera);
    const { offsetX, scale } = this.activeTransform;
    return { x: (point.x / 2) * scale + 0.5 + offsetX, y: (-point.y / 2) * scale + 0.5 };
  }
  fitZoom(): number {
    if (!this.active) return 1;
    const box = new THREE.Box3().setFromObject(this.active.group);
    box.translate(this.active.group.position.clone().negate());
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * 0.82;
    let distance = 1.2;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z])
          distance = Math.max(
            distance,
            z + Math.max(Math.abs(x) / (tan * this.camera.aspect), Math.abs(y) / tan),
          );
    return clamp(6 / distance, 0.25, 4);
  }
  hitTest(x: number, y: number): { x: number; y: number } | null {
    if (!this.active || !this.renderer) return null;
    const { offsetX, scale } = this.activeTransform;
    x = (x - 0.5 - offsetX) / scale + 0.5;
    y = (y - 0.5) / scale + 0.5;
    this.ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), this.camera);
    const hit = this.ray.intersectObject(this.active.screen)[0];
    const tex = (this.active.screen.material as THREE.MeshBasicMaterial).map;
    return hit?.uv
      ? {
          x: clamp(hit.uv.x * (tex?.repeat.x || 1) + (tex?.offset.x || 0), 0, 1),
          y: clamp(1 - (hit.uv.y * (tex?.repeat.y || 1) + (tex?.offset.y || 0)), 0, 1),
        }
      : null;
  }
  dispose() {
    this.disposed = true;
    this.media.dispose();
    this.subjects.forEach((s) => this.clearSubject(s));
    this.subjects.clear();
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
    this.composer?.passes.forEach((p) => p.dispose());
    this.composer?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas.width = 1;
    this.layerCanvas.width = 1;
    this.shadowCanvas.width = 1;
  }
}
