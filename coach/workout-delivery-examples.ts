import type { Locale } from '../i18n/locales.ts';
import type { CoachPersonalityId } from './types.ts';
import { selectPhaseSpeech } from './personalities.ts';
import { makeDisplayMessageSpeech } from './display-messages.ts';
import { recoveryMessages } from './recovery-scripts.ts';
import { phaseAnnouncementScript, speechBudgetMs } from './workout-speech.ts';
import { compileSpeechScript } from './speech-script.ts';
import type { SpeechScript } from './speech-script.ts';

/** The studio loads the same scripts as workouts, not a second hand-maintained demo. */
export function workoutDeliveryExamples(personality: CoachPersonalityId, locale: Locale) {
  const context = { round: 2, cycle: 1, isFinalRound: true, isFinalCycle: true };
  const rest = selectPhaseSpeech(personality, 'rest', context, locale);
  const cooldown = selectPhaseSpeech(personality, 'cooldown', context, locale);
  const entries = [
    { label: 'Final round', phase: selectPhaseSpeech(personality, 'work', context, locale) },
    { label: 'Cycle rest', phase: selectPhaseSpeech(personality, 'cycleRest', context, locale) },
    ...recoveryMessages(locale, personality, 'motivation').map((message, index) => ({
      label: `Recovery ${index + 1}`, phase: rest, followUp: makeDisplayMessageSpeech(personality, 'motivation', message),
    })),
    { label: 'Cooldown', phase: cooldown, followUp: makeDisplayMessageSpeech(personality, 'aspiration', recoveryMessages(locale, personality, 'aspiration')[0]) },
  ];
  return entries.map((entry) => {
    const script = phaseAnnouncementScript(entry.phase, personality, locale, 30000, 'followUp' in entry ? entry.followUp : undefined)!;
    return { label: entry.label, script, estimatedMs: speechBudgetMs(script) };
  });
}

/** Authoring convenience only. Flattened settings make every segment independent. */
export function speechScriptMarkup(script: SpeechScript): string {
  const compiled = compileSpeechScript(script);
  if (!compiled.ok) return '';
  const signed = (number: number) => `${number >= 0 ? '+' : ''}${number.toFixed(3)}`;
  return compiled.steps.map((step) => step.kind === 'pause' ? `[[pause:${step.ms}]]` :
    `[[rate:${signed(step.rate - script.rate)}]][[pitch:${signed(step.pitch - script.pitch)}]][[volume:*${step.volumeScale}]]${step.text.replaceAll('\\', '\\\\').replaceAll('[[', '\\[[')}`,
  ).join('');
}
