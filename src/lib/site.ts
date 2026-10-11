// Public facts about the site, shared by metadata, robots.txt, the sitemap and the manifest.
// The canonical origin comes from NEXT_PUBLIC_SITE_URL, or on Vercel from the production domain.
function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL('http://localhost:3000');
}

export const site = {
  name: 'Project Camera',
  url: resolveSiteUrl(),
  title: 'Project Camera: 3D product shots and UI mockups in your browser',
  description:
    'A free, private photo studio for product shots and UI mockups. Frame screenshots with a real 3D camera, add depth blur and shadows, and export PNGs up to 4K.',
  repository: 'https://github.com/leifiyoo/project-camera',
} as const;
