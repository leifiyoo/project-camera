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
  // Leads with the search terms: the name alone doesn't say what the site does.
  title: 'Free 3D Screenshot Mockup Generator | Project Camera',
  description:
    'Turn screenshots into 3D mockups and product shots with perspective, depth blur, shadows and backgrounds. Export PNGs up to 4K. Free, no upload, no watermark.',
  repository: 'https://github.com/leifiyoo/project-camera',
} as const;
