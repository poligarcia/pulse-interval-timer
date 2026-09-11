'use client';
import { useEffect, useRef, useState } from 'react';

export function DrillUnlock({ enabled, unlocked, selected, label, helper, onSurprise, onUnlock, onSelect, onCue }: {
  enabled: boolean; unlocked: boolean; selected: boolean; label: string; helper: string;
  onSurprise: () => void; onUnlock: () => void; onSelect: () => void; onCue: () => void;
}) {
  const [taps, setTaps] = useState(0);
  const count = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!taps) return;
    const timeout = window.setTimeout(() => { count.current = 0; setTaps(0); }, 3000);
    return () => window.clearTimeout(timeout);
  }, [taps]);
  useEffect(() => {
    if (!enabled) { count.current = 0; dialog.current?.close(); }
  }, [enabled]);
  return <>
    <button type="button" className={`surprise-personality ${enabled && unlocked ? 'drill-shared-row' : ''} ${selected ? 'selected' : ''} ${enabled && taps >= 4 ? 'drill-unlock-hint' : ''}`}
      aria-pressed={selected} onClick={() => {
        onSurprise();
        if (!enabled || unlocked) return;
        const next = ++count.current;
        setTaps(next);
        if (next >= 4) navigator.vibrate?.(next === 7 ? [35, 40, 35] : 15 + (next - 4) * 10);
        if (next === 6) onCue();
        if (next >= 7) { onUnlock(); dialog.current?.showModal(); count.current = 0; setTaps(0); }
      }}>
      <strong>{enabled && taps === 6 ? 'RESTRICTED' : label}</strong><small>{enabled && taps >= 5 ? 'Authorization check in progress…' : helper}</small>
    </button>
    <dialog ref={dialog} className="drill-reveal" aria-labelledby="drill-reveal-title" aria-describedby="drill-reveal-copy">
      <p className="drill-classified">CLASSIFIED COACH UNLOCKED</p>
      <h2 id="drill-reveal-title">Drill Instructor</h2>
      <p id="drill-reveal-copy">Confrontational commands and occasional mind games. The on-screen timer is always correct. Workout timing never changes.</p>
      <p>Sharp pain or dizziness? Stand down. That is an order.</p>
      <div><button type="button" onClick={() => { dialog.current?.close(); onSelect(); }}>REPORT FOR DUTY</button>
        <button type="button" onClick={() => dialog.current?.close()}>Not now</button></div>
    </dialog>
  </>;
}
