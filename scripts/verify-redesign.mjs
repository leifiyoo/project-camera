import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { Input, BufferSource, ALL_FORMATS } from 'mediabunny';
import { Group, PerspectiveCamera, Vector3, MathUtils } from 'three';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

await mkdir('verification', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.STUDIO_BROWSER_PATH || undefined,
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
});
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
const sidebar = page.getByRole('complementary', { name: 'Shot controls' });
const summary = (name, scope = page) => scope.locator('summary').filter({ hasText: name });
const closePanel = async () => {
  if (await page.locator('.panel-head button').count())
    await page.locator('.panel-head button').click();
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
const photoWhen = async (predicate) => {
  await expect
    .poll(async () => predicate((await readProject())?.photo), { timeout: 15000 })
    .toBe(true);
  return (await readProject()).photo;
};
const transform = (pose) =>
  Object.fromEntries(
    ['x', 'y', 'z', 'rx', 'ry', 'rz', 'zoom', 'fov'].map((key) => [key, pose[key]]),
  );
const previewReady = async () => {
  await expect(page.getByLabel('Composition preview', { exact: true })).toBeVisible();
  await expect(page.locator('.stage-loading')).toHaveCount(0);
};
const fillNumber = async (name, value, scope = page) => {
  const input = scope.getByRole('spinbutton', { name, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
};
const uploadPhoto = async (file) => {
  const previous = (await readProject())?.photo.assetId;
  const chooser = page.waitForEvent('filechooser');
  await button('Upload photo').click();
  await (await chooser).setFiles(file);
  await expect(page.locator('.toast')).toContainText('1 file imported.');
  await expect(page.locator('.import-status')).toHaveCount(0);
  const photo = await photoWhen((item) => item && item.assetId !== previous);
  await previewReady();
  return photo;
};
const focusClick = async (pose, point) => {
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
  const projected = new Vector3((point.x - 0.5) * 4.8, (0.5 - point.y) * 3, 0.04)
    .applyMatrix4(subject.matrixWorld)
    .project(camera);
  await button('MF · Click to focus', sidebar).click();
  const bounds = await page.getByLabel('Composition preview', { exact: true }).boundingBox();
  await page.mouse.click(
    bounds.x + (projected.x / 2 + 0.5) * bounds.width,
    bounds.y + (-projected.y / 2 + 0.5) * bounds.height,
  );
  return await photoWhen(
    (item) =>
      item &&
      !item.pose.autoFocus &&
      Math.abs(item.pose.focusX - point.x) < 0.001 &&
      Math.abs(item.pose.focusY - point.y) < 0.001,
  );
};
const exportFile = async (kind, stem, edge) => {
  await button('Export').click();
  const dialog = page.locator('.export-dialog');
  await expect(button('Close export', dialog)).toBeFocused();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press(i < 7 ? 'Tab' : 'Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.export-dialog'))).toBe(
      true,
    );
  }
  await dialog.getByLabel('Resolution', { exact: true }).selectOption('custom');
  await fillNumber('Longest edge', edge, dialog);
  if (kind === 'video') await dialog.getByLabel('Frame rate', { exact: true }).selectOption('30');
  const action = button(kind === 'png' ? 'Export image' : 'Export video', dialog);
  await expect(action).toBeEnabled();
  const waiting = page.waitForEvent('download', { timeout: 180000 });
  await action.click();
  const download = await waiting;
  const extension = download.suggestedFilename().split('.').at(-1);
  expect(extension).toMatch(kind === 'png' ? /^png$/ : /^(mp4|webm)$/);
  const path = `${stem}.${extension}`;
  await download.saveAs(path);
  return path;
};
const layout = () =>
  page.evaluate(() => {
    const header = document.querySelector('.topbar');
    const controls = Array.from(header.querySelectorAll('button, summary'))
      .filter((item) => item.getClientRects().length > 0)
      .map((item) => ({
        name: item.getAttribute('aria-label') || item.textContent.trim(),
        ...Object.fromEntries(
          ['left', 'right', 'top', 'bottom'].map((key) => [key, item.getBoundingClientRect()[key]]),
        ),
      }));
    const overlaps = [];
    for (let i = 0; i < controls.length; i++)
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i],
          b = controls[j];
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        )
          overlaps.push([a.name, b.name]);
      }
    const preview = document.querySelector('.artboard').getBoundingClientRect();
    const panel = document.querySelector('.shot-sidebar').getBoundingClientRect();
    const timeline = document.querySelector('.timeline')?.getBoundingClientRect();
    return {
      viewport: innerWidth,
      pageWidth: document.body.scrollWidth,
      headerOverlaps: overlaps,
      overflowingControls: controls.filter((item) => item.left < 0 || item.right > innerWidth),
      preview: {
        left: preview.left,
        right: preview.right,
        top: preview.top,
        bottom: preview.bottom,
      },
      sidebar: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom },
      timeline: timeline ? { top: timeline.top, bottom: timeline.bottom } : null,
      theme: document.documentElement.dataset.theme,
    };
  });
