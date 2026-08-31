'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COACH_PERSONALITIES,
  getSpeechTuning,
  selectDeterministicCoachPhrase,
} from '../../coach/index.ts';
import type {
  CoachIntent,
  CoachPersonalityId,
  FatigueZone,
  SpeechDelivery,
} from '../../coach/index.ts';
import { cleanGeneratedPhrase } from '../output.ts';
import { buildPhrasePrompt, PHRASE_PROMPT_VERSION } from '../prompts.ts';
import {
  addCandidate,
  deleteCandidate,
  deleteCandidatePack,
  rateCandidate,
  readCandidatePack,
} from '../storage.ts';
import type { CandidatePack } from '../storage.ts';
import { speakPhrasePreview } from '../speech.ts';
import type { PreviewUtterance, SpeechPreviewEnvironment } from '../speech.ts';
import {
  MENTRIA_MODEL_REVISION,
  MENTRIA_QUOTES_ADAPTER_SIZE_BYTES,
} from '../model/config.ts';
import type { ModelController } from '../model/model-controller.ts';
import type {
  MentriaStatus,
  ModelAdapter,
  PhraseCandidate,
  PhraseOperation,
} from '../types.ts';

const INTENTS: Array<[CoachIntent, string]> = [
  ['neutral', 'Neutral'],
  ['encourage', 'Encourage'],
  ['challenge', 'Challenge'],
  ['acknowledge', 'Acknowledge'],
];
const ZONES: Array<[FatigueZone, string]> = [
  ['fresh', 'Fresh'],
  ['settled', 'Settled'],
  ['challenging', 'Challenging'],
  ['finishing', 'Finishing'],
];
const DELIVERIES: Array<[SpeechDelivery, string]> = [
  ['contextual', 'Contextual'],
  ['phase', 'Phase cue'],
  ['countdown', 'Countdown'],
  ['message', 'Message'],
  ['preview', 'Preview'],
];

