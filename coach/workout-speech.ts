import { compileSpeechScript, estimateSpeechBudget, flatSpeechScript } from './speech-script.ts';
import type { SpeechScript, SpeechSegment } from './speech-script.ts';
import { recoverySpeechScript } from './recovery-scripts.ts';
import type { CoachPersonalityId, CoachSpeech } from './types.ts';
import type { Locale } from '../i18n/locales.ts';

// Authored boundaries, never punctuation parsing. A copy change falls back to flat speech.
const FINAL_ROUND: Record<Locale, Record<CoachPersonalityId, readonly [string, string]>> = {
  en: { focused: ['Final round.', 'Start.'], energetic: ['Last one.', 'Go!'], tough: ['Last round.', 'Go.'], calm: ['Final round.', 'Begin.'] },
  'es-AR': { focused: ['Última ronda.', 'Empezá.'], energetic: ['¡La última!', '¡Dale!'], tough: ['Última ronda.', 'Dale.'], calm: ['Última ronda.', 'Empezá.'] },
  'pt-BR': { focused: ['Última rodada.', 'Comece.'], energetic: ['A última!', 'Vamos!'], tough: ['Última rodada.', 'Vamos.'], calm: ['Última rodada.', 'Comece.'] },
};

const CYCLE_REST: Record<Locale, readonly [string, string]> = {
  en: ['Cycle rest.', 'Reset.'], 'es-AR': ['Descanso entre ciclos.', 'Reiniciá.'], 'pt-BR': ['Descanso entre ciclos.', 'Reinicie.'],
};
const COOLDOWN: Record<Locale, Record<'energetic' | 'calm', readonly [string, string]>> = {
  en: { energetic: ['Cool down.', 'Breathe.'], calm: ['Cool down.', 'Breathe.'] },
  'es-AR': { energetic: ['Bajá el ritmo.', 'Respirá.'], calm: ['Volvé a la calma.', 'Respirá.'] },
  'pt-BR': { energetic: ['Reduza o ritmo.', 'Respire.'], calm: ['Volte à calma.', 'Respire.'] },
};

export function phaseSpeechScript(speech: CoachSpeech, personality: CoachPersonalityId, locale: Locale): SpeechScript {
  const script = flatSpeechScript(speech);
  const finalRound = speech.id === `${personality}-finalWork-0`;
  const parts = finalRound ? FINAL_ROUND[locale][personality]
    : speech.id === `${personality}-cycleRest-0` ? CYCLE_REST[locale]
      : speech.id === `${personality}-cooldown-0` && (personality === 'energetic' || personality === 'calm') ? COOLDOWN[locale][personality] : null;
  if (!parts || speech.text !== parts.join(' ')) return script;
  return { ...script, segments: [
    { kind: 'text', text: parts[0] }, { kind: 'pause', ms: finalRound ? 450 : personality === 'calm' ? 650 : 450 },
    { kind: 'text', text: parts[1], style: finalRound
      ? { rateDelta: personality === 'calm' ? .04 : .12, pitchDelta: -.03 }
      : { rateDelta: -.06, pitchDelta: -.02, volumeScale: .95 } },
  ] };
}

export function speechBudgetMs(script: SpeechScript) {
  const compiled = compileSpeechScript(script);
  return compiled.ok ? estimateSpeechBudget(compiled.steps) : Infinity;
}

/** Resolve each script's settings before combining; follow-ups never inherit cue emphasis. */
function appendFollowUp(phase: SpeechScript, followUp: SpeechScript): SpeechScript | null {
  const compiled = compileSpeechScript(followUp);
  if (!compiled.ok) return null;
  const segments: SpeechSegment[] = compiled.steps.map((step) => step.kind === 'pause' ? step : {
    kind: 'text', text: step.text,
    style: { rateDelta: step.rate - phase.rate, pitchDelta: step.pitch - phase.pitch, volumeScale: step.volumeScale },
  });
  return { ...phase, segments: [...phase.segments, { kind: 'pause', ms: 400 }, ...segments] };
}

/** Budget-driven variants: authored delivery, plain delivery, cue only, then silence.
 * Estimates decide admission only; the director still enforces the absolute cutoff.
 */
export function phaseAnnouncementScript(speech: CoachSpeech, personality: CoachPersonalityId, locale: Locale, availableMs: number, followUp?: CoachSpeech): SpeechScript | null {
  const plain = flatSpeechScript(speech);
  const authored = phaseSpeechScript(speech, personality, locale);
  const phase = speechBudgetMs(authored) < availableMs ? authored : plain;
  if (followUp) {
    const recovery = recoverySpeechScript(followUp, personality, locale);
    const full = appendFollowUp(phase, recovery.script);
    const minimum = speechBudgetMs(phase) + 400 + recovery.minimumBudgetMs;
    if (full && availableMs > Math.max(minimum, speechBudgetMs(full))) return full;
    const compact = appendFollowUp(plain, flatSpeechScript(followUp));
    if (compact && speechBudgetMs(compact) < availableMs) return compact;
  }
  if (speechBudgetMs(phase) < availableMs) return phase;
  return speechBudgetMs(plain) < availableMs ? plain : null;
}

export const workoutSpeechCutoff = (phaseEnd: number, countdown: boolean) => phaseEnd - (countdown ? 3250 : 250);

/** Pure scheduling policy. All timestamps come from the authoritative workout clock. */
export function workoutSpeechSchedule(script: SpeechScript, kind: 'phase' | 'countdown' | 'motivation', now: number, phaseEnd: number, countdown = true) {
  if (kind === 'countdown') {
    const nextBoundary = phaseEnd - Math.max(0, Math.ceil((phaseEnd - now) / 1000) - 1) * 1000;
    return { priority: 300, interrupt: true, mustStartByMs: Math.min(now + 600, nextBoundary - 100), mustFinishByMs: nextBoundary - 40 };
  }
  const cutoff = workoutSpeechCutoff(phaseEnd, countdown);
  if (kind === 'phase') return { priority: 400, interrupt: true, mustFinishByMs: Math.max(now, cutoff) };
  const compiled = compileSpeechScript(script);
  return { priority: 100, mustFinishByMs: cutoff, admissionBudgetMs: compiled.ok ? estimateSpeechBudget(compiled.steps) : Infinity };
}
