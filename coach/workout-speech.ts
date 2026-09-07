import { compileSpeechScript, estimateSpeechBudget, flatSpeechScript } from './speech-script.ts';
import type { SpeechScript } from './speech-script.ts';
import type { CoachPersonalityId, CoachSpeech } from './types.ts';
import type { Locale } from '../i18n/locales.ts';

// Authored boundaries, never punctuation parsing. A copy change falls back to flat speech.
const FINAL_ROUND: Record<Locale, Record<CoachPersonalityId, readonly [string, string]>> = {
  en: { focused: ['Final round.', 'Start.'], energetic: ['Last one.', 'Go!'], tough: ['Last round.', 'Go.'], calm: ['Final round.', 'Begin.'] },
  'es-AR': { focused: ['Última ronda.', 'Empezá.'], energetic: ['¡La última!', '¡Dale!'], tough: ['Última ronda.', 'Dale.'], calm: ['Última ronda.', 'Empezá.'] },
  'pt-BR': { focused: ['Última rodada.', 'Comece.'], energetic: ['A última!', 'Vamos!'], tough: ['Última rodada.', 'Vamos.'], calm: ['Última rodada.', 'Comece.'] },
};

export function phaseSpeechScript(speech: CoachSpeech, personality: CoachPersonalityId, locale: Locale): SpeechScript {
  const script = flatSpeechScript(speech);
  const parts = FINAL_ROUND[locale][personality];
  if (speech.id !== `${personality}-finalWork-0` || speech.text !== parts.join(' ')) return script;
  return { ...script, segments: [
    { kind: 'text', text: parts[0] }, { kind: 'pause', ms: 450 },
    { kind: 'text', text: parts[1], style: { rateDelta: personality === 'calm' ? .04 : .12, pitchDelta: -.03 } },
  ] };
}

/** Pure scheduling policy. All timestamps come from the authoritative workout clock. */
export function workoutSpeechSchedule(script: SpeechScript, kind: 'phase' | 'countdown' | 'motivation', now: number, phaseEnd: number, countdown = true) {
  if (kind === 'countdown') {
    const nextBoundary = phaseEnd - Math.max(0, Math.ceil((phaseEnd - now) / 1000) - 1) * 1000;
    return { priority: 300, interrupt: true, mustStartByMs: Math.min(now + 600, nextBoundary - 100), mustFinishByMs: nextBoundary - 40 };
  }
  const cutoff = phaseEnd - (countdown ? 3250 : 250);
  if (kind === 'phase') return { priority: 400, interrupt: true, mustFinishByMs: Math.max(now, cutoff) };
  const compiled = compileSpeechScript(script);
  return { priority: 100, mustFinishByMs: cutoff, admissionBudgetMs: compiled.ok ? estimateSpeechBudget(compiled.steps) : Infinity };
}
