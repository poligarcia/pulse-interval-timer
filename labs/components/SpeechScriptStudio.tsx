'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseSpeechScript, compileSpeechScript } from '../../coach/speech-script.ts';
import type { SpeechScript } from '../../coach/speech-script.ts';
import type { ScriptHandle } from '../../coach/speech-director.ts';

export type SpeechStudioProps = {
  speechEngineEnabled: boolean;
  onSpeechEngineChange: (enabled: boolean) => void;
  voices: readonly SpeechSynthesisVoice[];
  locale: string;
  onStopSpeech: () => void;
  onPreviewScript: (script: SpeechScript, voiceURI: string, deadlineMs: number) => ScriptHandle | null;
};

const PRESETS = {
  en: [
    'FINAL ROUND[[pause:450]][[rate:+0.12]][[pitch:-0.03]]BEGIN!',
    'STATUS?[[pause:600]]Eighteen seconds remain. Continue.',
    'Stay steady.[[pause:350]][[rate:-0.12]][[volume:*0.7]]Take your time.[[reset]][[pause:350]][[rate:+0.12]]BEGIN!',
    'Rehearsal.[[pause:350]]Five[[pause:450]]Four[[pause:450]]Three[[pause:450]]Two[[pause:450]]NEGATIVE. That was rehearsal. Continue.',
  ],
  es: [
    'ÚLTIMA RONDA[[pause:450]][[rate:+0.12]][[pitch:-0.03]]¡EMPEZÁ!',
    '¿ESTADO?[[pause:600]]Quedan dieciocho segundos. Seguí.',
    'Mantené el ritmo.[[pause:350]][[rate:-0.12]][[volume:*0.7]]Tomate tu tiempo.[[reset]][[pause:350]][[rate:+0.12]]¡EMPEZÁ!',
    'Ensayo.[[pause:350]]Cinco[[pause:450]]Cuatro[[pause:450]]Tres[[pause:450]]Dos[[pause:450]]NEGATIVO. Era un ensayo. Seguí.',
  ],
  pt: [
    'ÚLTIMA RODADA[[pause:450]][[rate:+0.12]][[pitch:-0.03]]COMECE!',
    'STATUS?[[pause:600]]Restam dezoito segundos. Continue.',
    'Mantenha o ritmo.[[pause:350]][[rate:-0.12]][[volume:*0.7]]Vá com calma.[[reset]][[pause:350]][[rate:+0.12]]COMECE!',
    'Ensaio.[[pause:350]]Cinco[[pause:450]]Quatro[[pause:450]]Três[[pause:450]]Dois[[pause:450]]NEGATIVO. Era um ensaio. Continue.',
  ],
};

