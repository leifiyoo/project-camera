import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

// Original, deliberately flat UI. The studio supplies all perspective, crop,
// shadows and depth of field; none of those effects are baked into this source.
const width = 1600;
const height = 1000;
const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const rect = (x, y, w, h, fill, radius = 0, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const text = (x, y, value, size = 14, fill = '#8f969e', weight = 400, extra = '') =>
  `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${escape(value)}</text>`;
const line = (x1, y1, x2, y2, stroke = '#292d32') =>
  `<path d="M${x1} ${y1}H${x2}" transform="translate(0 ${y2 - y1})" stroke="${stroke}" fill="none"/>`;
const circle = (x, y, radius, fill) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
const icon = (x, y, name, color = '#8b9199') => {
  const paths = {
    dashboard: 'M2 2h7v7H2z M13 2h7v7h-7z M2 13h7v7H2z M13 13h7v7h-7z',
    servers: 'M2 2h18v7H2z M2 13h18v7H2z M5 5h.1 M5 16h.1 M14 5h3 M14 16h3',
    storage: 'M2 4l9-3 9 3v13l-9 4-9-4z M2 4l9 4 9-4 M11 8v13',
    terminal: 'M2 5l5 5-5 5 M10 16h9',
    activity: 'M0 12h5l4-9 5 17 4-8h4',
    settings:
      'M11 3v3 M11 16v3 M3 11h3 M16 11h3 M5 5l2 2 M15 15l2 2 M5 17l2-2 M15 7l2-2 M11 7a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
    chevron: 'M6 8l5 5 5-5',
  };
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></g>`;
};

let ui = rect(0, 0, width, height, '#111315');
ui += rect(0, 0, 202, height, '#0d0f11') + rect(201, 0, 1, height, '#23272b');
ui += rect(28, 31, 30, 30, '#b7c4d2', 7) + icon(32, 36, 'storage', '#151b21');
ui += text(71, 52, 'Northstar', 19, '#e1e5e9', 600);
ui += text(28, 111, 'WORKSPACE', 10, '#626b75', 600, 'letter-spacing="1.7"');
const nav = [
  ['Dashboard', 'dashboard'],
  ['Servers', 'servers'],
  ['Storage', 'storage'],
  ['Console', 'terminal'],
  ['Activity', 'activity'],
];
for (const [index, [label, glyph]] of nav.entries()) {
  const y = 137 + index * 49;
  if (!index) ui += rect(16, y - 8, 170, 39, '#1e2227', 6);
  ui += icon(29, y, glyph, index ? '#757d87' : '#b8c0cb');
  ui += text(64, y + 16, label, 13, index ? '#9199a3' : '#e3e7eb', index ? 400 : 500);
}
ui += text(28, 448, 'ENVIRONMENTS', 10, '#626b75', 600, 'letter-spacing="1.5"');
ui += circle(34, 482, 4, '#91aaa0') + text(49, 487, 'Production', 13, '#b7bec7');
ui += circle(34, 522, 4, '#8c91a7') + text(49, 527, 'Development', 13, '#858d99');
ui += icon(28, 872, 'settings') + text(64, 888, 'Settings', 13, '#979fa9');
ui += line(24, 917, 178, 917);
ui += circle(42, 949, 16, '#303841') + text(32, 954, 'AK', 11, '#cbd4dd', 500);
ui +=
  text(67, 945, 'Alex Kim', 12, '#c5cbd2', 500) +
  text(67, 964, 'Personal workspace', 10, '#6c7580');

ui +=
  text(240, 56, 'Workspace', 12, '#6d7680') +
  text(322, 56, '/', 12, '#404850') +
  text(340, 56, 'Overview', 12, '#abb2bc');
ui +=
  rect(1327, 31, 225, 35, '#191d21', 6, '#2b3138') +
  text(1341, 53, 'Search servers, volumes…', 12, '#7f8893');
ui += text(240, 108, 'Dashboard', 36, '#e6eaee', 600);
ui += text(241, 138, 'Your infrastructure, at a glance. Everything is up to date.', 14, '#8e97a2');
ui +=
  rect(1391, 91, 161, 36, '#252c33', 6, '#353e48') +
  text(1411, 115, '+  Create server', 13, '#d2dae3', 500);

// A long, detailed table gives left/right focus probes on the same source row.
ui += rect(240, 183, 967, 580, '#171a1e', 9, '#2a3036');
ui += text(264, 217, 'Servers', 19, '#e1e5e9', 500) + text(350, 216, '5', 11, '#818b96');
ui +=
  rect(1038, 198, 143, 27, '#1f242a', 4, '#323943') +
  text(1051, 216, 'All environments', 11, '#aeb7c2');
ui += icon(1155, 200, 'chevron', '#87929e');
ui += line(240, 242, 1207, 242);
ui += text(282, 270, 'SERVER', 11, '#838d99', 500, 'letter-spacing=".7"');
ui += text(608, 270, 'STATUS', 11, '#838d99', 500, 'letter-spacing=".7"');
ui += text(731, 270, 'PLAYERS', 11, '#838d99', 500, 'letter-spacing=".7"');
ui += text(855, 270, 'REGION', 11, '#838d99', 500, 'letter-spacing=".7"');
ui += text(1004, 270, 'MEMORY / CPU', 11, '#838d99', 500, 'letter-spacing=".7"');
const rows = [
  [
    'Survival',
    'Paper 1.21.11 · production',
    'Offline',
    '—',
    'Frankfurt, DE',
    '4 GB / 2 cores',
    '#7d8891',
  ],
  [
    'Creative',
    'Paper 1.21.11 · development',
    'Running',
    '8 / 24',
    'Frankfurt, DE',
    '6 GB / 4 cores',
    '#89aea0',
  ],
  [
    'Skyline',
    'Fabric 1.21.11 · production',
    'Running',
    '16 / 32',
    'Amsterdam, NL',
    '8 GB / 4 cores',
    '#89aea0',
  ],
  ['Archive', 'Paper 1.20.6 · backup', 'Stopped', '—', 'Helsinki, FI', '2 GB / 1 core', '#7d8891'],
  [
    'Studio',
    'Vanilla 1.21.11 · development',
    'Starting',
    '0 / 12',
    'Frankfurt, DE',
    '4 GB / 2 cores',
    '#bdad87',
  ],
];
for (const [index, row] of rows.entries()) {
  const y = 290 + index * 78;
  if (index % 2 === 0) ui += rect(241, y - 4, 965, 77, '#1b1f24');
  ui += circle(266, y + 21, 4, row[6]);
  ui += text(282, y + 22, row[0], 16, '#dee3e8', 500);
  ui += text(282, y + 43, row[1], 11, '#939eab');
  ui += text(608, y + 22, row[2], 13, index === 1 || index === 2 ? '#a3c7b8' : '#a8b1bc', 500);
  ui += text(731, y + 22, row[3], 13, '#bec6d0');
  ui += text(855, y + 22, row[4], 12, '#aab5c2');
  ui += text(1004, y + 22, row[5], 12, '#c0cad6');
  ui += text(
    1004,
    y + 43,
    index === 0 || index === 3 ? 'No active allocation' : 'Standard compute',
    10,
    '#8592a1',
  );
  ui += text(1171, y + 25, '···', 19, '#9eabb9', 600);
  if (index < 4) ui += line(258, y + 73, 1189, y + 73, '#272d34');
}
ui += line(240, 685, 1207, 685) + text(265, 716, '5 servers across 3 regions', 12, '#7d8897');
ui += text(1033, 716, 'Last sync 2 minutes ago', 11, '#6f7d8d');
ui += rect(261, 732, 83, 3, '#4b5968', 1);

// Right detail cards intentionally use many real UI strokes and small labels.
ui += rect(1232, 183, 320, 254, '#171b20', 9, '#2a3036');
ui += text(1255, 215, 'Workspace health', 16, '#dae1e8', 500);
ui += circle(1392, 297, 53, '#1e262d');
ui += '<circle cx="1392" cy="297" r="43" fill="none" stroke="#32453f" stroke-width="7"/>';
ui +=
  '<path d="M1392 254 A43 43 0 1 1 1349 297" fill="none" stroke="#92b7a6" stroke-width="7" stroke-linecap="round"/>';
ui += text(1369, 302, '98', 29, '#dbe8e0', 500) + text(1374, 322, 'score', 10, '#90a899');
ui += text(1256, 390, 'All systems operational', 12, '#a9c4b7');
ui += circle(1520, 385, 4, '#91b4a1') + text(1256, 413, 'Updated just now', 10, '#7a8794');
ui += rect(1232, 457, 320, 186, '#182027', 9, '#303c47');
ui +=
  text(1255, 489, 'Monthly usage', 16, '#dde6ef', 500) +
  text(1255, 531, '€ 24.80', 28, '#e2ebf4', 500);
ui +=
  text(1255, 555, 'of € 60.00 budget', 11, '#8da0b2') +
  rect(1255, 577, 274, 5, '#2c3742', 2) +
  rect(1255, 577, 113, 5, '#849caf', 2);
ui += text(1255, 612, 'Billing cycle ends in 12 days', 11, '#9bafc1');
ui += rect(1232, 663, 320, 176, '#202933', 9, '#344151');
ui += text(1255, 695, 'A little room to grow', 16, '#dce7f2', 500);
ui += text(1255, 723, 'Add resources when you need them.', 11, '#a5b7ca');
ui += text(1255, 744, 'Your workspace scales with your ideas.', 11, '#a5b7ca');
ui += rect(1255, 768, 275, 43, '#435e7c', 5) + text(1333, 794, 'Explore plans', 13, '#e4effb', 500);

ui += rect(240, 787, 967, 160, '#161a1e', 9, '#2a3036');
ui +=
  text(263, 819, 'Recent activity', 16, '#d9e1e9', 500) +
  text(1117, 819, 'View all →', 11, '#8895a4');
const activity = [
  ['Creative finished a scheduled backup', 'Today, 09:42', '#8baaa0'],
  ['Skyline started successfully', 'Today, 09:38', '#8baaa0'],
  ['Survival was stopped by Alex Kim', 'Yesterday, 21:15', '#8895a4'],
];
for (const [index, [message, time, color]] of activity.entries()) {
  const y = 852 + index * 32;
  ui +=
    circle(270, y - 4, 3, color) +
    text(283, y, message, 12, '#a6b2bf') +
    text(1032, y, time, 10, '#718090');
}

const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${ui}</svg>`;
await mkdir('public/demos', { recursive: true });
await writeFile('public/demos/servers-dashboard.svg', source);
await sharp(Buffer.from(source)).png().toFile('public/demos/servers-dashboard.png');
console.log(`Created original flat dashboard: ${width} × ${height}.`);
console.log(
  'Focus probes on Survival row: left { x: .2375, y: .312 }, right { x: .6825, y: .312 }.',
);
