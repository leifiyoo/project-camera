import { chromium, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('verification', { recursive: true });
await writeFile(
  'verification/logo.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="38" fill="#ffdc32"/><path d="M 42 114 V 46 H 118 V 63 H 63 V 80 H 108 V 97 H 63 V 114 Z" fill="#17181b"/></svg>',
);

import sharp from 'sharp';
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
await page.goto(process.env.STUDIO_URL || 'http://localhost:3000');
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const button = (name) =>
  (name === 'Export video' ? page.getByRole('dialog') : page).getByRole('button', {
    name,
    exact: true,
  });
const choose = async (name, file) => {
  const event = page.waitForEvent('filechooser');
  await button(name).click();
  await (await event).setFiles(file);
  await expect(page.locator('.import-status')).toHaveCount(0, { timeout: 20000 });
};
const closePanel = async () => {
  const b = page.locator('.panel-head button');
  if (await b.count()) await b.click();
};
const downloaded = async (name, path, timeout = 120000) => {
  const event = page.waitForEvent('download', { timeout });
  await button(name).click();
  const file = await event;
  await file.saveAs(path);
  return file;
};
try {
  await page.waitForSelector('canvas');
  if (await button('Got it').isVisible()) await button('Got it').click();
  console.log('Demo ready');
  await page.locator('.project-trigger').click();
  await button('New project').click();
  await page.locator('.project-trigger').click();
  await page.getByLabel('Project name', { exact: true }).fill('Flow check');
  await closePanel();
  await button('PHOTO').click();
  await choose('Upload photo', 'public/demos/pace-mobile.png');
  await closePanel();
  await expect(page.locator('.import-status')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('1 file imported.');
  await page.locator('.shot-sidebar').getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.locator('.shot-sidebar summary', { hasText: 'Frame & device' }).click();
  for (const frame of ['Phone', 'Laptop', 'Monitor', 'Plain']) {
    await button(frame).click();
    await page.screenshot({ path: `verification/frame-${frame.toLowerCase()}.png` });
  }
  await button('Phone').click();
  await closePanel();
  await page.locator('.shot-sidebar').getByRole('button', { name: 'Camera', exact: true }).click();
  await page.getByRole('slider', { name: 'Y rotation', exact: true }).fill('-18');
  await page.getByRole('slider', { name: 'Y rotation', exact: true }).press('Tab');
  await button('Layers and scene settings').click();
  await button('Layers').click();
  await button('Text').click();
  await page.getByLabel('Text', { exact: true }).fill('Built with care.');
  await page.getByLabel('Alignment', { exact: true }).selectOption('left');
  await page.getByLabel('Layer X', { exact: true }).fill('.1');
  await page.getByLabel('Layer Y', { exact: true }).fill('.78');
  await choose('Logo', 'verification/logo.svg');
  await expect(page.getByLabel('Logo image', { exact: true })).toBeVisible();
  await closePanel();
  await page.locator('.shot-sidebar').getByRole('button', { name: 'Look', exact: true }).click();
  await page.getByRole('slider', { name: 'Depth blur', exact: true }).fill('25');
  await closePanel();
  await page.locator('.shot-sidebar').getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.locator('.shot-sidebar summary', { hasText: 'Shadow', exact: true }).click();
  await page.getByLabel('Shadow size').selectOption('medium');
  await closePanel();
  await button('Export').click();
  await expect(button('Close export')).toBeFocused();
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press(i < 8 ? 'Tab' : 'Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.export-dialog'))).toBe(
      true,
    );
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(button('Export')).toBeFocused();
  await button('Export').click();
  await page.getByLabel('Resolution', { exact: true }).selectOption('3840');
  await page.getByLabel('Transparent background').check();
  await page.getByLabel('Also save to Library').check();
  const photo = await downloaded('Export image', 'verification/photo-4k.png');
  const meta = await sharp('verification/photo-4k.png').metadata();
  expect(meta.width).toBe(3840);
  expect(meta.height).toBe(2160);
  const raw = await sharp('verification/photo-4k.png').ensureAlpha().raw().toBuffer();
  expect(raw[3]).toBe(0);
  let opaque = 0,
    partial = 0;
  for (let i = 3; i < raw.length; i += 4) {
    if (raw[i] === 255) opaque++;
    if (raw[i] > 0 && raw[i] < 255) partial++;
  }
  expect(opaque).toBeGreaterThan(100000);
  expect(partial).toBeGreaterThan(5000);
  console.log('4K PNG verified', photo.suggestedFilename(), meta.width, meta.height, {
    opaque,
    partial,
  });
  await button('Close export').click();
  const fixture = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 360;
    const ctx = c.getContext('2d');
    const stream = c.captureStream(30);
    const r = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((res) => (r.onstop = res));
    r.start();
    const start = performance.now();
    await new Promise((res) => {
      function draw(t) {
        const p = (t - start) / 1200;
        ctx.fillStyle = '#1d3147';
        ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = '#ffdc32';
        ctx.fillRect(40 + Math.min(1, p) * 420, 115, 100, 80);
        ctx.font = '30px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Video import check', 40, 65);
        if (p < 1) requestAnimationFrame(draw);
        else res();
      }
      requestAnimationFrame(draw);
    });
    r.stop();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const bytes = new Uint8Array(await new Blob(chunks, { type: r.mimeType }).arrayBuffer());
    return Array.from(bytes);
  });
  await writeFile('verification/import-clip.webm', Buffer.from(fixture));
  await writeFile(
    'verification/logo.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="38" fill="#ffdc32"/><path d="M 42 114 V 46 H 118 V 63 H 63 V 80 H 108 V 97 H 63 V 114 Z" fill="#17181b"/></svg>',
  );
  console.log('Created local clip fixture', fixture.length);

  await button('VIDEO').click();
  await page.locator('.topbar').getByRole('button', { name: 'Add media', exact: true }).click();
  await choose('Import files', 'verification/import-clip.webm');
  await closePanel();
  await expect(page.locator('.import-status')).toHaveCount(0, { timeout: 25000 });
  await expect(page.locator('.stage-caption')).toContainText('import-clip');
  // Keep two actual media scenes. Scene deletions use the editor's controls.
  await page.getByRole('button', { name: /Select scene 1:/ }).click();
  await button('Delete selected scene').click();
  await page.getByRole('button', { name: /Select scene 1:/ }).click();
  await button('Compose').click();
  await button('Compose new variation').click();
  // Photo replacement leaves the video timeline independent; create its second scene explicitly.
  await button('Duplicate scene').click();
  await page.getByRole('button', { name: /Select scene 1:/ }).dblclick();
  await page.getByLabel('Scene duration', { exact: true }).fill('1.8');
  await page.getByLabel('Transition duration', { exact: true }).fill('.35');
  await closePanel();
  await page.getByRole('button', { name: /Select scene 2:/ }).dblclick();
  await page.getByLabel('Scene duration', { exact: true }).fill('1.2');
  await page.getByLabel('Style', { exact: true }).selectOption('push');
  await page.getByLabel('Transition duration', { exact: true }).fill('.35');
  await button('Layers').click();
  await button('Text').click();
  await page.getByLabel('Text', { exact: true }).fill('Motion, made local.');
  await page.getByLabel('Animation', { exact: true }).selectOption('typewriter');
  await page.getByLabel('Animation duration', { exact: true }).fill('.5');
  await choose('Logo', 'verification/logo.svg');
  await closePanel();
  await button('Text scene').click();
  await page.getByLabel('Scene duration', { exact: true }).fill('1.0');
  await page.getByLabel('Style', { exact: true }).selectOption('fade');
  await page.getByLabel('Transition duration', { exact: true }).fill('0.25');
  await button('Layers').click();
  await page.locator('.layer-list button').first().click();
  await page.getByLabel('Text', { exact: true }).fill('A closer look.');
  await page.getByLabel('Animation', { exact: true }).selectOption('blur');
  await closePanel();
  await button('Go to beginning').click();
  await button('Play').click();
  await expect(button('Pause')).toBeVisible();
  await page.waitForTimeout(700);
  await button('Pause').click();
  await page.screenshot({ path: 'verification/video-timeline.png' });
  await button('Export').click();
  await page.getByLabel('Resolution', { exact: true }).selectOption('custom');
  await page.getByLabel('Longest edge', { exact: true }).fill('640');
  await expect(button('Export video')).toBeEnabled({ timeout: 20000 });
  const video = await downloaded('Export video', 'verification/motion.mp4', 180000);
  expect(video.suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  const details = await page.locator('.export-result video').evaluate(async (v) => {
    if (v.readyState < 1)
      await new Promise((res) => v.addEventListener('loadedmetadata', res, { once: true }));
    v.currentTime = 2;
    await new Promise((res) => v.addEventListener('seeked', res, { once: true }));
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let colors = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) colors++;
    await v.play();
    await new Promise((r) => setTimeout(r, 200));
    v.pause();
    return {
      width: v.videoWidth,
      height: v.videoHeight,
      duration: v.duration,
      colors,
      time: v.currentTime,
      frame: c.toDataURL(),
    };
  });
  expect(details.width).toBe(640);
  expect(details.height).toBe(360);
  expect(details.duration).toBeCloseTo(3.4, 1);
  expect(details.colors).toBeGreaterThan(1000);
  expect(details.time).toBeGreaterThan(2);
  await writeFile(
    'verification/video-frame.png',
    Buffer.from(details.frame.split(',')[1], 'base64'),
  );
  delete details.frame;
  console.log('Playable video verified', video.suggestedFilename(), details);
  await button('Close export').click();
  await button('Export').click();
  await page.getByLabel('Resolution', { exact: true }).selectOption('custom');
  await page.getByLabel('Longest edge', { exact: true }).fill('640');
  await expect(button('Export video')).toBeEnabled();
  await button('Export video').click();
  await button('Cancel').click();
  await expect(page.locator('.error-message')).toContainText('cancelled');
  await button('Close export').click();
  console.log('Export cancellation verified');
  await page.locator('.project-trigger').click();
  await downloaded('Download project package', 'verification/project.studio.zip');
  await closePanel();
  const before = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('interface-studio', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    return await new Promise((res) => {
      const r = db.transaction('projects').objectStore('projects').getAll();
      r.onsuccess = () =>
        res(r.result.find((p) => p.id === localStorage.getItem('studio-last-project')));
    });
  });
  await page.reload();
  await expect(page.locator('.project-trigger')).toHaveText('Flow check');
  console.log('Reload verified', before.scenes.length, 'scenes');
  await page.locator('.project-trigger').click();
  const packChooser = page.waitForEvent('filechooser');
  await button('Open project package').click();
  await (await packChooser).setFiles('verification/project.studio.zip');
  await expect(page.locator('.project-trigger')).toHaveText('Flow check · imported', {
    timeout: 20000,
  });
  await button('VIDEO').click();
  await button('Go to beginning').click();
  await page.screenshot({ path: 'verification/package-roundtrip.png' });
  console.log('Project package roundtrip verified');
  await page.setViewportSize({ width: 768, height: 800 });
  await page.screenshot({ path: 'verification/tablet.png' });
  await page.setViewportSize({ width: 540, height: 760 });
  await page.screenshot({ path: 'verification/narrow.png' });
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('.artboard').getBoundingClientRect(),
      t = document.querySelector('.timeline').getBoundingClientRect(),
      d = document.querySelector('.shot-sidebar').getBoundingClientRect();
    return {
      artboardBottom: a.bottom,
      timelineTop: t.top,
      timelineBottom: t.bottom,
      sidebarTop: d.top,
      bodyWidth: document.body.scrollWidth,
      viewport: innerWidth,
    };
  });
  expect(overlap.artboardBottom).toBeLessThanOrEqual(overlap.timelineTop);
  expect(overlap.timelineBottom).toBeLessThanOrEqual(overlap.sidebarTop);
  expect(overlap.bodyWidth).toBe(overlap.viewport);
  console.log('Responsive layout verified', overlap);
  expect(errors).toEqual([]);
  console.log('No page errors.');
  await writeFile(
    'verification/report.json',
    JSON.stringify(
      {
        photo: { width: meta.width, height: meta.height, opaque, partial },
        video: details,
        roundtrip: true,
        reload: true,
        cancellation: true,
        responsive: overlap,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await page.setViewportSize({ width: 1440, height: 900 });
  await browser.close();
}
