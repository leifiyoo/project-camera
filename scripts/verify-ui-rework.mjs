import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { Input, BufferSource, ALL_FORMATS } from 'mediabunny';

await mkdir('verification', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.STUDIO_BROWSER_PATH || undefined,
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
});
await context.addInitScript(() => localStorage.setItem('studio-theme', 'light'));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [],
  checks = [],
  demoRequests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/demos/')) demoRequests.push(request.url());
});
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const screenshot = (name) =>
  page.screenshot({ path: `verification/ui-${name}.png`, animations: 'disabled' });
const project = () =>
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
const saved = (predicate) =>
  expect
    .poll(
      async () => {
        const p = await project();
        return !!p && !!predicate(p);
      },
      { timeout: 15000 },
    )
    .toBe(true);
const upload = async (files) => {
  const chooser = page.waitForEvent('filechooser');
  await button('Import media', page.locator('.topbar')).click();
  await (await chooser).setFiles(files);
  await expect(page.locator('.import-status')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('imported');
  await button('Dismiss message').click();
};
const settings = async () => {
  await button('Workspace options').click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog', { name: 'Settings', exact: true });
};

try {
  await page.goto(process.env.STUDIO_URL || 'http://localhost:3000');
  await expect(page.getByRole('heading', { name: 'Your canvas starts here.' })).toBeVisible();
  await expect(page.locator('.studio-footer')).toHaveCount(0);
  await expect(page.getByText('Open a fresh example project')).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('.workspace-mode [data-slot="paper-segment-indicator"]')
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    )
    .toBe('rgb(20, 20, 20)');
  expect(await page.locator('body').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(
    /inter/i,
  );
  expect(demoRequests).toEqual([]);
  await screenshot('empty-light');
  await button('VIDEO').click();
  await expect(page.locator('.timeline-bottom')).toHaveCount(0);
  await expect(page.locator('.playback')).toHaveCount(0);
  await screenshot('empty-video');
  await button('PHOTO').click();
  record('Empty workspace: no templates, footer or unused camera controls');
  await upload('public/demos/forma-desktop.png');
  await expect(page.locator('.artboard canvas')).toBeVisible();
  await saved((p) => p.photo.assetId && p.scenes.length === 0);
  const originalPhoto = (await project()).photo.assetId;
  const shot = page.getByRole('complementary', { name: 'Shot controls' });
  expect(
    await shot.locator('.focus-mode-switch').evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe('rgb(243, 243, 243)');
  await shot.getByRole('combobox', { name: 'Shadow size' }).click();
  expect(await page.locator('.paper-menu-item > svg').count()).toBe(0);
  await page.getByRole('option', { name: 'Small', exact: true }).click();
  await screenshot('photo-light');
  record('Photo import, light focus switch and text-only shadow dropdown');

  let dialog = await settings();
  const box = await dialog.boundingBox();
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(2);
  await screenshot('settings-light');
  await dialog.getByRole('tab', { name: 'Advanced' }).click();
  await expect(dialog.getByRole('heading', { name: 'Depth precision' })).toBeVisible();
  await dialog.getByRole('tab', { name: 'General' }).click();
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.locator('.preview-column').evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe('rgb(24, 24, 24)');
  await expect
    .poll(() =>
      dialog
        .getByRole('radio', { name: 'Dark', exact: true })
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    )
    .toBe('rgb(240, 240, 240)');
  await screenshot('settings-dark');
  await button('Close Settings').click();
  await screenshot('photo-dark');
  dialog = await settings();
  await dialog.getByRole('radio', { name: 'Light', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Light', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  record('Whirl typography, monochrome selected states, dark surfaces and keyboard capsules');
  await dialog.getByRole('tab', { name: 'Canvas', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Aspect ratio' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await button('Projects').click();
  const projects = page.getByRole('dialog', { name: 'Projects', exact: true });
  await projects.getByRole('textbox', { name: 'Project name' }).fill('Studio edit');
  await page.keyboard.press('Tab');
  await screenshot('projects');
  await button('Close Projects').click();
  await button('Library').click();
  await screenshot('library');
  await button('Close Media library').click();
  record('Centered projects, library and settings; appearance and Escape work');

  await button('Export', page.locator('.topbar')).click();
  let exportDialog = page.getByRole('dialog', { name: 'Export', exact: true });
  await expect(exportDialog.getByAltText('Composition preview')).toBeVisible();
  await expect
    .poll(() =>
      exportDialog.getByAltText('Composition preview').evaluate((image) => {
        if (!image.complete || !image.naturalWidth) return 0;
        const sample = document.createElement('canvas');
        sample.width = 32;
        sample.height = 18;
        const context = sample.getContext('2d');
        context.drawImage(image, 0, 0, 32, 18);
        const pixels = context.getImageData(0, 0, 32, 18).data;
        let visible = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 100) visible++;
        return visible;
      }),
    )
    .toBeGreaterThan(100);
  await screenshot('export-image');
  const pngDownload = page.waitForEvent('download');
  await button('Export image', exportDialog).click();
  const png = await pngDownload;
  await png.saveAs('verification/ui-export.png');
  expect((await stat('verification/ui-export.png')).size).toBeGreaterThan(1000);
  await expect(exportDialog.locator('.export-success')).toContainText('Export ready');
  await button('Close export').click();
  record('PNG export: preview, rendering, download and success state');

  // Create an actual moving source in the browser, then upload it as a file.
  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    const done = new Promise((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () =>
        resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));
    });
    recorder.start();
    for (let frame = 0; frame < 24; frame++) {
      ctx.fillStyle = '#f1ede5';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#596d92';
      ctx.fillRect(80 + frame * 8, 110, 160, 140);
      ctx.fillStyle = '#2b2d34';
      ctx.font = '24px sans-serif';
      ctx.fillText('Video upload', 36, 55);
      await new Promise((resolve) => setTimeout(resolve, 67));
    }
    recorder.stop();
    const bytes = await done;
    stream.getTracks().forEach((track) => track.stop());
    return bytes;
  });
  await writeFile('verification/ui-source.webm', Buffer.from(videoBytes));
  await upload('verification/ui-source.webm');
  const videoSidebar = page.getByRole('complementary', { name: 'Video properties' });
  await expect(page.locator('.video-studio')).toBeVisible();
  await expect(page.locator('.scene-clip')).toHaveCount(1);
  await saved((p) => p.scenes.length === 1);
  expect((await project()).photo.assetId).toBe(originalPhoto);
  await expect(videoSidebar.locator('summary', { hasText: 'Trim & playback' })).toBeVisible();
  await screenshot('video-upload');
  record('Real WebM upload automatically opens Video and preserves the photo');

  const ruler = await page.locator('.time-ruler').boundingBox();
  const clipWidth = (await page.locator('.scene-clip').first().boundingBox()).width;
  const sourceDuration = (await project()).scenes[0].duration;
  await page.mouse.click(ruler.x + (clipWidth / sourceDuration) * 0.7, ruler.y + 10);
  await button('Split').click();
  await expect(page.locator('.scene-clip')).toHaveCount(2);
  await saved((p) => p.scenes.length === 2);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.scene-clip')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.scene-clip')).toHaveCount(2);
  await page.locator('.timeline-transition button').click();
  const picker = page.getByRole('dialog', { name: 'Choose transition' });
  await expect(picker).toBeVisible();
  for (const name of ['Dissolve', 'Slide', 'Zoom', 'Wipe', 'Blur', 'None', 'Dissolve']) {
    await button(name, picker).click();
    await expect(button(name, picker)).toHaveAttribute('aria-pressed', 'true');
  }
  await screenshot('transitions-light');
  await button('Preview transition', picker).click();
  await expect(button('Play')).toBeVisible({ timeout: 10000 });
  await button('Close transitions').click();
  await screenshot('video-timeline');
  record('Split, undo/redo, six transitions and bounded transition playback');

  await videoSidebar.getByRole('tab', { name: 'Design' }).click();
  await button('Add camera motion', videoSidebar).click();
  const motion = page.getByRole('dialog', { name: 'Camera motion', exact: true });
  await screenshot('motion');
  const durationBeforeMotion = (await project()).scenes[1].duration;
  await button('Hero reveal', motion).click();
  await button('Apply camera motion', motion).click();
  await saved((p) => p.scenes[1].keyframes.length === 3);
  expect((await project()).scenes[1].duration).toBe(durationBeforeMotion);
  await page.keyboard.press('Control+z');
  await saved((p) => p.scenes[1].keyframes.length === 0);
  await videoSidebar.getByRole('tab', { name: 'Layers' }).click();
  await button('Text', videoSidebar).click();
  await expect(videoSidebar.getByRole('textbox', { name: 'Text', exact: true })).toBeVisible();
  await videoSidebar.getByRole('textbox', { name: 'Text', exact: true }).fill('A short video');
  await page.keyboard.press('Tab');
  await videoSidebar.getByRole('tab', { name: 'Clip' }).click();
  await screenshot('video-properties');
  record('Progressive video properties, visual motion choices and text layers');

  await button('Export', page.locator('.topbar')).click();
  exportDialog = page.getByRole('dialog', { name: 'Export', exact: true });
  await exportDialog.getByRole('combobox', { name: 'Resolution' }).click();
  await page.getByRole('option', { name: 'Custom dimensions' }).click();
  await exportDialog.getByRole('spinbutton', { name: 'Longest edge' }).fill('480');
  await page.keyboard.press('Tab');
  await exportDialog.getByRole('combobox', { name: 'Format' }).click();
  await page.getByRole('option', { name: 'WebM', exact: true }).click();
  await expect(button('Export video', exportDialog)).toBeEnabled();
  await screenshot('export-video');
  const expectedDuration =
    (await project()).scenes.reduce((sum, s) => sum + s.duration, 0) -
    (await project()).scenes[1].transition.duration;
  const videoDownload = page.waitForEvent('download', { timeout: 120000 });
  await button('Export video', exportDialog).click();
  const output = await videoDownload;
  await output.saveAs('verification/ui-export.webm');
  const input = new Input({
    source: new BufferSource(new Uint8Array(await readFile('verification/ui-export.webm'))),
    formats: ALL_FORMATS,
  });
  expect(await input.computeDuration()).toBeCloseTo(expectedDuration, 1);
  input.dispose();
  await button('Close export').click();
  record('Video export decodes with the actual overlapped timeline duration');

  await saved((p) => p.scenes.length === 2 && p.scenes[1].transition.kind === 'fade');
  await page.reload();
  await button('VIDEO').click();
  await expect(page.locator('.scene-clip')).toHaveCount(2);
  record('Video, transitions and layers persist after reload');

  for (const [width, height] of [
    [1264, 600],
    [768, 900],
    [540, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(button('Add scene')).toBeVisible();
    await screenshot(`responsive-${width}`);
    dialog = await settings();
    await expect(dialog.getByRole('tab', { name: 'General' })).toBeVisible();
    await screenshot(`settings-${width}`);
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  dialog = await settings();
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).click();
  await button('Close Settings').click();
  await expect(dialog).toHaveCount(0);
  await page.locator('.timeline-transition button').click();
  await screenshot('transitions-dark');
  await button('Close transitions').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.timeline-transition button').click();
  expect(
    await page
      .locator('.transition-demo i')
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none');
  await button('Close transitions').click();
  record('Responsive desktop/tablet/mobile, modal focus and reduced motion');
  expect(errors).toEqual([]);
  expect(demoRequests).toEqual([]);
  await writeFile(
    'verification/ui-rework-report.json',
    JSON.stringify({ checks, errors, demoRequests }, null, 2),
  );
} catch (error) {
  await screenshot('failure');
  await writeFile(
    'verification/ui-rework-report.json',
    JSON.stringify({ checks, errors, failure: error.message }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
