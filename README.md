# Interface Studio

A local photo and motion studio for software interfaces. Opens directly in an empty editor; original bundled screenshots are available as examples. No account, cloud uploads, API keys, watermark, or usage quota.

## Run

Works locally on **macOS (Apple Silicon and Intel), Windows, and Linux**. Install [Node.js 24 LTS](https://nodejs.org/en/download), which includes npm, and [Git](https://git-scm.com/downloads). No API keys or environment variables are required.

The same terminal commands work on all three systems:

```sh
git clone https://github.com/leifiyoo/project-camera.git
cd project-camera
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000), or the **Local** URL printed in the terminal if port 3000 is already in use. Keep the terminal open; **Ctrl+C** stops the server. On macOS, Terminal is in Applications → Utilities. On Windows, PowerShell or Command Prompt both work (use `npm.cmd` if PowerShell blocks `npm.ps1`).

### Start files

After cloning or downloading and extracting the repository:

- **macOS:** double-click `start-macos.command`. If an extracted ZIP has lost its executable permission, run `chmod +x start-macos.command start.sh` in the project folder, then double-click again. You can always run `bash start-macos.command` from Terminal.
- **Windows:** double-click `start-windows.cmd`.
- **Linux:** run `bash start.sh` in the project folder.

These launchers install the exact dependencies from `package-lock.json` on each launch, then start the development server. The first launch requires internet access. Open the printed Local URL in your browser. For a different port, use `bash start.sh --port 3001` or `start-windows.cmd --port 3001`.

Node 24 is recorded in `.nvmrc` and `.node-version`. With nvm installed, use `nvm install` and `nvm use`. The minimum supported release is Node 24; Node 24 and 26+ are accepted to match the development tooling. Install dependencies separately on each computer so npm selects that system's native packages.

### Production server

For a production server on any supported system:

```sh
npm run build
npm start
```

Open [localhost:3000](http://localhost:3000). Use `npm start -- --port 3001` for a different port. Run `npm run build` again after changing source files. Publishing this repository to GitHub makes the source available; a public website requires a separate deployment.

## Using the studio

- In **Photo**, use **Upload photo** for your own image or screenshot. Replacing a photo keeps its camera, effects, text and logos. **Library**, drag-and-drop and image paste remain available; Video's **Add media** also offers screen recording.
- The large preview and adjacent controls replace the old instrument dock. The header has Photo/Video, import and Export; preview quality, appearance and help live in **Workspace options**.
- **Look** offers Signature Macro, Floating Hero, Device Detail and Clean Front with source thumbnails. Presets keep media and layers, support Undo, and clear their selection when the actual settings change. **Try an example → Open Macro example** loads a local flat dashboard with an editable close shot and motion path.
- In **Look**, choose **MF**, then click the photo itself to place the sharp depth. On narrow screens this returns to the preview. Dragging moves the photo; Ctrl/Cmd + drag rotates it. **AF** uses a marked detail or a useful default. No focus coordinates are required.
- Depth of field has a visible on/off switch and strength slider. **Fine blur controls** reveals the focus width and blur limit. Turning it off keeps the settings. A tilted surface creates different near/far depths; a frontal plane remains evenly sharp.
- **Camera** has Zoom and three rotation sliders. Position and FOV are under **Camera position & optics**. Ctrl/Cmd + scroll also zooms. **Canvas** groups background, frame/device, shadow and aspect ratio; crop and frame appearance are additional disclosures. **Fit to frame** remains explicit, so slider changes and resizing preserve a close crop.
- **Animate camera** opens Compose for editable **Macro Glide**, **Focus Pull** and **Hero Reveal** paths over four to six seconds. Focus Pull uses two marked source points, or a sensible second point. Existing text, logos, source trimming and transitions are preserved.
- In Video, drag scene edges or edit duration, trim source videos, reorder scenes, and scrub/play. Diamonds select camera positions. The inspector edits positions, easing, custom Bézier controls, transitions, text, and logos.
- Export PNG at the current photo or timeline time, or export the entire silent video. HD, 2K, 4K, custom size, and 30/60 fps are available. The export dialog checks the browser's actual encoder.
- Projects autosave to this browser's IndexedDB. The project menu creates, renames, duplicates, switches, deletes, and imports/exports portable ZIP packages containing original media. Library downloads/deletes saved media and exports. Media used by a saved project cannot be deleted until its references are removed.

## Architecture

Next.js App Router, strict TypeScript, React, Tailwind with a restrained studio workspace, locally bundled Geist (and Inter for existing rendered text), and the existing Lucide icon family. Browser-only modules load behind client boundaries.

- `src/components/editor`: editor shell, stage, persistent shot sidebar, progressive inspector, timeline, export dialog, accessible controls.
- `src/lib/studio`: versioned serializable documents, Zustand transactions/undo, deterministic camera/easing/transition evaluation, seeded local composition. Playback time is a separate observable, outside document history and autosave.
- `src/lib/media`: original blobs, bounded runtime image/video sessions, SVG validation/rasterization, import metadata and thumbnails. Mediabunny decodes timestamped video canvases; the HTML video fallback waits for seeking/readiness.
- `src/lib/render`: shared Three.js perspective renderer with original sRGB colors, geometry-based devices, one Three BokehPass depth pipeline with dense disk sampling and mipmapped sample footprints, cached projected soft shadows, and time-derived Canvas text/logo compositing. A normalized source focus point is transformed through the actual cropped surface and current camera matrix. Preview and export consume `evaluateProjectAtTime` and this renderer at their native resolutions; blur radius is proportional to output height.
- `src/lib/export`: lazy PNG and Mediabunny/WebCodecs frame-by-frame video export, support checks, backpressure, cancellation, and honest real-time MediaRecorder fallback.
- `src/lib/storage`: IndexedDB documents and separate media blobs; validated ZIP packages with remapped asset IDs and atomic import.

Incoming transitions overlap the previous scene by their requested duration, capped at half of each scene. Cuts do not overlap. The same spans determine timeline length, scrubbing, playback, and export. Rotations follow the shortest arc. Camera changes in an animated scene update a selected position or capture a position at the playhead.

The stage renders when changed or playing. Preview DPR is capped at 1.5; Draft lowers preview quality without changing export quality. Media, textures, and device geometry are reused and disposed when no longer active. Exports use independent rendering/decoding sessions, preserving the editor composition on completion, failure, or cancellation.

## Browser and hardware boundaries

- Use a current desktop Chrome, Edge, or Safari. Recording needs localhost/HTTPS and user permission in the browser's source picker. Recording captures visual content without audio; cursor behavior follows the browser. Cancelling the picker leaves the editor usable.
- File extension does not guarantee codec support. MP4/MOV/WebM must contain a codec the browser or decoder can read. Unsupported files get a readable error. SVG logos are rasterized after rejecting active content/external resources; GIFs are imported as still images with a visible note.
- Video exports are **silent**. MP4 is preferred when AVC encoding supports the selected size/fps; WebM is otherwise used with the proper extension. If only MediaRecorder is available, the dialog explicitly labels real-time mode and variable frame-rate behavior.
- Devices are recognizable simplified geometry, not photorealistic licensed Apple models. Shadows are projected soft silhouettes. Bokeh blur uses actual surface depth. Draft disables preview DOF; final exports retain it.
- PNG supports alpha, including soft shadows and blur. Video uses the scene's color to flatten a transparent background. Export dimensions retain the chosen aspect ratio, with even dimensions for video.
- GPU texture/renderbuffer limits, canvas size, available RAM, and encoder limits depend on hardware/browser. Full-quality exports and in-memory ZIP/video output may exhaust memory on very large projects. Choose smaller dimensions if needed; there is no artificial clip-length quota. ZIP imports have a 2 GiB decompression safety bound.
- Without WebGL the studio explicitly provides a reduced flat view. Perspective, devices, and DOF require WebGL. Clearing browser storage removes locally saved projects; download project packages as portable backups.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
node scripts/check-server.mjs
```

GitHub Actions runs these checks on Linux, Windows, macOS Apple Silicon, and macOS Intel with Node 24. It also checks the current editor in Chromium on each platform. The production smoke check starts and stops its own server on port 3100 and verifies the homepage and bundled media; `node scripts/check-server.mjs --browser` also runs the browser checks (install Chromium first). Check the [Actions results](https://github.com/leifiyoo/project-camera/actions) for the actual status; the presence of a workflow alone does not mean every platform has passed.

As of 3 October 2026, `npm audit` reports five high-severity development-dependency entries, all from the same [unpatched `braces` advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through Next.js's ESLint configuration. The suggested forced downgrade would replace the current Next.js lint tooling with version 14 and is not applied. This is tracked as an upstream dependency limitation.

The focused tests cover timeline overlaps/duration, rendered transition state, trim/loop timing, shortest rotations, easing, reproducible composition, gesture undo, image-only legacy-project migration, source preservation, Focus Pull, export dimensions, and IndexedDB/ZIP media roundtrip. Browser verification artifacts are in `verification/`; see its reports for the actual checks performed. A screen-capture permission picker requires a manual user selection and is not claimed as an automated recording test. Safari's codecs and screen recording still depend on the browser and macOS version; a successful macOS build does not verify every Safari media feature.

For a smoke check of the current editor, keep the dev or production server running and run:

```sh
npx playwright install chromium
npm run verify:startup
```

This uses an isolated browser to check first launch, photo import, native HD PNG export, persistence after reload, and photo/video switching. It writes `verification/release-startup-report.json` and local PNG artifacts. `STUDIO_URL` selects another running server; `STUDIO_BROWSER_PATH` selects an installed Chromium executable.

The historical browser helper creates its own clip/logo fixtures and a temporary browser context. Its selectors target earlier editor controls; historical UI acceptance is documented in `design-qa.md`:

```sh
npx playwright install chromium
npm run verify:browser
```

Keep the dev server running first. `STUDIO_URL` can select another local server and `STUDIO_BROWSER_PATH` can select an already installed Chromium executable. `npm run format` formats source files.

The focused photographic acceptance pass is `node scripts/verify-macro.mjs`. It uploads a flat local UI, exports DOF-off/left/right PNGs through the real editor, checks unchanged composition and reload, and exports/plays a short Macro Glide. `node scripts/compare-macro.mjs` lays out the generated PNGs beside the supplied reference. The reference is only a comparison artifact; the studio renders an unwarped source asset.

The current compact-sidebar acceptance pass is recorded in `design-qa.md` with screenshots in `verification/`. It covers rounded translucent menus, mouse scrubbing and undo, transparent image import, separate precision settings, animation playback, Inter in portaled controls, and desktop/mobile layout. `scripts/verify-redesign.mjs` is an older browser harness and retains selectors for removed controls.

Bundled demo interfaces are original project assets. Their license is in `public/demos/LICENSE.txt`. Dependencies retain their respective licenses (including Three.js MIT and Mediabunny MPL-2.0).

The Paper Segmented Control and its `cn` helper are copied directly from the local `coss-main/coss-main/packages/ui/src` source, rather than installed through its registry. The component is in `src/components/ui/paper-segmented-control.tsx`; its behavior, original dark palette, Inter typography and derived 14/10-pixel corners are preserved. Only its helper import and explanatory lint comments are adapted. The copied source's AGPL-3.0-or-later license is preserved in `src/components/ui/LICENSE.coss-ui.txt`. Base UI, clsx and tailwind-merge provide its underlying dependencies.
