'use client';

import { useEffect, useRef, useState } from 'react';
import { ModelController } from '../model/model-controller.ts';
import { MentriaTextModel } from '../model/mentria-client.ts';
import type { MentriaStatus } from '../types.ts';
import { ModelManager } from './ModelManager.tsx';
import { PhraseVoiceStudio } from './PhraseVoiceStudio.tsx';

export default function PulseLabsScreen({ onBack, onHideLabs }: { onBack: () => void; onHideLabs: () => void }) {
  const [controller] = useState(() => new ModelController(new MentriaTextModel()));
  const [status, setStatus] = useState<MentriaStatus>(controller.status);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setStatus);
    void controller.initialize();
    headingRef.current?.focus();
    return () => {
      unsubscribe();
      window.speechSynthesis?.cancel();
      void controller.dispose();
    };
  }, [controller]);

  return (
    <main className="app-shell labs-screen">
      <header className="screen-header labs-header">
        <button className="text-button muted" onClick={onBack}>Back</button>
        <div className="header-title"><span className="eyebrow">EXPERIMENTAL</span><strong>Pulse Labs</strong></div>
        <span aria-hidden="true" />
      </header>
      <section className="labs-content">
        <div className="labs-intro">
          <p className="eyebrow dark">LOCAL-FIRST EXPERIMENTS</p>
          <h1 ref={headingRef} tabIndex={-1}>Pulse Labs</h1>
          <p>Explore local text generation without placing AI in the timer. Static coaching phrases remain the production fallback.</p>
        </div>
        <ModelManager controller={controller} status={status} />
        <PhraseVoiceStudio controller={controller} status={status} />
        <section className="labs-panel labs-privacy" aria-labelledby="labs-privacy-title">
          <h2 id="labs-privacy-title">Local by default</h2>
          <p>Prompts, generated phrases, ratings, and saved candidates stay in this browser unless you explicitly export a candidate pack. Pulse adds no analytics or telemetry.</p>
          <button className="labs-secondary-button" onClick={onHideLabs}>Hide Pulse Labs</button>
          <p className="labs-fine-print">Hiding removes the Settings entry and resets the seven-tap unlock. It does not delete cached model assets or candidate phrases.</p>
        </section>
      </section>
    </main>
  );
}
