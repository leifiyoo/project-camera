import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { Input, BufferSource, ALL_FORMATS } from 'mediabunny';
import { Group, PerspectiveCamera, Vector3, MathUtils } from 'three';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';

// This is one focused acceptance pass through the real editor and export UI.
// It intentionally does not import application internals or rewrite editor state.
await mkdir('verification', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.STUDIO_BROWSER_PATH || undefined,
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 900 },
  locale: 'en-US',
});
const page = await context.newPage();
page.setDefaultTimeout(25000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
const closePanel = async () => {
  const close = page.locator('.panel-head button');
  if (await close.count()) await close.click();
};
const fillNumber = async (name, value) => {
  const control = page.getByRole('spinbutton', { name, exact: true });
  await control.fill(String(value));
  await control.press('Tab');
};
const readProject = () =>
  page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('interface-studio', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db
          .transaction('projects')
          .objectStore('projects')
          .get(localStorage.getItem('studio-last-project'));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
const poseTransform = (pose) =>
  Object.fromEntries(
    ['x', 'y', 'z', 'rx', 'ry', 'rz', 'zoom', 'fov'].map((key) => [key, pose[key]]),
  );
const readAsset = (id) =>
  page.evaluate(async (assetId) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('interface-studio', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('assets').objectStore('assets').get(assetId);
        request.onsuccess = () => resolve(request.result?.meta);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, id);
const waitForPhoto = async (test) => {
  await expect.poll(async () => test((await readProject())?.photo), { timeout: 15000 }).toBe(true);
  return (await readProject()).photo;
};
const projectSurfacePoint = (pose, uv) => {
  const subject = new Group();
  subject.rotation.set(
    MathUtils.degToRad(pose.rx),
    MathUtils.degToRad(pose.ry),
    MathUtils.degToRad(pose.rz),
    'YXZ',
  );
  subject.position.set(pose.x * 4.8, pose.y * 3, 0);
  subject.updateMatrixWorld(true);
  const camera = new PerspectiveCamera(pose.fov, 16 / 9, 0.08, 18);
  camera.position.set(0, 0, Math.max(1.2, 6 / pose.zoom + pose.z));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const projected = new Vector3((uv.x - 0.5) * 4.8, (0.5 - uv.y) * 3, 0.04)
    .applyMatrix4(subject.matrixWorld)
    .project(camera);
  return { x: projected.x / 2 + 0.5, y: -projected.y / 2 + 0.5 };
};
const setFocus = async (point, dofEnabled) => {
  await button('Look', page.locator('.shot-sidebar')).click();
  await expect(page.getByRole('spinbutton', { name: 'Focus X', exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Focus Y', exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Depth of field', exact: true }).setChecked(dofEnabled);
  await page.getByRole('slider', { name: 'Depth blur', exact: true }).fill('85');
  const fineBlur = page
    .locator('.shot-sidebar .inspector-disclosure')
    .filter({ has: page.locator('summary', { hasText: 'Fine blur controls' }) });
  if (!(await fineBlur.getAttribute('open'))) await fineBlur.locator('summary').click();
  await page.getByRole('slider', { name: 'Focus width', exact: true }).fill('10');
  await page.getByRole('slider', { name: 'Blur limit', exact: true }).fill('70');
  await button('MF · Click to focus').click();
  await expect(page.locator('.panel')).toHaveCount(0);
  const beforeClick = await waitForPhoto(
    (photo) =>
      photo &&
      photo.dofEnabled === dofEnabled &&
      photo.blur === 0.85 &&
      photo.maxBlur === 0.7 &&
      !photo.pose.autoFocus,
  );
  const projected = projectSurfacePoint(beforeClick.pose, point);
  expect(projected.x).toBeGreaterThan(0);
  expect(projected.x).toBeLessThan(1);
  expect(projected.y).toBeGreaterThan(0);
  expect(projected.y).toBeLessThan(1);
  const bounds = await page.getByLabel('Composition preview', { exact: true }).boundingBox();
  await page.mouse.click(
    bounds.x + projected.x * bounds.width,
    bounds.y + projected.y * bounds.height,
  );
  return await waitForPhoto(
    (photo) =>
      photo &&
      photo.blur === 0.85 &&
      photo.dofEnabled === dofEnabled &&
      photo.focusWidth === 0.1 &&
      photo.maxBlur === 0.7 &&
      !photo.pose.autoFocus &&
      Math.abs(photo.pose.focusX - point.x) < 0.001 &&
      Math.abs(photo.pose.focusY - point.y) < 0.001,
  );
};
const uploadPhoto = async (path) => {
  const previousId = (await readProject())?.photo.assetId;
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.topbar').getByRole('button', { name: 'Upload photo', exact: true }).click();
  await (await chooser).setFiles(path);
  await expect(page.locator('.toast')).toContainText('1 file imported.');
  await expect(page.locator('.import-status')).toHaveCount(0);
  return await waitForPhoto((photo) => photo && photo.assetId !== previousId);
};
const exportFile = async (kind, pathOrStem, longestEdge) => {
  await button('Export').click();
  const dialog = page.locator('.export-dialog');
  await dialog.getByLabel('Resolution', { exact: true }).selectOption('custom');
  await fillNumber('Longest edge', longestEdge);
  if (kind === 'video') {
    await dialog.getByLabel('Frame rate', { exact: true }).selectOption('30');
    await dialog.getByLabel('Container', { exact: true }).selectOption('auto');
  }
  const action = button(kind === 'png' ? 'Export image' : 'Export video', dialog);
  await expect(action).toBeEnabled({ timeout: 25000 });
  const event = page.waitForEvent('download', { timeout: 180000 });
  await action.click();
  const downloaded = await event;
  const suggested = downloaded.suggestedFilename();
  const extension = suggested.split('.').at(-1);
  if (kind === 'video') expect(extension).toMatch(/^(mp4|webm)$/);
  const path = kind === 'png' ? pathOrStem : `${pathOrStem}.${extension}`;
  await downloaded.saveAs(path);
  return { path, suggested, extension };
};
const imageDetails = async (path) => {
  const image = sharp(path);
  const metadata = await image.metadata();
  const stats = await image.stats();
  expect(metadata.width).toBe(1280);
  expect(metadata.height).toBe(720);
  expect(Math.max(...stats.channels.slice(0, 3).map((channel) => channel.stdev))).toBeGreaterThan(
    1,
  );
  return {
    width: metadata.width,
    height: metadata.height,
    channels: stats.channels.map(({ min, max, mean, stdev }) => ({ min, max, mean, stdev })),
  };
};
const imageDifference = async (first, second) => {
  const options = { width: 1280, height: 720, fit: 'fill' };
  const a = await sharp(first).resize(options).removeAlpha().raw().toBuffer();
  const b = await sharp(second).resize(options).removeAlpha().raw().toBuffer();
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
};
// Optional image-space rectangles allow a reviewer to measure focus regions
// after inspecting the actual projection. No guessed regions claim DOF success.
const regionSharpness = async (path) => {
  if (!process.env.MACRO_PROBES) return null;
  const regions = JSON.parse(process.env.MACRO_PROBES);
  const result = {};
  for (const [name, region] of Object.entries(regions)) {
    const { data, info } = await sharp(path)
      .extract(region)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let gradient = 0;
    let samples = 0;
    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const i = y * info.width + x;
        gradient +=
          Math.abs(data[i + 1] - data[i - 1]) +
          Math.abs(data[i + info.width] - data[i - info.width]);
        samples++;
      }
    }
    result[name] = gradient / samples;
  }
  return result;
};

try {
  await page.goto(process.env.STUDIO_URL || 'http://localhost:3000');
  await page.waitForSelector('canvas');
  if (await button('Got it').isVisible()) await button('Got it').click();
  await page.locator('.project-trigger').click();
  await button('New project').click();
  await page.locator('.project-trigger').click();
  await page.getByLabel('Project name', { exact: true }).fill('Signature Macro acceptance');
  await closePanel();
  await button('PHOTO').click();
  await uploadPhoto('public/demos/servers-dashboard.png');
  await button('Apply Signature Macro').click();
  await closePanel();
  const beforeReplacement = await waitForPhoto(
    (photo) => photo && photo.pose.rx === 25 && photo.pose.ry === 35 && photo.pose.zoom === 1.55,
  );
  const replacement = await uploadPhoto('public/demos/servers-dashboard.png');
  expect(replacement.name).toBe('servers-dashboard');
  expect(replacement.pose).toEqual(beforeReplacement.pose);
  for (const property of [
    'frame',
    'background',
    'dofEnabled',
    'blur',
    'focusWidth',
    'maxBlur',
    'shadow',
    'shadowIntensity',
    'layers',
    'keyframes',
  ])
    expect(replacement[property]).toEqual(beforeReplacement[property]);
  const leftPoint = { x: 0.2375, y: 0.312 };
  const rightPoint = { x: 0.6825, y: 0.312 };
  const sharpScene = await setFocus(leftPoint, false);
  const selectedDocument = await readProject();
  expect(selectedDocument.name).toBe('Signature Macro acceptance');
  expect(await page.evaluate(() => localStorage.getItem('studio-last-project'))).toBe(
    selectedDocument.id,
  );
  const transform = poseTransform(sharpScene.pose);
  const sourceId = sharpScene.assetId;
  const importedAsset = await readAsset(sourceId);
  expect(importedAsset.name).toBe('servers-dashboard.png');
  expect(importedAsset.width).toBe(1600);
  expect(importedAsset.height).toBe(1000);
  const sharpExport = await exportFile('png', 'verification/macro-sharp.png', 1280);
  const sharpDetails = await imageDetails(sharpExport.path);
  await button('Close export').click();
  console.log('Native sharp Macro PNG exported', transform);

  const leftScene = await setFocus(leftPoint, true);
  expect(poseTransform(leftScene.pose)).toEqual(transform);
  expect(leftScene.assetId).toBe(sourceId);
  const leftExport = await exportFile('png', 'verification/macro-focus-left.png', 1280);
  const leftDetails = await imageDetails(leftExport.path);
  await copyFile(leftExport.path, 'verification/signature-macro.png');
  await button('Close export').click();
  await page.screenshot({ path: 'verification/macro-editor.png' });

  const rightScene = await setFocus(rightPoint, true);
  expect(poseTransform(rightScene.pose)).toEqual(transform);
  expect(rightScene.assetId).toBe(sourceId);
  const rightExport = await exportFile('png', 'verification/macro-focus-right.png', 1280);
  const rightDetails = await imageDetails(rightExport.path);
  await button('Close export').click();
  const differences = {
    sharpVsLeft: await imageDifference(sharpExport.path, leftExport.path),
    sharpVsRight: await imageDifference(sharpExport.path, rightExport.path),
    leftVsRight: await imageDifference(leftExport.path, rightExport.path),
  };
  // These guards only establish that controls alter the rendered image. Spatial
  // sharpness and the photographic result still require inspecting the files.
  for (const difference of Object.values(differences)) expect(difference).toBeGreaterThan(0);
  console.log('Focus comparison exported', differences);

  await page.setViewportSize({ width: 1060, height: 820 });
  expect(poseTransform((await readProject()).photo.pose)).toEqual(transform);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.waitForSelector('canvas');
  await expect(page.locator('.project-trigger')).toContainText('Signature Macro acceptance');
  await button('PHOTO').click();
  const restored = await waitForPhoto((photo) => photo && photo.assetId === sourceId);
  expect(poseTransform(restored.pose)).toEqual(transform);
  expect(Math.abs(restored.pose.focusX - rightPoint.x)).toBeLessThan(0.001);
  expect(Math.abs(restored.pose.focusY - rightPoint.y)).toBeLessThan(0.001);
  expect(restored.blur).toBe(0.85);
  console.log(
    'Manual composition and source UV focus retained through sliders, resize and reload.',
  );

  await setFocus(leftPoint, true);
  await button('Compose').click();
  await button('Macro Glide').click();
  await button('Create motion scene').click();
  await closePanel();
  // A fresh project's original scene precedes the composed one. Remove that
  // initial scene with the normal timeline control, keeping the composed shot.
  const clips = () => page.getByRole('button', { name: /^Select scene \d+:/ });
  await expect(clips()).toHaveCount(2);
  while ((await clips().count()) > 1) {
    await clips().first().click();
    await button('Delete selected scene').click();
  }
  await clips().first().click();
  await button('Go to beginning').click();
  await expect
    .poll(async () => {
      const project = await readProject();
      return (
        project.scenes.length === 1 &&
        project.scenes[0].assetId === sourceId &&
        project.scenes[0].keyframes.length >= 3
      );
    })
    .toBe(true);
  const composed = (await readProject()).scenes[0];
  expect(composed.assetId).toBe(sourceId);
  expect(composed.duration).toBeGreaterThanOrEqual(4);
  expect(composed.duration).toBeLessThanOrEqual(6);
  expect(composed.keyframes.length).toBeGreaterThanOrEqual(3);
  expect(poseTransform(composed.keyframes[0].pose)).not.toEqual(
    poseTransform(composed.keyframes.at(-1).pose),
  );
  await page.screenshot({ path: 'verification/macro-glide-editor.png' });
  const videoExport = await exportFile('video', 'verification/macro-glide', 960);
  const playback = await page.locator('.export-result video').evaluate(async (video) => {
    if (video.readyState < 2)
      await new Promise((resolve, reject) => {
        video.addEventListener('loadeddata', resolve, { once: true });
        video.addEventListener('error', reject, { once: true });
      });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    const frames = [];
    const times = [0.4, video.duration / 2, video.duration - 0.4];
    video.pause();
    for (const time of times) {
      // Chromium may emit seeked before a decoded frame is presented. Wait for
      // the matching video frame, rather than reading an empty canvas then.
      const presented = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Decoded video frame timed out')), 10000);
        const frame = (_now, metadata) => {
          if (Math.abs(metadata.mediaTime - time) < 0.06) {
            clearTimeout(timer);
            resolve();
          } else video.requestVideoFrameCallback(frame);
        };
        video.requestVideoFrameCallback(frame);
      });
      const done = new Promise((resolve, reject) => {
        video.addEventListener('seeked', resolve, { once: true });
        setTimeout(() => reject(new Error('Exported video seek timed out')), 10000);
      });
      video.currentTime = time;
      await done;
      await presented;
      ctx.drawImage(video, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let min = 255;
      let max = 0;
      for (let i = 0; i < data.length; i += 4) {
        min = Math.min(min, data[i], data[i + 1], data[i + 2]);
        max = Math.max(max, data[i], data[i + 1], data[i + 2]);
      }
      frames.push({ time, min, max, png: canvas.toDataURL('image/png') });
    }
    video.currentTime = 0.4;
    await new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 200));
    video.pause();
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
      playingAdvancedTo: video.currentTime,
      frames,
    };
  });
  expect(playback.width).toBe(960);
  expect(playback.height).toBe(540);
  expect(playback.duration).toBeCloseTo(composed.duration, 1);
  expect(playback.playingAdvancedTo).toBeGreaterThan(0.4);
  for (const [index, frame] of playback.frames.entries()) {
    const path = `verification/macro-glide-frame-${index + 1}.png`;
    await writeFile(path, Buffer.from(frame.png.split(',')[1], 'base64'));
    expect(frame.max - frame.min).toBeGreaterThan(10);
    delete frame.png;
    frame.path = path;
  }
  const motionDifference = await imageDifference(
    playback.frames[0].path,
    playback.frames.at(-1).path,
  );
  expect(motionDifference).toBeGreaterThan(0);
  const input = new Input({
    source: new BufferSource(new Uint8Array(await readFile(videoExport.path))),
    formats: ALL_FORMATS,
  });
  let audioTracks;
  try {
    audioTracks = (await input.getAudioTracks()).length;
    expect(audioTracks).toBe(0);
  } finally {
    input.dispose();
  }
  await page.screenshot({ path: 'verification/macro-video-preview.png' });
  await button('Close export').click();
  await page.locator('.project-trigger').click();
  const packageEvent = page.waitForEvent('download');
  await button('Download project package').click();
  await (await packageEvent).saveAs('verification/signature-macro.studio.zip');
  await closePanel();
  const responsive = [];
  for (const mode of ['PHOTO', 'VIDEO']) {
    await button(mode).click();
    for (const width of [768, 540]) {
      await page.setViewportSize({ width, height: 800 });
      const bounds = await page.evaluate(() => {
        const header = document.querySelector('.topbar');
        const controls = Array.from(header.querySelectorAll('button'))
          .filter((control) => control.getClientRects().length > 0)
          .map((control) => ({
            name: control.getAttribute('aria-label') || control.textContent.trim(),
            ...Object.fromEntries(
              ['left', 'right', 'top', 'bottom'].map((key) => [
                key,
                control.getBoundingClientRect()[key],
              ]),
            ),
          }));
        const overlaps = [];
        for (let i = 0; i < controls.length; i++) {
          for (let j = i + 1; j < controls.length; j++) {
            const a = controls[i];
            const b = controls[j];
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
            )
              overlaps.push([a.name, b.name]);
          }
        }
        return {
          viewport: innerWidth,
          bodyWidth: document.body.scrollWidth,
          headerWidth: header.clientWidth,
          headerScrollWidth: header.scrollWidth,
          overflowingControls: controls.filter(
            (control) => control.left < 0 || control.right > innerWidth,
          ),
          overlaps,
        };
      });
      await page.screenshot({ path: `verification/macro-${mode.toLowerCase()}-${width}.png` });
      responsive.push({ mode, ...bounds });
      expect(bounds.bodyWidth).toBeLessThanOrEqual(bounds.viewport);
      expect(bounds.overlaps).toEqual([]);
      expect(bounds.overflowingControls).toEqual([]);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  console.log('Narrow header bounds', responsive);
  expect(errors).toEqual([]);
  const report = {
    source: {
      path: 'public/demos/servers-dashboard.png',
      width: 1600,
      height: 1000,
      originalUnwarped: true,
    },
    camera: transform,
    focus: {
      leftPoint,
      rightPoint,
      actualLeft: { x: leftScene.pose.focusX, y: leftScene.pose.focusY },
      actualRight: { x: rightScene.pose.focusX, y: rightScene.pose.focusY },
      blur: 0.85,
      focusWidth: 0.1,
      maxBlur: 0.7,
      manualClick: true,
      uvNumberFields: false,
    },
    photo: {
      sharp: {
        path: sharpExport.path,
        ...sharpDetails,
        dofEnabled: false,
        regionalSharpness: await regionSharpness(sharpExport.path),
      },
      left: {
        path: leftExport.path,
        ...leftDetails,
        dofEnabled: true,
        regionalSharpness: await regionSharpness(leftExport.path),
      },
      right: {
        path: rightExport.path,
        ...rightDetails,
        dofEnabled: true,
        regionalSharpness: await regionSharpness(rightExport.path),
      },
      differences,
      best: 'verification/signature-macro.png',
    },
    compositionRetained: { slider: true, resize: true, reload: true },
    photoUploadPreservesComposition: true,
    video: { path: videoExport.path, ...playback, motionDifference, audioTracks },
    projectPackage: 'verification/signature-macro.studio.zip',
    responsive,
    errors,
  };
  await writeFile('verification/macro-report.json', JSON.stringify(report, null, 2));
  console.log('Macro acceptance pass finished', {
    photo: report.photo.best,
    video: videoExport.path,
    duration: playback.duration,
    motionDifference,
    audioTracks,
    errors,
  });
} catch (error) {
  console.error('Persisted document at failure', JSON.stringify(await readProject(), null, 2));
  await page.screenshot({ path: 'verification/macro-verification-failure.png' });
  throw error;
} finally {
  await browser.close();
}
