'use client';

import { useEffect, useRef, useState } from 'react';
import { BRAND_NAME } from '../../branding.ts';
import { ModelController } from '../model/model-controller.ts';
import { MentriaTextModel } from '../model/mentria-client.ts';
import type { MentriaStatus } from '../types.ts';
import { ModelManager } from './ModelManager.tsx';
import { PhraseVoiceStudio } from './PhraseVoiceStudio.tsx';
import { SpeechScriptStudio } from './SpeechScriptStudio.tsx';
import type { SpeechStudioProps } from './SpeechScriptStudio.tsx';

export default function LaptivaLabsScreen({ onBack, onHideLabs, ...speech }: { onBack: () => void; onHideLabs: () => void } & SpeechStudioProps) {
  const [controller] = useState(() => new ModelController(new MentriaTextModel()));
  const [status, setStatus] = useState<MentriaStatus>(controller.status);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { onStopSpeech } = speech;

  useEffect(() => {
    const unsubscribe = controller.subscribe(setStatus);
    void controller.initialize();
    headingRef.current?.focus();
    return () => {
      unsubscribe();
      onStopSpeech();
      window.speechSynthesis?.cancel();
      void controller.dispose();
    };
  }, [controller, onStopSpeech]);

  return (
    <main className="app-shell labs-screen">
      <header className="screen-header labs-header">
        <button className="text-button muted" onClick={onBack}>Back</button>
        <div className="header-title"><span className="eyebrow">EXPERIMENTAL</span><strong>{BRAND_NAME} Labs</strong></div>
        <span aria-hidden="true" />
      </header>
      <section className="labs-content">
        <div className="labs-intro">
          <p className="eyebrow dark">LOCAL-FIRST EXPERIMENTS</p>
          <h1 ref={headingRef} tabIndex={-1}>{BRAND_NAME} Labs</h1>
          <p>Explore speech delivery and local text generation. Choose which experiments to enable on this device.</p>
        </div>
        <SpeechScriptStudio {...speech} />
        <ModelManager controller={controller} status={status} />
        <PhraseVoiceStudio controller={controller} status={status} onBeforePreview={speech.onStopSpeech} />
        <section className="labs-panel labs-privacy" aria-labelledby="labs-privacy-title">
          <h2 id="labs-privacy-title">Local by default</h2>
          <p>Prompts, generated phrases, ratings, and saved candidates stay in this browser unless you explicitly export a candidate pack.</p>
          <button className="labs-secondary-button" onClick={onHideLabs}>Hide {BRAND_NAME} Labs</button>
          <p className="labs-fine-print">Hiding disables experimental speech, removes the Settings entry, and resets the seven-tap unlock. It does not delete cached model assets or candidate phrases.</p>
        </section>
      </section>
    </main>
  );
}
