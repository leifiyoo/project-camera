import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';

await mkdir('verification', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.STUDIO_BROWSER_PATH || undefined,
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.setDefaultTimeout(20_000);

try {
  await page.goto(process.env.STUDIO_URL || 'http://localhost:3000');
  await expect(page.getByRole('heading', { name: 'Your canvas starts here.' })).toBeVisible();
  await page
    .getByLabel('Upload a photo or screenshot', { exact: true })
    .setInputFiles('public/demos/forma-desktop.png');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Composition studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadEvent = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Export image', exact: true }).click();
  const download = await downloadEvent;
  assert.equal(await download.failure(), null, 'PNG download must finish');
  await download.saveAs('verification/release-export.png');
  const metadata = await sharp('verification/release-export.png').metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  const stats = await sharp('verification/release-export.png').stats();
  assert.ok(
    stats.channels.some((channel) => channel.stdev > 10),
    'Export must contain image detail',
  );
  await page.getByRole('button', { name: 'Close export', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Composition studio' })).toBeVisible();
  await page.screenshot({ path: 'verification/release-imported.png' });
  await page.getByRole('button', { name: 'VIDEO', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your video starts here.' })).toBeVisible();
  await page.getByRole('button', { name: 'PHOTO', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Composition studio' })).toBeVisible();
  assert.deepEqual(errors, [], 'Browser must have no page errors');
  const report = {
    platform: process.platform,
    node: process.versions.node,
    checks: [
      'Empty first launch',
      'Photo import',
      '1920 × 1080 PNG export with image detail',
      'Saved photo restored after reload',
      'Independent photo/video workspaces',
    ],
    errors,
  };
  await writeFile(
    'verification/release-startup-report.json',
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log('PASS Startup, import, PNG export, persistence, photo/video switching');
} finally {
  await context.close();
  await browser.close();
}
