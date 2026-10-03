import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const port = 3100;
const server = spawn(
  process.execPath,
  [
    require.resolve('next/dist/bin/next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  { stdio: 'inherit' },
);
let exited = false;
let startupError;
const closed = new Promise((resolve) => {
  server.once('error', (error) => {
    startupError = error;
    exited = true;
    resolve();
  });
  server.once('close', () => {
    exited = true;
    resolve();
  });
});

try {
  const deadline = Date.now() + 30_000;
  let response;
  while (Date.now() < deadline && !exited) {
    try {
      response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(2000) });
      break;
    } catch {
      await delay(250);
    }
  }
  if (startupError) throw startupError;
  assert.ok(response && !exited, 'Production server did not start');
  assert.equal(response.status, 200, 'Homepage must return HTTP 200');
  assert.match(await response.text(), /Interface Studio/, 'Homepage must contain studio content');
  const asset = await fetch(`http://127.0.0.1:${port}/demos/forma-desktop.png`);
  assert.equal(asset.status, 200, 'Bundled media must be available');
  assert.match(asset.headers.get('content-type') || '', /image\/png/);
  console.log('PASS Production server: homepage and bundled media');
  if (process.argv.includes('--browser')) {
    process.env.STUDIO_URL = `http://127.0.0.1:${port}`;
    await import('./verify-startup.mjs');
  }
} finally {
  if (!exited) server.kill('SIGTERM');
  await closed;
}
