# Studio workspace redesign

Reading this as a visual overhaul of a working photo and motion editor, for people who want to upload a picture and make a shot without learning an instrument panel. The direction is calm, utilitarian minimalism with a large preview, neutral surfaces and a restrained green selection accent.

Design variance: 4. Motion intensity: 2. Visual density: 4. Native controls, CSS tokens and the existing icon family keep the editor small. Geist is served locally through next/font/local; existing rendered Inter text remains supported.

## Audit and changes

The former interface split import, presets, focus, blur, camera settings and export across the header, floating dialogs and a large dark dock. It duplicated import/export actions and mixed blue and yellow highlights. The renderer and project workflows were already useful.

The new workspace keeps import and Export in one header. Photo/Video is a single mode switch. Library, animation and history sit above the preview. A persistent adjacent sidebar groups Look, Camera and Canvas; on narrow screens it follows the preview and timeline.

Look exposes presets, AF/MF, depth enable and strength. Fine blur controls reveal width and limit. Camera exposes zoom and three rotation sliders, with position/FOV folded away. Canvas groups background, frame, shadow and ratio, then folds cropping and frame appearance. Text, logos and timeline options remain available through More scene options.

MF explicitly returns the canvas tool to Move, so a focus click still works after marking a Compose detail. Native summaries and buttons keep their Space/Enter behavior. Dialog tab cycling excludes controls in closed disclosures. Starting playback clears a selected keyframe so later camera edits follow the playhead. Status messages have a compact, dismissible surface. Mobile timeline height follows its wrapped controls and preserves the diamond row.

## Evidence

- `redesign-before.png` records the previous editor.
- `redesign-desktop-look.png`, `redesign-desktop-camera.png` and `redesign-desktop-canvas.png` show the actual redesigned editor.
- `redesign-report.json` records the full import, focus, PNG, MP4, reload and responsive acceptance pass.
- `panel-keyboard-report.json` records four checks through collapsed/opened nested disclosures.
- `redesign-interaction-report.json` records native summary/button activation, MF after marking a detail, mobile clip containment and settled dark appearance.
- `report.json` records the complete legacy project flow rerun against the new interface, including transparent 4K PNG, text/logo, video, cancellation, reload and project package roundtrip.
- `redesign-photo.png` is a native 1280 × 720 export. `redesign-motion.mp4` is an actual silent 960 × 540, four-second export.

Taste Skill, Redesign and Minimalist UI were installed globally for Codex with the requested npx skills CLI. Their source is https://github.com/Leonxlnx/taste-skill. They supply design guidance and are not runtime dependencies of the app.
