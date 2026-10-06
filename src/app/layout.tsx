import type { Metadata } from 'next';
import localFont from 'next/font/local';
// Only tokens and component styles: the app uses no Radix layout or utility props.
import '@radix-ui/themes/tokens.css';
import '@radix-ui/themes/components.css';
import './globals.css';
import './sidebar.css';
import './controls.css';
import './video.css';
import './studio.css';
import './whirl.css';
import './polish.css';
const inter = localFont({
  src: '../fonts/InterVariable.woff2',
  variable: '--font-studio',
  display: 'swap',
  weight: '100 900',
});
export const metadata: Metadata = {
  title: 'Project Camera',
  description: 'A local photo and motion studio for software interfaces.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