function candidateId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `candidate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function browserSpeechEnvironment(): SpeechPreviewEnvironment | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
  return {
    voices: () => window.speechSynthesis.getVoices(),
    createUtterance: (text) => new SpeechSynthesisUtterance(text) as unknown as PreviewUtterance,
    speak: (utterance) => window.speechSynthesis.speak(utterance as unknown as SpeechSynthesisUtterance),
    cancel: () => window.speechSynthesis.cancel(),
  };
}

export function PhraseVoiceStudio({ controller, status }: { controller: ModelController; status: MentriaStatus }) {
  const [customText, setCustomText] = useState('Stay steady. Finish the round.');
  const [personality, setPersonality] = useState<CoachPersonalityId>('focused');
  const [zone, setZone] = useState<FatigueZone>('fresh');
  const [intent, setIntent] = useState<CoachIntent>('encourage');
  const [delivery, setDelivery] = useState<SpeechDelivery>('contextual');
  const [voiceURI, setVoiceURI] = useState('');
  const initialTuning = getSpeechTuning(personality, delivery, intent);
  const [rate, setRate] = useState(initialTuning.rate);
  const [pitch, setPitch] = useState(initialTuning.pitch);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [operation, setOperation] = useState<PhraseOperation>('generate');
  const [desiredAdapter, setDesiredAdapter] = useState<ModelAdapter>('base');
  const [quoteConsent, setQuoteConsent] = useState(false);
  const [generated, setGenerated] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [candidateStatus, setCandidateStatus] = useState('');
  const [pack, setPack] = useState<CandidatePack>({ version: 1, candidates: [] });
  const streamRef = useRef('');

  const readyAdapter = status.kind === 'ready' ? status.adapter : status.kind === 'generating' ? desiredAdapter : null;
  const deterministicPhrase = useMemo(
    () => selectDeterministicCoachPhrase(personality, zone, intent).text,
    [intent, personality, zone],
  );

  useEffect(() => {
    window.queueMicrotask(() => setPack(readCandidatePack(window.localStorage)));
    const speech = browserSpeechEnvironment();
    if (!speech) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en')));
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', refresh);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (status.kind === 'ready') window.queueMicrotask(() => setDesiredAdapter(status.adapter));
  }, [status]);

  const applyTuning = (nextPersonality: CoachPersonalityId, nextDelivery: SpeechDelivery, nextIntent: CoachIntent) => {
    const tuning = getSpeechTuning(nextPersonality, nextDelivery, nextIntent);
    setRate(tuning.rate);
    setPitch(tuning.pitch);
  };

  const preview = (text: string) => {
    const environment = browserSpeechEnvironment();
    if (!environment) return;
    speakPhrasePreview(environment, text, { voiceURI, rate, pitch });
  };

  const selectAdapter = (adapter: ModelAdapter) => {
    setGenerationError('');
    if (adapter === 'quotes' && readyAdapter !== 'quotes') {
      setDesiredAdapter('quotes');
      setQuoteConsent(true);
      return;
    }
    setDesiredAdapter(adapter);
    setQuoteConsent(false);
    if (adapter === 'base' && readyAdapter === 'quotes') void controller.switchAdapter('base');
  };

  const approveQuoteAdapter = async () => {
    setQuoteConsent(false);
    const switched = await controller.switchAdapter('quotes');
    if (!switched) {
      setDesiredAdapter('base');
      setGenerationError('The quote LoRA could not be loaded. Retry the base model to continue.');
    }
  };

  const generate = async () => {
    if (status.kind !== 'ready') return;
    if ((operation === 'rewrite' || operation === 'alternatives') && !customText.trim()) {
      setGenerationError('Enter custom text before asking for a rewrite or alternative.');
      return;
    }
    if (status.adapter !== desiredAdapter) {
      setGenerationError('Finish switching the selected model before generating.');
      return;
    }
    setGenerationError('');
    setGenerated('');
    setCandidateStatus('');
    streamRef.current = '';
    const prompt = buildPhrasePrompt({ operation, personality, fatigueZone: zone, intent, customText });
    try {
      const result = await controller.generate(
        { prompt, maxTokens: 72, temperature: desiredAdapter === 'quotes' ? 0.82 : 0.72 },
        (token) => { streamRef.current += token; },
      );
      const cleaned = cleanGeneratedPhrase(result.text || streamRef.current);
      if (!cleaned.ok) {
        setGenerationError(cleaned.error);
        return;
      }
      setGenerated(cleaned.text);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setGenerationError('Generation stopped. You can retry.');
      } else {
        setGenerationError(error instanceof Error ? error.message : 'Generation failed. Try again.');
      }
    }
  };

  const saveCandidate = () => {
    if (!generated) return;
    const candidate: PhraseCandidate = {
      id: candidateId(),
      text: generated,
      personality,
      fatigueZone: zone,
      intent,
      delivery,
      adapter: desiredAdapter,
      modelRevision: MENTRIA_MODEL_REVISION,
      promptVersion: PHRASE_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
    };
    const result = addCandidate(window.localStorage, pack, candidate);
    setPack(result.pack);
    setCandidateStatus(result.error === 'duplicate'
      ? 'That normalized phrase is already in the candidate pack.'
      : result.error === 'storage'
        ? 'The phrase is still visible, but this device could not persist it.'
        : result.error
          ? 'This candidate could not be saved.'
          : 'Saved as an experimental candidate. It will not be used in workouts.');
  };

  const exportPack = () => {
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pulse-labs-phrase-candidates.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearPack = () => {
    if (!window.confirm('Delete all experimental phrase candidates? This does not delete the model or any timers.')) return;
    if (deleteCandidatePack(window.localStorage)) {
      setPack({ version: 1, candidates: [] });
      setCandidateStatus('Candidate pack deleted.');
    } else {
      setCandidateStatus('The candidate pack could not be deleted on this device.');
    }
  };

  return (
    <section className="labs-panel phrase-studio" aria-labelledby="phrase-studio-title">
      <div className="labs-panel-heading">
        <div><p className="eyebrow">EXPERIMENT 01</p><h2 id="phrase-studio-title">Phrase &amp; Voice Studio</h2></div>
        <span className="labs-status-chip">experimental</span>
      </div>
      <p className="labs-note">Mentria generates text. Your existing system Speech Synthesis voices speak previews. Saved candidates stay separate from production workout phrases.</p>

      <label className="labs-field">
        <span>Custom phrase</span>
        <textarea value={customText} maxLength={220} rows={3} onChange={(event) => setCustomText(event.target.value)} />
      </label>
      <div className="labs-actions">
        <button className="labs-primary-button" disabled={!customText.trim() || !browserSpeechEnvironment()} onClick={() => preview(customText)}>Preview custom phrase</button>
        {!browserSpeechEnvironment() && <span className="labs-inline-error">Speech Synthesis is unavailable in this browser.</span>}
      </div>

      <div className="labs-control-grid">
        <label className="labs-field"><span>Personality</span><select value={personality} onChange={(event) => { const next = event.target.value as CoachPersonalityId; setPersonality(next); applyTuning(next, delivery, intent); }}>{Object.values(COACH_PERSONALITIES).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="labs-field"><span>Fatigue zone</span><select value={zone} onChange={(event) => setZone(event.target.value as FatigueZone)}>{ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="labs-field"><span>Intent</span><select value={intent} onChange={(event) => { const next = event.target.value as CoachIntent; setIntent(next); applyTuning(personality, delivery, next); }}>{INTENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="labs-field"><span>Delivery</span><select value={delivery} onChange={(event) => { const next = event.target.value as SpeechDelivery; setDelivery(next); applyTuning(personality, next, intent); }}>{DELIVERIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="labs-field"><span>System voice</span><select value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)}><option value="">Automatic</option>{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></label>
        <label className="labs-field"><span>Operation</span><select value={operation} onChange={(event) => setOperation(event.target.value as PhraseOperation)}><option value="generate">Generate new</option><option value="rewrite">Rewrite custom text</option><option value="alternatives">Generate alternative</option></select></label>
      </div>

      <div className="labs-slider-grid">
        <label className="labs-range"><span>Rate <output>{rate.toFixed(2)}</output></span><input type="range" min="0.5" max="2" step="0.01" value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label>
        <label className="labs-range"><span>Pitch <output>{pitch.toFixed(2)}</output></span><input type="range" min="0" max="2" step="0.01" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} /></label>
      </div>

      <fieldset className="labs-adapter-choice">
        <legend>Model style</legend>
        <label><input type="radio" name="labs-adapter" checked={desiredAdapter === 'base'} onChange={() => selectAdapter('base')} /> Base model</label>
        <label><input type="radio" name="labs-adapter" checked={desiredAdapter === 'quotes'} onChange={() => selectAdapter('quotes')} /> Quote LoRA</label>
      </fieldset>

      {quoteConsent && (
        <div className="labs-consent" role="group" aria-labelledby="quote-consent-title">
          <h3 id="quote-consent-title">Download the quote LoRA?</h3>
          <p>This optional adapter adds approximately {Math.round(MENTRIA_QUOTES_ADAPTER_SIZE_BYTES / 1_048_576)} MB. Pulse will fetch only its pinned config and weights and cache them locally.</p>
          <div className="labs-actions"><button className="labs-primary-button" disabled={status.kind !== 'ready'} onClick={() => { void approveQuoteAdapter(); }}>Download and switch</button><button className="labs-secondary-button" onClick={() => { setQuoteConsent(false); setDesiredAdapter(readyAdapter ?? 'base'); }}>Cancel</button></div>
        </div>
      )}

      <div className="labs-actions">
        <button className="labs-primary-button" disabled={status.kind !== 'ready' || quoteConsent} onClick={() => { void generate(); }}>{operation === 'generate' ? 'Generate phrase' : operation === 'rewrite' ? 'Rewrite phrase' : 'Generate alternative'}</button>
        {status.kind === 'generating' && <button className="labs-secondary-button" onClick={() => controller.cancelGeneration()}>Stop</button>}
      </div>
      {generationError && <p className="labs-inline-error" role="alert">{generationError}</p>}

      {generated && (
        <article className="labs-result" aria-labelledby="generated-phrase-title">
          <small id="generated-phrase-title">MENTRIA-GENERATED CANDIDATE</small>
          <p>{generated}</p>
          <div className="labs-actions"><button className="labs-secondary-button" onClick={() => preview(generated)}>Preview</button><button className="labs-primary-button" onClick={saveCandidate}>Save candidate</button></div>
          <small>Model {MENTRIA_MODEL_REVISION.slice(0, 12)} · prompt v{PHRASE_PROMPT_VERSION} · {desiredAdapter}</small>
        </article>
      )}

      <article className="labs-result deterministic-result" aria-labelledby="deterministic-phrase-title">
        <small id="deterministic-phrase-title">CURRENT DETERMINISTIC PULSE PHRASE</small>
        <p>{deterministicPhrase}</p>
        <button className="labs-secondary-button" onClick={() => preview(deterministicPhrase)}>Preview production comparison</button>
      </article>

      <div className="candidate-heading"><div><h3>Experimental candidate pack</h3><p>{pack.candidates.length} saved locally · never used in real workouts</p></div><div className="labs-actions"><button className="labs-secondary-button" disabled={pack.candidates.length === 0} onClick={exportPack}>Export</button><button className="labs-danger-button" disabled={pack.candidates.length === 0} onClick={clearPack}>Delete pack</button></div></div>
      {candidateStatus && <p className="labs-status-copy" role="status">{candidateStatus}</p>}
      <div className="candidate-list">
        {pack.candidates.map((candidate) => (
          <article className="candidate-card" key={candidate.id}>
            <p>{candidate.text}</p>
            <small>{candidate.personality} · {candidate.fatigueZone} · {candidate.intent} · {candidate.adapter} · {new Date(candidate.createdAt).toLocaleString()}</small>
            <div className="labs-actions">
              <button className="labs-secondary-button" aria-pressed={candidate.rating === 'helpful'} onClick={() => { const result = rateCandidate(window.localStorage, pack, candidate.id, 'helpful'); setPack(result.pack); }}>Helpful</button>
              <button className="labs-secondary-button" aria-pressed={candidate.rating === 'not-helpful'} onClick={() => { const result = rateCandidate(window.localStorage, pack, candidate.id, 'not-helpful'); setPack(result.pack); }}>Not helpful</button>
              <button className="labs-danger-button" onClick={() => { const result = deleteCandidate(window.localStorage, pack, candidate.id); setPack(result.pack); }}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
