import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL('/', site.url).href,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      images: [new URL('/opengraph-image.jpg', site.url).href],
    },
  ];
}
