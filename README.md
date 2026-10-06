# Interface Studio

**A local photo studio for product shots and UI mockups.**
Drop in a screenshot, frame it with a real 3D camera, add depth blur and shadows, and export a polished PNG.

No account · No cloud uploads · No API keys · No watermark · No limits

---

## ✨ Features

- **Camera:** zoom, rotate and tilt your image in true 3D perspective
- **Depth blur:** choose a focus point manually or automatically and set the blur strength
- **Design:** background, soft shadow, aspect ratio, text and logos
- **Export:** PNG at HD, 2K, 4K or a custom size, with transparency
- **Projects:** autosaved in your browser, with backup and sharing as ZIP files
- **Video:** coming soon 🎬

## 🚀 Quick start

You need [Node.js 24](https://nodejs.org/en/download) and [Git](https://git-scm.com/downloads). It works on macOS, Windows and Linux.

```sh
git clone https://github.com/leifiyoo/project-camera.git
cd project-camera
npm ci
npm run dev
```

Then open **[localhost:3000](http://localhost:3000)**. Press **Ctrl+C** in the terminal to stop.

> **Tip:** If port 3000 is already in use, open the **Local** URL printed in the terminal instead.
> On Windows PowerShell, use `npm.cmd` if `npm` is blocked.

## 🎨 How to use it

1. **Import** an image (PNG, JPG, WebP, AVIF, GIF or SVG). You can also drag and drop or paste it.
2. **Adjust** the camera, focus and design in the sidebar.
   - Ctrl/Cmd + drag rotates
   - Ctrl/Cmd + scroll zooms
3. **Export** your shot as a PNG.

Your projects are saved automatically in this browser. Clearing the browser data deletes them, so use **Projects → Export** to keep a ZIP backup.

## 💡 Good to know

- Works best in a current desktop **Chrome, Edge or Safari**.
- 3D perspective and depth blur need **WebGL**. Without it you get a simple flat view.
- Very large exports can run out of memory. If that happens, choose a smaller size.

## 🏗️ Production build

```sh
npm run build
npm start
```

Use `npm start -- --port 3001` to choose a different port.

## 🧪 Development

```sh
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Unit tests (Vitest)
npm run format      # Prettier
```

Browser smoke test (with the dev server running):

```sh
npx playwright install chromium
npm run verify:startup
```

CI runs these checks on Linux, Windows and macOS. See the [Actions results](https://github.com/leifiyoo/project-camera/actions).

<details>
<summary><b>Project structure</b></summary>

Built with Next.js, TypeScript, React, Tailwind, Three.js and Zustand.

| Folder                  | What's inside                                      |
| ----------------------- | -------------------------------------------------- |
| `src/components/editor` | Editor UI: stage, sidebar, timeline, export dialog |
| `src/lib/studio`        | Project documents, undo, camera and easing logic   |
| `src/lib/media`         | Image/video import, thumbnails, SVG sanitizing     |
| `src/lib/render`        | Three.js renderer with depth blur and shadows      |
| `src/lib/export`        | PNG and video export                               |
| `src/lib/storage`       | IndexedDB storage and ZIP import/export            |

More test reports and screenshots are in [`verification/`](verification/) and [`design-qa.md`](design-qa.md).

</details>

## 📄 License

[GPL-3.0](LICENSE)

Third-party notices:

- Whirl design reference: MIT, see [`LICENSE.whirl.txt`](LICENSE.whirl.txt)
- Inter font: OFL, see [`public/fonts/OFL.txt`](public/fonts/OFL.txt)
- Demo images: see [`public/demos/LICENSE.txt`](public/demos/LICENSE.txt)
- Paper Segmented Control (copied from coss-ui): AGPL-3.0-or-later, see [`src/components/ui/LICENSE.coss-ui.txt`](src/components/ui/LICENSE.coss-ui.txt)
- Dependencies keep their own licenses (e.g. Three.js MIT, Mediabunny MPL-2.0)
