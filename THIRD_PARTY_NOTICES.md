# Third-party notices

Project Camera is licensed under the [GNU General Public License v3.0](LICENSE). It includes the
following third-party work, which remains under its own license.

## Inter

`public/fonts/InterVariable-4.001.woff2` is the Inter typeface, Copyright 2016 The Inter Project
Authors, licensed under the SIL Open Font License 1.1. The full license is in
[`public/fonts/OFL.txt`](public/fonts/OFL.txt). `public/fonts/InterVariable-4.001-latin.woff2` is a
subset of it with only the Latin characters, made with
[fonttools](https://github.com/fonttools/fonttools):

```sh
pyftsubset public/fonts/InterVariable-4.001.woff2 --flavor=woff2 \
  --output-file=public/fonts/InterVariable-4.001-latin.woff2 \
  --layout-features+=tnum,pnum,case,zero,sups,subs,sinf,ordn \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-21FF,U+2212,U+2215,U+2300-23FF,U+FEFF,U+FFFD"
```

Keep `--unicodes` in step with the `unicode-range` rules in `src/app/fonts.css`.

## Bundled dependencies

The published website bundles these npm packages. Each keeps its own license, which ships with the
package in `node_modules/<name>/`.

| Package                                     | License |
| ------------------------------------------- | ------- |
| Next.js, React, React DOM                   | MIT     |
| Three.js                                    | MIT     |
| Mediabunny                                  | MPL-2.0 |
| Radix UI Themes, Radix UI Primitives        | MIT     |
| Tabler Icons                                | MIT     |
| Zustand, Immer, Zod, fflate, react-colorful | MIT     |
| idb                                         | ISC     |
| Tailwind CSS (base styles)                  | MIT     |

Mediabunny is used unmodified. Its source code is available at
<https://github.com/Vanilagy/mediabunny>.
