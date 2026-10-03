import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const artifacts = resolve(dirname(fileURLToPath(import.meta.url)), '../verification');
const referenceCrop = { left: 77, top: 52, width: 1398, height: 786 };
const source = (name) => join(artifacts, name);

function label(text, width, height) {
  const escaped = text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  );
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <text x="0" y="25" font-family="Arial,sans-serif" font-size="18" font-weight="600" fill="#202329">${escaped}</text>
    </svg>`,
  );
}

async function displayImage(name, width, height, crop) {
  const input = sharp(source(name));
  if (crop) {
    const meta = await input.metadata();
    if ((meta.width || 0) < crop.left + crop.width || (meta.height || 0) < crop.top + crop.height)
      throw new Error(`Reference crop does not fit ${name} (${meta.width} × ${meta.height}).`);
    input.extract(crop);
  }
  // Only resize for display. All perspective, blur and colors come from the
  // referenced source or the studio's actual output, never this comparison.
  return input.resize(width, height, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
}

async function board(name, columns, imageWidth, imageHeight, padding = 32, gap = 24) {
  const labelHeight = 42;
  const width = padding * 2 + imageWidth * columns.length + gap * (columns.length - 1);
  const height = padding * 2 + labelHeight + imageHeight;
  const images = await Promise.all(
    columns.map((column) => displayImage(column.file, imageWidth, imageHeight, column.crop)),
  );
  const layers = columns.flatMap((column, index) => {
    const left = padding + index * (imageWidth + gap);
    return [
      { input: label(column.label, imageWidth, labelHeight), left, top: padding },
      { input: images[index], left, top: padding + labelHeight },
    ];
  });
  const output = source(name);
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .png()
    .toFile(output);
  console.log(`${output} (${width} × ${height})`);
}

await mkdir(artifacts, { recursive: true });
await board(
  'macro-comparison.png',
  [
    { file: 'ui-camera-reference.png', label: 'UI Camera · reference', crop: referenceCrop },
    { file: 'signature-macro.png', label: 'Interface Studio · PNG from flat source' },
  ],
  768,
  432,
);
await board(
  'macro-focus-comparison.png',
  [
    { file: 'macro-sharp.png', label: 'DOF off' },
    { file: 'macro-focus-left.png', label: 'Focus left' },
    { file: 'macro-focus-right.png', label: 'Focus right' },
  ],
  640,
  360,
  24,
);
