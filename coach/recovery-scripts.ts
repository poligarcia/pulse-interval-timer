import { BRAND_COACH_NAME } from '../branding.ts';
import type { Locale } from '../i18n/locales.ts';
import type { CoachPersonalityId, CoachSpeech } from './types.ts';
import type { DisplayMessageKind } from './display-messages.ts';
import { flatSpeechScript } from './speech-script.ts';
import type { SpeechScript, SpeechStyle } from './speech-script.ts';

type ThoughtPair = readonly [string, string];
type RecoveryCopy = { rest: readonly [ThoughtPair, ThoughtPair]; cooldown: ThoughtPair };

// Original Laptiva copy. Boundaries are authored per language, never inferred from punctuation.
const COPY: Record<Locale, Record<CoachPersonalityId, RecoveryCopy>> = {
  en: {
    focused: {
      rest: [['Relax your shoulders.', 'Use this rest to reset.'], ['One round at a time.', 'Let your breathing settle.']],
      cooldown: ['The work is done.', 'Notice one thing you did well today.'],
    },
    energetic: {
      rest: [['That round counts!', 'Take a breath. Recharge for the next one.'], ['Nice effort!', 'Enjoy this recovery. You have earned it.']],
      cooldown: ['Look at what you finished!', 'Ease down and take that confidence with you.'],
    },
    tough: {
      rest: [['Recovery is part of the work.', 'Give it your attention.'], ['That round is done.', 'Reset your focus for the next one.']],
      cooldown: ['Work done.', 'Release the effort. Keep the discipline.'],
    },
    calm: {
      rest: [['Let your shoulders soften.', 'Give your breathing time to settle.'], ['There is no hurry in this moment.', 'Take this rest at your own pace.']],
      cooldown: ['You can let the effort go now.', 'Take a quiet moment to notice how you feel.'],
    },
  },
  'es-AR': {
    focused: {
      rest: [['Aflojá los hombros.', 'Usá este descanso para acomodarte.'], ['Una ronda a la vez.', 'Dejá que se calme la respiración.']],
      cooldown: ['El trabajo ya está hecho.', 'Reconocé algo que te salió bien hoy.'],
    },
    energetic: {
      rest: [['¡Una ronda más!', 'Tomate un respiro. Recargá para la próxima.'], ['¡Buen esfuerzo!', 'Disfrutá esta recuperación. Te la ganaste.']],
      cooldown: ['¡Mirá todo lo que terminaste!', 'Bajá el ritmo y llevate esa confianza.'],
    },
    tough: {
      rest: [['Recuperar es parte del trabajo.', 'Dale tu atención.'], ['Esa ronda ya terminó.', 'Ordená el foco para la próxima.']],
      cooldown: ['Trabajo terminado.', 'Soltá el esfuerzo. Conservá la disciplina.'],
    },
    calm: {
      rest: [['Dejá caer la tensión de los hombros.', 'Dale tiempo a tu respiración.'], ['En este momento no hay apuro.', 'Descansá a tu ritmo.']],
      cooldown: ['Ya podés soltar el esfuerzo.', 'Tomate un momento para notar cómo te sentís.'],
    },
  },
  'pt-BR': {
    focused: {
      rest: [['Relaxe os ombros.', 'Use este descanso para se recompor.'], ['Uma rodada de cada vez.', 'Deixe a respiração se acalmar.']],
      cooldown: ['O trabalho está feito.', 'Reconheça algo que você fez bem hoje.'],
    },
    energetic: {
      rest: [['Mais uma rodada concluída!', 'Respire um pouco. Recarregue para a próxima.'], ['Belo esforço!', 'Aproveite a recuperação. Você merece.']],
      cooldown: ['Olhe tudo o que você terminou!', 'Reduza o ritmo e leve essa confiança com você.'],
    },
    tough: {
      rest: [['Recuperar também é trabalho.', 'Dê atenção a isso.'], ['Essa rodada acabou.', 'Reorganize o foco para a próxima.']],
      cooldown: ['Trabalho feito.', 'Solte o esforço. Mantenha a disciplina.'],
    },
    calm: {
      rest: [['Deixe os ombros relaxarem.', 'Dê tempo à sua respiração.'], ['Não há pressa neste momento.', 'Descanse no seu ritmo.']],
      cooldown: ['Você já pode soltar o esforço.', 'Reserve um momento para perceber como se sente.'],
    },
  },
};

export const RECOVERY_DELIVERY: Record<CoachPersonalityId, { pauseMs: number; lead: SpeechStyle; closing: SpeechStyle; minimumBudgetMs: number }> = {
  focused: { pauseMs: 450, lead: {}, closing: { rateDelta: -.04, volumeScale: .95 }, minimumBudgetMs: 6500 },
  energetic: { pauseMs: 400, lead: { rateDelta: .03, pitchDelta: .02 }, closing: { rateDelta: -.07, volumeScale: .95 }, minimumBudgetMs: 7000 },
  tough: { pauseMs: 500, lead: { pitchDelta: -.02 }, closing: { rateDelta: -.03, volumeScale: .95 }, minimumBudgetMs: 6500 },
  calm: { pauseMs: 700, lead: { rateDelta: -.03, volumeScale: .95 }, closing: { rateDelta: -.07, pitchDelta: -.02, volumeScale: .9 }, minimumBudgetMs: 8500 },
};

export function recoveryMessages(locale: Locale, personality: CoachPersonalityId, kind: DisplayMessageKind) {
  const copy = COPY[locale][personality];
  const pairs = kind === 'motivation' ? copy.rest : [copy.cooldown];
  return pairs.map((parts, index) => ({
    id: `delivery-${locale}-${personality}-${kind}-${index}`,
    text: parts.join(' '), author: BRAND_COACH_NAME, parts,
  }));
}

export function recoverySpeechScript(speech: CoachSpeech, personality: CoachPersonalityId, locale: Locale): { script: SpeechScript; minimumBudgetMs: number } {
  const message = (['motivation', 'aspiration'] as const).flatMap((kind) => recoveryMessages(locale, personality, kind))
    .find((candidate) => `display-${candidate.id}` === speech.id && candidate.text === speech.text);
  if (!message) return { script: flatSpeechScript(speech), minimumBudgetMs: 0 };
  const delivery = RECOVERY_DELIVERY[personality];
  return {
    minimumBudgetMs: delivery.minimumBudgetMs,
    script: { ...flatSpeechScript(speech), segments: [
      { kind: 'text', text: message.parts[0], style: delivery.lead },
      { kind: 'pause', ms: delivery.pauseMs },
      { kind: 'text', text: message.parts[1], style: delivery.closing },
    ] },
  };
}