const layouts = [];
const checkLayouts = async (mode, theme) => {
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => scrollTo(0, 0));
    const bounds = await layout();
    layouts.push({ mode, theme, ...bounds });
    console.log('Layout', mode, theme, width, JSON.stringify(bounds));
    await page.screenshot({
      path: `verification/redesign-${mode}-${theme}-${width}.png`,
      fullPage: width < 900,
    });
    expect(bounds.pageWidth).toBeLessThanOrEqual(width);
    expect(bounds.headerOverlaps).toEqual([]);
    expect(bounds.overflowingControls).toEqual([]);
    expect(bounds.preview.left).toBeGreaterThanOrEqual(0);
    expect(bounds.preview.right).toBeLessThanOrEqual(width);
    if (width > 900) expect(bounds.preview.right).toBeLessThanOrEqual(bounds.sidebar.left);
    else expect(bounds.preview.bottom).toBeLessThanOrEqual(bounds.sidebar.top);
    if (bounds.timeline) expect(bounds.preview.bottom).toBeLessThanOrEqual(bounds.timeline.top);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(() => scrollTo(0, 0));
};
const settleTransitions = () =>
  page.evaluate(async () => {
    await Promise.race([
      Promise.allSettled(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished),
      ),
      new Promise((resolve) => setTimeout(resolve, 400)),
    ]);
  });
