# Verification performed

## Simplified workspace redesign

The persistent Look/Camera/Canvas controls replace the dock. `scripts/verify-redesign.mjs` uses an isolated Chromium context and the actual editor; `redesign-report.json` records photo import, source preservation, presets/Undo, MF click, progressive camera/canvas controls, native PNG, playable MP4 and reload. Light photo/video and dark photo layouts passed at 1440, 1280, 768 and 390 pixels with no header overlap or page-width overflow.

`redesign-interaction-report.json` adds native Space activation, Mark detail followed by MF, mobile clip/diamond containment and settled dark appearance. `panel-keyboard-report.json` verifies Tab/Shift+Tab through opened and closed nested controls. The complete `scripts/browser-check.mjs` flow was rerun successfully, including text/logo, transparent 4K PNG, video, cancellation and project package roundtrip.

See `redesign-notes.md` for the audit and design decisions. Actual editor screenshots start with `redesign-`; native output files are `redesign-photo.png` (1280 × 720) and `redesign-motion.mp4` (960 × 540, four seconds, silent).

## Project and rendering checks

On 1 October 2026, in isolated desktop Chromium on Windows:

- Demo loads with actual locally bundled media and no page errors.
- Image import and all four frame/device choices render.
- Photo camera rotation, depth blur, shadow, text and sanitized SVG logo work together.
- Native 3840 × 2160 PNG downloads, has actual opaque content and partial alpha, and is also saved to the Library.
- A generated 1.2-second WebM is imported as source media. A three-scene timeline uses a composed camera path, Push/Fade overlap, typewriter text, blur-fade text card and a logo.
- Actual MP4 output is downloaded and played: 640 × 360, 3.4 seconds. Seeking to 2 seconds produces an image containing source video, text and logo; playback advances.
- Video export cancellation returns an interactive editor and preserves the project.
- The export dialog contains forward/backward Tab focus; Escape closes it and returns focus to Export. A final transparent 4K PNG check confirms the corrected shadow edge.
- Reload restores the project. Export/import of the ZIP package restores all referenced media with fresh asset IDs.
- Tablet (768 px) and narrow desktop (540 px) layouts have no stage/timeline/sidebar overlap or page-width overflow.
- Typecheck, ESLint, production build and all 14 focused logic/history/storage/preset tests pass.

`report.json` records the successful browser run's dimensions, duration, alpha counts, cancellation, project roundtrip, layout checks and errors. The browser script is `scripts/browser-check.mjs`.

Screen recording's real OS/browser permission picker was not automated. Safari/macOS and a full codec/browser matrix were not tested. These are not claimed as verified.

## Photographic renderer and mouse-focus acceptance

The follow-up uses the original flat `public/demos/servers-dashboard.png` (1600 × 1000), uploaded through **Upload photo**. The supplied UI Camera reference is only displayed beside the finished studio PNG for comparison.

- Signature Macro uses a fixed camera, deliberate crop and actual near/far surface depth. Native 1280 × 720 PNGs show DOF off, MF left and MF right with the same composition.
- The readable area visibly changes sides. Regional image gradients (left/right) are 12.23/8.18 with DOF off, 11.61/2.50 with focus left and 2.09/7.41 with focus right. These are local edge measurements supporting the visual inspection, not a general image-quality score.
- The final dense, mip-prefiltered depth gather removes the observed coarse repeating pattern at strong blur. Rounded device edges and transparent PNG compositing were also opened and inspected.
- MF accepts an ordinary click on the surface. No focus-coordinate inputs or separate focus tool remain. The marker agrees with the clicked output position, stays out of exports, and the source UV survives pan, Ctrl-drag rotation and resize. One Undo restores the previous point.
- DOF off/on retains the separate 85% strength, 10% focus width and 70% blur limit. Photo replacement preserves pose, background, frame, effects, layers and keys.
- The final actual Macro Glide MP4 is 960 × 540 at 30 fps, four seconds, with zero audio tracks. Playback advances; decoded frames at 0.4, 2 and 3.6 seconds contain the source UI and show pan/perspective motion.
- Reload restores the correct selected project and close composition. The portable ZIP contains the source and editable shot/path. PHOTO and VIDEO controls fit at 768 px and 540 px without overlap or page overflow. No page errors occurred.
- Typecheck, ESLint, production build and all 14 focused tests pass.

Artifacts: `signature-macro.png`, `macro-sharp.png`, `macro-focus-left.png`, `macro-focus-right.png`, `macro-comparison.png`, `macro-focus-comparison.png`, `macro-glide.mp4`, `signature-macro.studio.zip`, `macro-report.json` and `mf-controls-report.json`.

Reproduce with `node scripts/verify-macro.mjs`, then `node scripts/compare-macro.mjs` while the dev server is running. The reference comparison expects the supplied image at `verification/ui-camera-reference.png`; generated render PNGs come from the normal editor/export workflow.
