import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import showcase from '@/components/landing/showcase.webp';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL('/', site.url).href,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      images: [
        new URL('/opengraph-image.jpg', site.url).href,
        new URL(showcase.src, site.url).href,
      ],
    },
  ];
}
