import type { Metadata } from 'next';
import Editor from '@/components/editor/Editor';
import Landing from '@/components/landing/Landing';

// Only the home page is canonical and indexable; the 404 page keeps Next.js's noindex.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export default function Page() {
  return <Editor landing={<Landing />} />;
}
