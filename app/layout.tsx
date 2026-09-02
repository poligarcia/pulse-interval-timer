import type { Metadata, Viewport } from 'next';
import { SplashScreen } from '@/components/SplashScreen';
import { BRAND_NAME } from '@/branding';
import { LocaleProvider } from '@/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Interval Timer`,
  description: 'Custom interval workouts with rounds, cycles, progress, reminders, and offline support.',
  applicationName: BRAND_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND_NAME,
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: `${BRAND_NAME} — Interval Timer`,
    description: 'Make every second count with custom interval workouts.',
    url: 'https://poligarcia.github.io/pulse-interval-timer/',
    siteName: BRAND_NAME,
    images: [{
      url: 'https://poligarcia.github.io/pulse-interval-timer/og.png',
      width: 1672,
      height: 941,
      alt: `${BRAND_NAME} Interval Timer`,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_NAME} — Interval Timer`,
    description: 'Make every second count with custom interval workouts.',
    images: ['https://poligarcia.github.io/pulse-interval-timer/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#121416',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link id="pulse-manifest" rel="manifest" href="./manifest.webmanifest" />
        <link rel="icon" type="image/png" href="./favicon.png" />
        <link rel="apple-touch-icon" href="./icons/icon-180.png" />
      </head>
      <body>
        <LocaleProvider>
          {children}
          <SplashScreen />
        </LocaleProvider>
      </body>
    </html>
  );
}
