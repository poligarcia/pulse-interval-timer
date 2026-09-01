import type { Metadata, Viewport } from 'next';
import { SplashScreen } from '@/components/SplashScreen';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pulse — Interval Timer',
  description: 'Custom interval workouts with rounds, cycles and offline support.',
  applicationName: 'Pulse',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pulse',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'Pulse — Interval Timer',
    description: 'Make every second count with custom interval workouts.',
    url: 'https://poligarcia.github.io/pulse-interval-timer/',
    siteName: 'Pulse',
    images: [{
      url: 'https://poligarcia.github.io/pulse-interval-timer/og.png',
      width: 1672,
      height: 941,
      alt: 'Pulse Interval Timer',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pulse — Interval Timer',
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
        <link rel="manifest" href="./manifest.webmanifest" />
        <link rel="icon" type="image/png" href="./favicon.png" />
        <link rel="apple-touch-icon" href="./icons/icon-180.png" />
      </head>
      <body>
        {children}
        <SplashScreen />
      </body>
    </html>
  );
}
