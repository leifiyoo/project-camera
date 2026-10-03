import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { Input, BufferSource, ALL_FORMATS } from 'mediabunny';
import { readFile } from 'node:fs/promises';

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
const demoRequests = [];
const checks = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.url().includes('/demos/')) demoRequests.push(request.url());
});
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
const sidebar = page.getByRole('complementary', { name: 'Video properties' });
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
const projectWhen = async (predicate) => {
  await expect
    .poll(async () => Boolean(predicate(await readProject())), { timeout: 15000 })
    .toBe(true);
  return readProject();
};
const fillNumber = async (name, value, scope = sidebar) => {
  const input = scope.getByRole('spinbutton', { name, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
};
const drag = async (locator, dx) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
};
const upload = async (files, scope = page.locator('.topbar')) => {
  const chooser = page.waitForEvent('filechooser');
  await button('Import media', scope).click();
  await (await chooser).setFiles(files);
  await expect(page.locator('.import-status')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('imported');
};
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};

try {
  await page.goto(process.env.STUDIO_URL || 'http://localhost:3000');
  await expect(page.getByRole('heading', { name: 'Your canvas starts here.' })).toBeVisible();
  await projectWhen((p) => p?.scenes.length === 0 && !p.photo.assetId);
  expect(demoRequests).toEqual([]);
  await button('VIDEO').click();
  await expect(page.getByRole('heading', { name: 'Your video starts here.' })).toBeVisible();
  await expect(button('Play')).toBeDisabled();
  await expect(button('Export')).toBeDisabled();
  await expect(page.locator('.scene-clip')).toHaveCount(0);
  await expect(page.locator('.quick-access-bar')).toHaveCount(0);
  await expect(sidebar.getByRole('combobox', { name: 'Aspect ratio' })).toBeVisible();
  await page.screenshot({ path: 'verification/video-empty-desktop.png' });
  record(
    'Clean first launch: no scenes, no demo requests, no floating tools, disabled playback/export',
  );

  // Importing a photo must leave the independent video timeline empty.
  await button('PHOTO').click();
  const chooser = page.waitForEvent('filechooser');
  await button('Upload photo', page.locator('.topbar')).click();
  await (await chooser).setFiles('public/demos/forma-desktop.png');
  await projectWhen((p) => p?.photo.assetId && p.scenes.length === 0);
  await button('VIDEO').click();
  await expect(page.locator('.empty-stage')).toBeVisible();
  record('Photo upload does not silently add a video scene');

  await upload(['public/demos/forma-desktop.png', 'public/demos/pace-mobile.png']);
  let project = await projectWhen((p) => p?.scenes.length === 2);
  const first = project.scenes[0].id;
  expect(
    project.scenes.every(
      (s) => !s.keyframes.length && !s.layers.length && s.transition.kind === 'cut',
    ),
  ).toBe(true);
  await expect(page.locator('.stage-loading')).toHaveCount(0);
  await fillNumber('Scene duration', 2.5);
  await projectWhen((p) => p.scenes[0].duration === 2.5);
  await drag(page.locator(`[data-scene-id="${first}"] .clip-handle-end`), 64);
  await projectWhen((p) => p.scenes[0].duration === 3.5);
  await page.keyboard.press('Control+z');
  await projectWhen((p) => p.scenes[0].duration === 2.5);
  await page.keyboard.press('Control+Shift+z');
  await projectWhen((p) => p.scenes[0].duration === 3.5);
  await drag(page.locator(`[data-scene-id="${first}"] .clip-handle-start`), 64);
  await projectWhen((p) => p.scenes[0].duration === 2.5);
  record('Image import, numeric duration, both resize edges, one-step undo and redo');

  const secondId = project.scenes[1].id;
  await drag(page.locator(`[data-scene-id="${secondId}"] .clip-content`), -280);
  await projectWhen((p) => p.scenes[0].id === secondId);
  await button('Move scene right').click();
  await projectWhen((p) => p.scenes[1].id === secondId);
  await button('Duplicate scene').click();
  await projectWhen((p) => p.scenes.length === 3);
  await button('Delete selected scene').click();
  await projectWhen((p) => p.scenes.length === 2);
  record('Pointer reorder, keyboard alternatives, duplication and deletion');

  await button('Go to beginning').click();
  await button('Play').click();
  await expect.poll(() => page.locator('.time-code').innerText()).not.toContain('00:00.00 /');
  await button('Pause').click();
  await button('Zoom in timeline').click();
  await expect(page.locator('.timeline-zoom')).toContainText('200%');
  await button('Zoom out timeline').click();
  record('Playback, seeking and timeline zoom');

  await upload('verification/import-clip.webm');
  project = await projectWhen((p) => p?.scenes.length === 3 && p.scenes[2].assetId);
  const videoId = project.scenes[2].id;
  const fullLength = project.scenes[2].duration;
  expect(project.scenes[2].loop).toBe(false);
  expect(fullLength).toBeGreaterThan(1);
  await drag(page.locator(`[data-scene-id="${videoId}"] .clip-handle-start`), 32);
  project = await projectWhen((p) => p.scenes[2].trimIn === 0.5);
  expect(project.scenes[2].duration).toBeCloseTo(fullLength - 0.5, 1);
  await drag(page.locator(`[data-scene-id="${videoId}"] .clip-handle-end`), -32);
  project = await projectWhen((p) => p.scenes[2].trimOut < fullLength - 0.4);
  expect(project.scenes[2].duration).toBeCloseTo(fullLength - 1, 1);
  record('Real video import and source-aware trimming at both ends');

  await sidebar.getByRole('tab', { name: 'Layers', exact: true }).click();
  await button('Text', sidebar).click();
  await sidebar.getByLabel('Text', { exact: true }).fill('A simple timeline.');
  await projectWhen((p) => p.scenes[2].layers.some((l) => l.text === 'A simple timeline.'));
  await expect(page.locator('.panel')).toHaveCount(0);
  await sidebar.getByRole('tab', { name: 'Design', exact: true }).click();
  await sidebar.locator('summary', { hasText: 'Camera & motion' }).click();
  await button('Capture at playhead', sidebar).click();
  await expect(page.locator('.key-dot')).toHaveCount(1);
  await fillNumber('Keyframe time', 0.1);
  await projectWhen((p) => p.scenes[2]?.keyframes[0]?.time === 0.1);
  await expect(page.locator('.panel')).toHaveCount(0);
  await sidebar.getByRole('tab', { name: 'Clip', exact: true }).click();
  await page.screenshot({ path: 'verification/video-editor-desktop.png' });
  record('Docked layer editing and camera keyframes without covering other menus');

  await button('Projects').click();
  await button('New project').click();
  await expect(page.locator('.scene-clip')).toHaveCount(0);
  await projectWhen((p) => p.scenes.length === 0 && !p.photo.assetId);
  await button('Add scene').click();
  await page.getByRole('menuitem', { name: 'Text scene', exact: true }).click();
  await expect(page.locator('.scene-clip')).toHaveCount(1);
  await sidebar.getByLabel('Text', { exact: true }).fill('Video test');
  await sidebar.getByRole('tab', { name: 'Clip', exact: true }).click();
  await fillNumber('Scene duration', 0.6);
  await projectWhen((p) => p.scenes.length === 1 && p.scenes[0].duration === 0.6);
  record('New project stays empty despite existing library media; explicit text scene creation');

  await button('Export').click();
  await page.getByRole('combobox', { name: 'Resolution', exact: true }).click();
  await page.getByRole('option', { name: 'Custom dimensions', exact: true }).click();
  await fillNumber('Longest edge', 320, page.getByRole('dialog'));
  const exportVideo = button('Export video', page.getByRole('dialog'));
  await expect(exportVideo).toBeEnabled({ timeout: 30000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await exportVideo.click();
  const download = await downloadPromise;
  const exportPath = `verification/video-redesign-export.${download.suggestedFilename().split('.').at(-1)}`;
  await download.saveAs(exportPath);
  expect((await stat(exportPath)).size).toBeGreaterThan(500);
  const input = new Input({
    source: new BufferSource(new Uint8Array(await readFile(exportPath))),
    formats: ALL_FORMATS,
  });
  try {
    expect(await input.computeDuration()).toBeCloseTo(0.6, 1);
  } finally {
    input.dispose();
  }
  await button('Close export').click();
  record('Export produces a decodable video with the timeline duration');

  await button('Delete selected scene').click();
  await expect(page.locator('.empty-stage')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.scene-clip')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.scene-clip')).toHaveCount(0);
  await projectWhen((p) => p.scenes.length === 0);
  await page.reload();
  await button('VIDEO').click();
  await expect(page.locator('.scene-clip')).toHaveCount(0);
  await expect(page.locator('.empty-stage')).toBeVisible();
  record('Delete last scene, keyboard undo/redo and persistent empty project after reload');

  for (const [width, height] of [
    [1264, 600],
    [768, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(button('Add scene')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `verification/video-empty-${width}.png`, fullPage: true });
  }
  await button('Add scene').click();
  await page.getByRole('menuitem', { name: 'Blank scene', exact: true }).click();
  await expect(sidebar).toBeVisible();
  await fillNumber('Scene duration', 2);
  await projectWhen((p) => p.scenes[0]?.duration === 2);
  await page.screenshot({ path: 'verification/video-editor-mobile.png', fullPage: true });
  await sidebar.getByRole('tab', { name: 'Clip' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(sidebar.getByRole('tab', { name: 'Design' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  record(
    'Desktop, tablet and mobile layouts, no horizontal page overflow, keyboard tab navigation',
  );
  expect(errors).toEqual([]);
  await writeFile(
    'verification/video-redesign-report.json',
    JSON.stringify({ checks, errors, demoRequests, exportPath }, null, 2),
  );
  console.log(`All ${checks.length} browser checks passed.`);
} catch (error) {
  await page.screenshot({ path: 'verification/video-redesign-failure.png', fullPage: true });
  await writeFile(
    'verification/video-redesign-report.json',
    JSON.stringify({ checks, errors, failure: error.message }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
