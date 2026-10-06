# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub:
**Security → Report a vulnerability** on this repository. Do not open a public issue.

Include the affected version or commit, steps to reproduce and the impact you expect. You should
get a first response within a week.

## Security model

- Project Camera is a static website. It has no backend, no accounts and no stored secrets.
- Media and projects stay in the visitor's browser (IndexedDB) and are never uploaded.
- Imported SVG files are sanitized before use, and project ZIP files are validated against a schema.
- The production build ships a Content Security Policy that blocks third-party scripts, connections
  and framing (`scripts/csp.mjs`, `public/_headers`, `vercel.json`).

Only the latest version on the `main` branch receives security fixes.
