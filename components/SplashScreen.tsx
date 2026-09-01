'use client';

import { useEffect, useState } from 'react';
import { getMessages, useLocale } from '@/i18n';

const SPLASH_EXIT_DELAY_MS = 1350;
const SPLASH_REMOVE_DELAY_MS = 1850;
const REDUCED_MOTION_EXIT_DELAY_MS = 80;
const REDUCED_MOTION_REMOVE_DELAY_MS = 180;

export function SplashScreen() {
  const { locale } = useLocale();
  const copy = getMessages(locale);
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitDelay = prefersReducedMotion
      ? REDUCED_MOTION_EXIT_DELAY_MS
      : SPLASH_EXIT_DELAY_MS;
    const removeDelay = prefersReducedMotion
      ? REDUCED_MOTION_REMOVE_DELAY_MS
      : SPLASH_REMOVE_DELAY_MS;

    const exitTimer = window.setTimeout(() => setIsExiting(true), exitDelay);
    const removeTimer = window.setTimeout(() => setIsVisible(false), removeDelay);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`splash-screen${isExiting ? ' is-exiting' : ''}`}
      role="status"
      aria-label={copy.shell.openingPulse}
    >
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-content">
        <div className="splash-brand" aria-hidden="true">
          <span className="splash-mark">
            <span>P</span>
            <i />
          </span>
          <strong>Pulse</strong>
        </div>
        <div className="splash-pulse" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>
        <p>{copy.shell.splashTagline}</p>
      </div>
    </div>
  );
}