const verifyInteractions = async () => {
  await uploadPhoto('public/demos/servers-dashboard.png');
  await button('Apply Signature Macro', sidebar).click();
  const macro = await photoWhen((item) => item && item.pose.zoom === 1.55 && item.pose.rx === 25);
  const pointsBefore = macro.points.length;
  const mark = button('Mark point or area for Compose');
  await mark.click();
  await expect(mark).toHaveAttribute('aria-pressed', 'true');
  const focused = await focusClick(macro.pose, { x: 0.2375, y: 0.312 });
  expect(focused.points.length).toBe(pointsBefore);
  await expect(mark).toHaveAttribute('aria-pressed', 'false');
  await expect(button('Move surface or selected layer')).toHaveAttribute('aria-pressed', 'true');
  await button('VIDEO').click();
  await button('Camera', sidebar).click();
  const optics = summary('Camera position & optics', sidebar);
  await optics.focus();
  await page.keyboard.press('Space');
  await expect(optics.locator('..')).toHaveAttribute('open', '');
  await expect(button('Play')).toBeVisible();
  await expect(button('Pause')).toHaveCount(0);
  await button('Play').focus();
  await page.keyboard.press('Space');
  await expect(button('Pause')).toBeVisible();
  await button('Pause').focus();
  await page.keyboard.press('Space');
  await expect(button('Play')).toBeVisible();
  await button('Look', sidebar).click();
  await checkLayouts('video', 'light');
  const clips = await page.locator('.scene-clip').evaluateAll((items) => {
    const timeline = document.querySelector('.timeline').getBoundingClientRect();
    return items.map((item) => ({
      clipBottom: item.getBoundingClientRect().bottom,
      timelineBottom: timeline.bottom,
    }));
  });
  for (const bounds of clips) expect(bounds.clipBottom).toBeLessThanOrEqual(bounds.timelineBottom);
  await page.setViewportSize({ width: 390, height: 960 });
  const mobileTimeline = await page.evaluate(() => {
    const timeline = document.querySelector('.timeline').getBoundingClientRect();
    const items = [...document.querySelectorAll('.timeline .scene-clip, .timeline .key-dot')].map(
      (item) => ({
        name: item.getAttribute('aria-label') || item.className,
        bottom: item.getBoundingClientRect().bottom,
        timelineBottom: timeline.bottom,
      }),
    );
    return items;
  });
  for (const bounds of mobileTimeline)
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.timelineBottom);
  await page.screenshot({
    path: 'verification/redesign-mobile-timeline-final.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await button('PHOTO').click();
  await button('Look', sidebar).click();
  await page.locator('.shot-more').click();
  const panel = page.locator('.panel');
  await button('Camera', panel).click();
  let visitedSummary = false;
  for (let index = 0; index < 25; index++) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => ({
      contained: !!document.activeElement?.closest('.panel'),
      visible: document.activeElement?.getClientRects().length > 0,
      summary: document.activeElement?.tagName === 'SUMMARY',
    }));
    expect(active.contained).toBe(true);
    expect(active.visible).toBe(true);
    visitedSummary ||= active.summary;
  }
  expect(visitedSummary).toBe(true);
  await closePanel();
  await button('Apply Signature Macro', sidebar).click();
  const toast = page.locator('.toast');
  await expect(toast).toContainText('Signature Macro applied.');
  const toastStyle = await toast.evaluate((item) => ({
    left: item.getBoundingClientRect().left,
    right: item.getBoundingClientRect().right,
    padding: parseFloat(getComputedStyle(item).paddingLeft),
    background: getComputedStyle(item).backgroundColor,
  }));
  expect(toastStyle.left).toBeGreaterThan(10);
  expect(toastStyle.right).toBeLessThan(1430);
  expect(toastStyle.padding).toBeGreaterThanOrEqual(10);
  expect(toastStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  await settleTransitions();
  await page.screenshot({ path: 'verification/redesign-toast-final.png' });
  console.log('Styled toast and legacy panel keyboard checks passed.');
  await button('Dismiss message').click();
  await expect(toast).toHaveCount(0);
  await page.getByLabel('Workspace options', { exact: true }).click();
  await button('Switch to dark mode').click();
  await page.getByLabel('Workspace options', { exact: true }).click();
  console.log('Dark mode selected; settling color transitions.');
  await settleTransitions();
  await page.screenshot({ path: 'verification/redesign-dark-desktop-settled.png', timeout: 15000 });
  await page.setViewportSize({ width: 390, height: 960 });
  await page.evaluate(() => scrollTo(0, 0));
  await settleTransitions();
  await page.screenshot({ path: 'verification/redesign-dark-mobile-final.png', fullPage: true });
  expect(errors).toEqual([]);
  const report = {
    nativeSummarySpace: true,
    buttonSpace: true,
    markThenManualFocus: true,
    pointCountPreserved: true,
    focusedUv: { x: focused.pose.focusX, y: focused.pose.focusY },
    panelTabVisibleAndSummary: true,
    mobileTimeline,
    styledToast: toastStyle,
    settledDark: true,
    layouts,
    errors,
  };
  await writeFile('verification/redesign-interaction-report.json', JSON.stringify(report, null, 2));
  console.log('Targeted redesign interaction checks passed.', report);
};

