import type { Metadata, Viewport } from 'next';
import { preload } from 'react-dom';
import { Analytics } from '@vercel/analytics/next';
// Only tokens and component styles: the app uses no Radix layout or utility props. Of the
// color scales, it uses the blue accent and gray only.
import '@radix-ui/themes/tokens/colors/gray.css';
import '@radix-ui/themes/tokens/colors/blue.css';
import '@radix-ui/themes/tokens/base.css';
import '@radix-ui/themes/components.css';
import './fonts.css';
import './globals.css';
import './sidebar.css';
import './controls.css';
import './video.css';
import './studio.css';
import './whirl.css';
import './polish.css';
import { site } from '@/lib/site';
import showcase from '@/components/landing/showcase.webp';
export const metadata: Metadata = {
  metadataBase: site.url,
  title: { default: site.title, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: 'website',
    url: '/',
    siteName: site.name,
    title: site.title,
    description: site.description,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
  },
  category: 'design',
  verification: {
    google: 'ZK8Fr0Tf5CcvsUb7jVvZwDFyUHZGl6gOXFY7mddNpfo',
  },
};
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#19191c' },
  ],
};
// Structured data for search engines. `<` is escaped so the JSON can never close the script tag.
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': new URL('/#website', site.url).href,
      url: site.url.href,
      name: site.name,
      description: site.description,
      inLanguage: 'en',
    },
    {
      '@type': 'WebApplication',
      '@id': new URL('/#app', site.url).href,
      url: site.url.href,
      name: site.name,
      description: site.description,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Any',
      browserRequirements:
        'Requires JavaScript and WebGL. Works best in desktop Chrome, Edge or Safari.',
      image: new URL('/opengraph-image.jpg', site.url).href,
      screenshot: new URL(showcase.src, site.url).href,
      isAccessibleForFree: true,
      license: 'https://www.gnu.org/licenses/gpl-3.0.html',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        '3D camera with zoom, rotation and tilt',
        'Depth blur with manual or automatic focus',
        'Backgrounds, strokes, shadows, text and logos',
        'PNG export at HD, 2K, 4K or a custom size with transparency',
        'Runs entirely in the browser: no account, no uploads, no watermark',
      ],
      sameAs: [site.repository],
    },
  ],
}).replace(/</g, '\\u003c');
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The Latin face of Inter, declared in fonts.css. Other faces load only when needed.
  preload('/fonts/InterVariable-4.001-latin.woff2', {
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  });
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
