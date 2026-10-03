import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('public/demos', { recursive: true });
const text = (x, y, t, size = 14, color = '#697080', weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${t}</text>`;
const rect = (x, y, w, h, c, r = 0, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" stroke="${stroke}"/>`;
let light =
  rect(0, 0, 1440, 900, '#fbfcfd') +
  rect(0, 0, 232, 900, '#f4f5f7') +
  text(30, 51, 'f / forma', 25, '#252a35', 700) +
  text(30, 90, 'Your space to make things.', 12);
for (const [i, t] of ['Overview', 'Projects', 'My tasks', 'Calendar', 'Messages'].entries())
  light +=
    rect(18, 126 + i * 46, 195, 38, i === 1 ? '#e4e9f2' : '#f4f5f7', 7) +
    text(42, 151 + i * 46, t, 14, i === 1 ? '#33405a' : '#6b7280', i === 1 ? 600 : 400);
light += text(32, 408, 'WORKSPACE', 10, '#8991a2', 600);
for (const [i, t] of ['Design team', 'Product team', 'Engineering'].entries())
  light += text(42, 449 + i * 41, t, 14);
light +=
  rect(25, 745, 182, 113, '#e7ecf3', 8) +
  text(43, 773, 'A little room to grow.', 13, '#414b60', 600) +
  text(43, 799, 'Ideas live here.', 12) +
  rect(42, 815, 113, 27, '#fff', 4) +
  text(53, 833, 'View workspace', 11, '#4e5870');
light +=
  text(279, 52, 'Projects', 17, '#353b49', 600) +
  text(1208, 52, 'Search anything  /', 12) +
  rect(1381, 27, 30, 30, '#ccd6e6', 15) +
  rect(232, 76, 1208, 1, '#e8ebf0');
light +=
  text(281, 146, 'Brand &amp; product', 34, '#262c38', 600) +
  text(281, 180, 'A shared home for the work that matters.', 15) +
  rect(1214, 126, 174, 42, '#263246', 7) +
  text(1241, 152, '+  Create project', 14, '#fff', 600);
light +=
  text(281, 231, 'All projects', 14, '#2b3447', 600) +
  text(406, 231, 'In progress', 14) +
  text(539, 231, 'Completed', 14) +
  rect(280, 248, 1108, 1, '#e5e9f0') +
  rect(280, 248, 82, 2, '#374866');
const projects = [
  ['Website refresh', 'A new perspective on our digital home.', '#ccdace', '04'],
  ['Design system', 'A little more consistency, everywhere.', '#d8dfea', '12'],
  ['Mobile experience', 'Big ideas. Thoughtful small screens.', '#e7dace', '08'],
  ['Spring campaign', 'Fresh thinking for a fresh season.', '#ded9e7', '06'],
  ['Customer stories', 'Meet the people behind the work.', '#d4e3e3', '09'],
  ['Product launch', 'Bring something good into the world.', '#e8dfcf', '15'],
];
for (let i = 0; i < 6; i++) {
  const x = 280 + (i % 3) * 375,
    y = 282 + Math.floor(i / 3) * 286;
  const [title, sub, c, n] = projects[i];
  light += rect(x, y, 350, 257, '#fff', 10, '#e5e9ef') + rect(x + 12, y + 12, 326, 134, c, 6);
  if (i === 0)
    light +=
      rect(x + 67, y + 32, 217, 95, '#f9fbf9', 3) +
      text(x + 85, y + 56, 'A fresh start.', 17, '#496750', 600) +
      rect(x + 85, y + 68, 133, 6, '#b8cbbd', 3) +
      rect(x + 85, y + 81, 171, 6, '#d4dfd6', 3) +
      rect(x + 85, y + 94, 72, 16, '#597b63', 3);
  else if (i === 1) {
    for (let k = 0; k < 4; k++)
      light += rect(
        x + 40 + k * 68,
        y + 39,
        52,
        52,
        ['#f7f9fc', '#6d82a6', '#324158', '#9fafc8'][k],
        9,
      );
    light += text(x + 40, y + 118, 'Aa   /   01   /   02   /   03', 16, '#657593');
  } else {
    light +=
      rect(x + 75, y + 35, 197, 90, '#fff', 8) +
      rect(x + 91, y + 51, 72, 13, c, 4) +
      rect(x + 91, y + 77, 128, 5, '#d9dde3', 2) +
      rect(x + 91, y + 90, 158, 5, '#e5e8ed', 2) +
      rect(x + 91, y + 102, 87, 5, '#e5e8ed', 2);
  }
  light +=
    text(x + 18, y + 177, title, 17, '#313948', 600) +
    text(x + 18, y + 201, sub, 12) +
    rect(x + 18, y + 222, 61, 21, '#eff3f6', 4) +
    text(x + 26, y + 237, 'Active', 10, '#5d7082') +
    text(x + 252, y + 238, `${n} tasks`, 11);
}
const svg = (content, w = 1440, h = 900) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${content}</svg>`;
await sharp(Buffer.from(svg(light)))
  .png()
  .toFile('public/demos/forma-desktop.png');
let dark =
  rect(0, 0, 1440, 900, '#181a1f') +
  rect(0, 0, 236, 900, '#14161a') +
  text(28, 52, 'SOUND / SPACE', 18, '#e5e7eb', 700) +
  text(28, 106, 'Your library', 12, '#8d95a4');
for (const [i, t] of ['Discover', 'Collection', 'Albums', 'Artists', 'Recently played'].entries())
  dark += text(32, 156 + i * 44, t, 14, i === 0 ? '#f1d994' : '#a3a8b3');
dark +=
  text(282, 69, 'Listen a little closer.', 35, '#fafafa', 600) +
  text(282, 107, 'Sounds for the spaces in between.', 15, '#9098a8');
for (let i = 0; i < 4; i++) {
  const x = 282 + i * 277;
  dark +=
    rect(x, 151, 250, 250, ['#7c8981', '#a0806b', '#7e8397', '#6b7e86'][i], 5) +
    `<circle cx="${x + 125}" cy="276" r="88" fill="#1a1c21"/><circle cx="${x + 125}" cy="276" r="30" fill="#d0c1a4"/>` +
    text(
      x,
      434,
      ['Quiet mornings', 'Low tide', 'After hours', 'Open windows'][i],
      17,
      '#f1f2f5',
      600,
    ) +
    text(
      x,
      461,
      ['Elm &amp; Oak', 'Soren Fields', 'Milo North', 'The Slow Days'][i],
      13,
      '#8e95a2',
    );
}
dark += text(282, 529, 'Made for your day', 21, '#f3f4f6', 600);
for (let i = 0; i < 5; i++)
  dark +=
    rect(281, 557 + i * 53, 1107, 48, i % 2 ? '#1b1e24' : '#20232a', 5) +
    text(305, 587 + i * 53, `0${i + 1}`, 12, '#8c939f') +
    text(
      349,
      587 + i * 53,
      ['A place to begin', 'Everything in its time', 'Soft edges', 'Long way home', 'Still here'][
        i
      ],
      14,
      '#d6d9df',
    ) +
    text(847, 587 + i * 53, 'The Slow Days', 13, '#929aa7') +
    text(1305, 587 + i * 53, `3:${24 + i * 7}`, 12, '#929aa7');
await sharp(Buffer.from(svg(dark)))
  .png()
  .toFile('public/demos/soundspace-dark.png');
let mobile =
  rect(0, 0, 420, 880, '#fcfaf6') +
  text(28, 36, '9:41', 15, '#29332c', 600) +
  text(342, 36, 'LTE', 12, '#29332c') +
  text(27, 96, 'Good morning, Alex.', 25, '#293b32', 600) +
  text(28, 126, 'A little progress, every day.', 14, '#7c897f') +
  rect(24, 164, 372, 256, '#dbe5d9', 22) +
  text(47, 201, 'THIS WEEK', 11, '#64806c', 600) +
  text(47, 245, 'Find your rhythm.', 27, '#324f3c', 600) +
  `<circle cx="210" cy="325" r="60" fill="none" stroke="#b0c4af" stroke-width="13"/><path d="M 210 265 A 60 60 0 1 1 153 344" fill="none" stroke="#557b5b" stroke-width="13" stroke-linecap="round"/>` +
  text(186, 330, '4 / 7', 22, '#35573b', 600) +
  text(168, 351, 'days active', 11, '#65806a') +
  text(27, 474, 'Today, at your pace', 20, '#34483b', 600);
for (let i = 0; i < 3; i++)
  mobile +=
    rect(24, 500 + i * 96, 372, 78, '#ffffff', 13, '#e7e9e1') +
    rect(40, 514 + i * 96, 50, 50, ['#e9dcc8', '#dce6da', '#dce2e8'][i], 12) +
    text(
      108,
      533 + i * 96,
      ['Morning walk', 'A moment of calm', 'Drink some water'][i],
      15,
      '#3c5042',
      600,
    ) +
    text(
      108,
      556 + i * 96,
      ['20 min · Fresh air', '5 min · Breathe', 'One glass at a time'][i],
      12,
      '#819085',
    ) +
    `<circle cx="366" cy="539" r="11" fill="none" stroke="#c1cdc3"/>`;
mobile +=
  rect(0, 815, 420, 65, '#fff') +
  text(48, 850, 'Today', 12, '#426048', 600) +
  text(165, 850, 'Progress', 12) +
  text(304, 850, 'You', 12);
await sharp(Buffer.from(svg(mobile, 420, 880)))
  .png()
  .toFile('public/demos/pace-mobile.png');
await writeFile(
  'public/demos/LICENSE.txt',
  'Original Interface Studio demo interfaces, created for this project. MIT License. No third-party UI screenshots or trademarks.\n',
);