try {
  await page.goto(process.env.STUDIO_URL || 'http://localhost:3000/');
  await previewReady();
  await expect(sidebar).toBeVisible();
  await expect(page.locator('.dock')).toHaveCount(0);
  if (process.argv.includes('--ui-only')) {
    await verifyInteractions();
  } else {
    await page.screenshot({ path: 'verification/redesign-desktop-look.png' });
    console.log('Initial redesigned workspace ready.');
    await button('Projects').click();
    await button('New project').click();
    await button('Projects').click();
    await page.getByLabel('Project name', { exact: true }).fill('Redesign check');
    await closePanel();
    const initial = (await readProject()).photo;
    const uploaded = await uploadPhoto('public/demos/servers-dashboard.png');
    expect(uploaded.pose).toEqual(initial.pose);
    expect(uploaded.name).toBe('servers-dashboard');
    await expect(sidebar.locator('.shot-source')).toContainText('1600 × 1000');
    await button('Apply Signature Macro', sidebar).click();
    const macro = await photoWhen((item) => item && item.pose.zoom === 1.55 && item.pose.rx === 25);
    await button('Apply Clean Front', sidebar).click();
    await photoWhen((item) => item && item.pose.rx === 0 && item.pose.ry === 0);
    await button('Undo · Ctrl / ⌘ Z').click();
    await photoWhen((item) => item && JSON.stringify(item.pose) === JSON.stringify(macro.pose));
    await expect(sidebar.getByRole('slider', { name: 'Depth blur', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('slider', { name: 'Focus width', exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('slider', { name: 'Blur limit', exact: true })).toHaveCount(0);
    await sidebar.getByRole('slider', { name: 'Depth blur', exact: true }).fill('85');
    await summary('Fine blur controls', sidebar).click();
    await sidebar.getByRole('slider', { name: 'Focus width', exact: true }).fill('10');
    await sidebar.getByRole('slider', { name: 'Blur limit', exact: true }).fill('70');
    await summary('Fine blur controls', sidebar).click();
    await sidebar.getByRole('checkbox', { name: 'Depth of field', exact: true }).uncheck();
    await photoWhen(
      (item) => item && !item.dofEnabled && item.blur === 0.85 && item.focusWidth === 0.1,
    );
    await sidebar.getByRole('checkbox', { name: 'Depth of field', exact: true }).check();
    const focused = await focusClick(macro.pose, { x: 0.2375, y: 0.312 });
    expect(transform(focused.pose)).toEqual(transform(macro.pose));
    await page.screenshot({ path: 'verification/redesign-macro-look.png' });
    await button('Camera', sidebar).click();
    await expect(sidebar.getByRole('slider', { name: 'X rotation', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('slider', { name: 'Field of view', exact: true })).toHaveCount(
      0,
    );
    await sidebar.getByRole('slider', { name: 'Y rotation', exact: true }).fill('30');
    await photoWhen((item) => item && item.pose.ry === 30);
    await sidebar.getByRole('slider', { name: 'Y rotation', exact: true }).fill('35');
    await summary('Camera position & optics', sidebar).click();
    await expect(sidebar.getByRole('slider', { name: 'Field of view', exact: true })).toBeVisible();
    await page.screenshot({ path: 'verification/redesign-desktop-camera.png' });
    await summary('Camera position & optics', sidebar).click();
    await button('Canvas', sidebar).click();
    await summary('Frame & device', sidebar).click();
    await button('Phone', sidebar).click();
    await photoWhen((item) => item && item.frame.kind === 'phone');
    await button('Plain', sidebar).click();
    await photoWhen((item) => item && item.frame.kind === 'plain' && item.pose.ry === 35);
    await page.screenshot({ path: 'verification/redesign-desktop-canvas.png' });
    await button('Look', sidebar).click();
    const photoPath = await exportFile('png', 'verification/redesign-photo', 1280);
    const photoMetadata = await sharp(photoPath).metadata();
    expect(photoMetadata.width).toBe(1280);
    expect(photoMetadata.height).toBe(720);
    const photoStats = await sharp(photoPath).stats();
    expect(photoStats.channels[0].stdev).toBeGreaterThan(5);
    await button('Close export').click();
    await expect(button('Export')).toBeFocused();
    const saved = (await readProject()).photo;
    await page.reload();
    await previewReady();
    await expect(page.locator('.project-trigger')).toContainText('Redesign check');
    const restored = (await readProject()).photo;
    expect(restored.pose).toEqual(saved.pose);
    expect(restored.blur).toBe(0.85);
    await checkLayouts('photo', 'light');
    await page.getByLabel('Workspace options', { exact: true }).click();
    await button('Switch to dark mode').click();
    await page.getByLabel('Workspace options', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await checkLayouts('photo', 'dark');
    await page.getByLabel('Workspace options', { exact: true }).click();
    await button('Switch to light mode').click();
    await page.getByLabel('Workspace options', { exact: true }).click();
    await button('Compose').click();
    await button('Macro Glide').click();
    await button('Create motion scene').click();
    const clips = page.getByRole('button', { name: /^Select scene \d+:/ });
    await expect(clips).toHaveCount(2);
    await clips.first().click();
    await button('Delete selected scene').click();
    await expect(clips).toHaveCount(1);
    await clips.first().click();
    await expect.poll(async () => (await readProject()).scenes[0].keyframes.length).toBe(3);
    await button('Go to beginning').click();
    await button('Play').click();
    await expect(button('Pause')).toBeVisible();
    await page.waitForTimeout(350);
    await button('Pause').click();
    await checkLayouts('video', 'light');
    const videoPath = await exportFile('video', 'verification/redesign-motion', 960);
    const playback = await page.locator('.export-result video').evaluate(async (video) => {
      if (video.readyState < 2)
        await new Promise((resolve) =>
          video.addEventListener('loadeddata', resolve, { once: true }),
        );
      const time = 2;
      const presented = new Promise((resolve) => {
        const frame = (_now, metadata) =>
          Math.abs(metadata.mediaTime - time) < 0.06
            ? resolve()
            : video.requestVideoFrameCallback(frame);
        video.requestVideoFrameCallback(frame);
      });
      const seeked = new Promise((resolve) =>
        video.addEventListener('seeked', resolve, { once: true }),
      );
      video.currentTime = time;
      await seeked;
      await presented;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let min = 255,
        max = 0;
      for (let i = 0; i < data.length; i += 4) {
        min = Math.min(min, data[i], data[i + 1], data[i + 2]);
        max = Math.max(max, data[i], data[i + 1], data[i + 2]);
      }
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 200));
      video.pause();
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        min,
        max,
        time: video.currentTime,
        png: canvas.toDataURL(),
      };
    });
    expect(playback.width).toBe(960);
    expect(playback.height).toBe(540);
    expect(playback.duration).toBeCloseTo(4, 1);
    expect(playback.max - playback.min).toBeGreaterThan(10);
    expect(playback.time).toBeGreaterThan(2);
    await writeFile(
      'verification/redesign-motion-frame.png',
      Buffer.from(playback.png.split(',')[1], 'base64'),
    );
    delete playback.png;
    const input = new Input({
      source: new BufferSource(new Uint8Array(await readFile(videoPath))),
      formats: ALL_FORMATS,
    });
    const audioTracks = (await input.getAudioTracks()).length;
    input.dispose();
    expect(audioTracks).toBe(0);
    await button('Close export').click();
    expect(errors).toEqual([]);
    await writeFile(
      'verification/redesign-report.json',
      JSON.stringify(
        {
          photo: { path: photoPath, width: photoMetadata.width, height: photoMetadata.height },
          video: { path: videoPath, ...playback, audioTracks },
          directImportPreservedCamera: true,
          presetUndo: true,
          manualClickFocus: focused.pose,
          advancedDisclosure: true,
          cameraAndCanvasControls: true,
          modalKeyboardFocus: true,
          reload: true,
          layouts,
          errors,
        },
        null,
        2,
      ),
    );
    console.log('Redesign verification completed.', { photoPath, videoPath, playback, errors });
  }
} catch (error) {
  await page.screenshot({ path: 'verification/redesign-failure.png', fullPage: true });
  console.error('Persisted document', JSON.stringify(await readProject(), null, 2));
  throw error;
} finally {
  await browser.close();
}