export function SpeechScriptStudio({ speechEngineEnabled, onSpeechEngineChange, voices, locale, onStopSpeech, onPreviewScript }: SpeechStudioProps) {
  const language = locale.split('-')[0];
  const presets = PRESETS[language as keyof typeof PRESETS] ?? PRESETS.en;
  const [source, setSource] = useState(presets[0]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [deadline, setDeadline] = useState(20);
  const [status, setStatus] = useState('Ready');
  const [active, setActive] = useState(false);
  const handleRef = useRef<ScriptHandle | null>(null);
  const compatible = voices.filter((voice) => voice.lang.split('-')[0].toLowerCase() === language.toLowerCase());
  const selected = compatible.find((voice) => voice.voiceURI === voiceURI) ?? compatible.find((voice) => voice.localService);
  const parsed = useMemo(() => parseSpeechScript(source, { id: 'labs-preview', rate, pitch }), [source, rate, pitch]);
  const plan = parsed.ok ? compileSpeechScript(parsed.script) : parsed;

  useEffect(() => () => { handleRef.current?.cancel(); }, []);

  const preview = () => {
    if (!speechEngineEnabled || !parsed.ok || !selected) return;
    handleRef.current?.cancel();
    const handle = onPreviewScript(parsed.script, selected.voiceURI, deadline * 1000);
    handleRef.current = handle;
    setActive(Boolean(handle));
    setStatus(handle ? 'Playing script…' : 'Speech is unavailable.');
    if (handle) void handle.done.then((outcome) => {
      if (handleRef.current !== handle) return;
      handleRef.current = null;
      setActive(false);
      setStatus(`${outcome.status}${outcome.reason ? `: ${outcome.reason}` : ''}`);
    });
  };

  return <section className="labs-panel" aria-labelledby="speech-script-title">
    <div className="labs-panel-heading"><h2 id="speech-script-title">Speech scripts</h2><span className="labs-status-chip">Experimental</span></div>
    <p className="labs-note">Add deliberate pauses and delivery changes using this device&apos;s voices. When enabled, workouts also use the script engine with countdown priority. No model download is needed.</p>
    <label className="speech-engine-toggle"><input type="checkbox" checked={speechEngineEnabled} onChange={(event) => onSpeechEngineChange(event.target.checked)} /> Use experimental speech engine</label>
    <p className="labs-fine-print">Saved on this device. The workout voice-coach switch still controls workout speech. Hiding Labs turns this experiment off.</p>
    <fieldset className="speech-script-controls" disabled={!speechEngineEnabled}>
      <legend className="visually-hidden">Speech script preview</legend>
      <div className="labs-actions">{['Two-part command', 'Status cue', 'Delivery changes', 'Rehearsal countdown'].map((name, index) =>
        <button key={name} className="labs-secondary-button" onClick={() => setSource(presets[index])}>{name}</button>)}</div>
      <label className="labs-field">Script<textarea rows={6} maxLength={8000} value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} /></label>
      <p className="labs-fine-print">Commands: <code>{'[[pause:450]] [[rate:+0.12]] [[pitch:-0.03]] [[volume:*0.7]] [[reset]]'}</code>. Rate and pitch offsets replace the current offset. Punctuation stays natural. Escape a literal opening command with <code>{'\\[['}</code>.</p>
      <label className="labs-field">System voice<select value={selected?.voiceURI ?? ''} onChange={(event) => setVoiceURI(event.target.value)}>
        {!selected && <option value="">Choose an available voice</option>}
        {compatible.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? ' · offline' : ' · may need internet'}</option>)}
      </select></label>
      <div className="labs-slider-grid">
        <label className="labs-range"><span>Base rate <output>{rate.toFixed(2)}</output></span><input aria-label="Script base rate" type="range" min="0.8" max="1.3" step="0.01" value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label>
        <label className="labs-range"><span>Base pitch <output>{pitch.toFixed(2)}</output></span><input aria-label="Script base pitch" type="range" min="0.8" max="1.2" step="0.01" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} /></label>
        <label className="labs-range"><span>Stop after <output>{deadline}s</output></span><input aria-label="Script stop after seconds" type="range" min="1" max="30" step="1" value={deadline} onChange={(event) => setDeadline(Number(event.target.value))} /></label>
      </div>
      {!parsed.ok && <p className="labs-inline-error" role="alert">{parsed.error}</p>}
      <div className="labs-actions"><button className="labs-primary-button" disabled={!parsed.ok || !selected} onClick={preview}>{active ? 'Restart preview' : 'Play script'}</button><button className="labs-secondary-button" onClick={onStopSpeech}>Stop speech</button></div>
      <p className="labs-status-copy" role="status" aria-live="polite">{status}</p>
      {plan.ok && <details><summary>Script steps ({plan.steps.length})</summary><ol className="speech-script-steps">{plan.steps.map((step, index) => <li key={index}>{step.kind === 'pause' ? `Pause ${step.ms} ms` : `${step.text} — rate ${step.rate.toFixed(2)}, pitch ${step.pitch.toFixed(2)}, volume ${Math.round(step.volumeScale * 100)}% of master`}</li>)}</ol></details>}
    </fieldset>
    <p className="labs-fine-print">Pauses add a minimum wait; the next voice start can take longer. Preview volume respects Settings. Edited scripts and rehearsal numbers stay in this studio; they do not replace workout phrases.</p>
  </section>;
}
