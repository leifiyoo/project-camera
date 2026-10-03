import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@radix-ui/themes/styles.css';
import './globals.css';
import './sidebar.css';
import './controls.css';
import './video.css';
const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-studio',
  display: 'swap',
  weight: '100 900',
});
export const metadata: Metadata = {
  title: 'Interface Studio',
  description: 'A local photo and motion studio for software interfaces.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
