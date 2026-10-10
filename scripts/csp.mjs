// Adds a strict Content-Security-Policy to every exported page. Next.js inlines small
// bootstrap scripts, so each one is allowed by its SHA-256 hash instead of 'unsafe-inline'.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'out';
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

function policy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.map((hash) => `'sha256-${hash}'`).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

const pages = (await readdir(OUT, { recursive: true })).filter((file) => file.endsWith('.html'));
if (!pages.length) throw new Error(`No HTML pages found in ${OUT}/. Run next build first.`);

for (const page of pages) {
  const path = join(OUT, page);
  const html = await readFile(path, 'utf8');
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  const hashes = [...html.matchAll(INLINE_SCRIPT)]
    .map(([, body]) => body)
    .filter(Boolean)
    .map((body) => createHash('sha256').update(body).digest('base64'));
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy([...new Set(hashes)])}"/>`;
  if (!html.includes('<head>')) continue;
  await writeFile(path, html.replace('<head>', `<head>${meta}`));
}

console.log(`Content-Security-Policy added to ${pages.length} page(s).`);
