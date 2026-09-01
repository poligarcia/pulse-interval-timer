import type { Locale } from '../i18n/locales.ts';
import type { CoachPersonalityId, PhaseKind } from './types.ts';

export type CoachCueKey = PhaseKind | 'complete' | 'finalWork';

type PersonalityPresentation = { label: string; description: string };

const PERSONALITY_PRESENTATION: Record<Locale, Record<CoachPersonalityId, PersonalityPresentation>> = {
  en: {
    focused: { label: 'Focused', description: 'Precise, concise, and steady' },
    energetic: { label: 'Energetic', description: 'Upbeat, responsive, and positive' },
    tough: { label: 'Tough', description: 'Direct, demanding, and composed' },
    calm: { label: 'Calm', description: 'Measured, grounded, and supportive' },
  },
  'es-AR': {
    focused: { label: 'Enfocado', description: 'Preciso, conciso y constante' },
    energetic: { label: 'Enérgico', description: 'Animado, atento y positivo' },
    tough: { label: 'Exigente', description: 'Directo, firme y sereno' },
    calm: { label: 'Calmo', description: 'Pausado, centrado y comprensivo' },
  },
  'pt-BR': {
    focused: { label: 'Focado', description: 'Preciso, conciso e constante' },
    energetic: { label: 'Energético', description: 'Animado, atento e positivo' },
    tough: { label: 'Exigente', description: 'Direto, firme e sereno' },
    calm: { label: 'Calmo', description: 'Tranquilo, centrado e acolhedor' },
  },
};

const ES_PHASE_CUES: Record<CoachPersonalityId, Record<CoachCueKey, string[]>> = {
  focused: {
    prepare: ['Preparate.'], work: ['Empezá.', 'Trabajá.'], finalWork: ['Última ronda. Empezá.'],
    rest: ['Descansá.', 'Recuperá.'], cycleRest: ['Descanso entre ciclos. Reiniciá.'],
    cooldown: ['Volvé a la calma.'], complete: ['Entrenamiento completado.'],
  },
  energetic: {
    prepare: ['¡Preparate!'], work: ['¡Dale!', '¡Vamos!'], finalWork: ['¡La última! ¡Dale!'],
    rest: ['Recuperá.', 'Aprovechá el descanso.'], cycleRest: ['Descanso entre ciclos. Reiniciá.'],
    cooldown: ['Bajá el ritmo. Respirá.'], complete: ['¡Entrenamiento completado! ¡Muy bien!'],
  },
  tough: {
    prepare: ['Preparate.'], work: ['Dale.', 'Trabajá.'], finalWork: ['Última ronda. Dale.'],
    rest: ['Descansá.', 'Recuperá.'], cycleRest: ['Descanso entre ciclos. Reiniciá.'],
    cooldown: ['Bajá el ritmo.'], complete: ['Entrenamiento completado. Trabajo terminado.'],
  },
  calm: {
    prepare: ['Preparate.'], work: ['Empezá.', 'Comenzá.'], finalWork: ['Última ronda. Empezá.'],
    rest: ['Descansá.', 'Recuperá.'], cycleRest: ['Descanso entre ciclos. Reiniciá.'],
    cooldown: ['Volvé a la calma. Respirá.'], complete: ['Entrenamiento completado. Tomate un respiro.'],
  },
};

const PT_PHASE_CUES: Record<CoachPersonalityId, Record<CoachCueKey, string[]>> = {
  focused: {
    prepare: ['Prepare-se.'], work: ['Comece.', 'Trabalhe.'], finalWork: ['Última rodada. Comece.'],
    rest: ['Descanse.', 'Recupere-se.'], cycleRest: ['Descanso entre ciclos. Reinicie.'],
    cooldown: ['Volte à calma.'], complete: ['Treino concluído.'],
  },
  energetic: {
    prepare: ['Prepare-se!'], work: ['Vamos!', 'Comece!'], finalWork: ['A última! Vamos!'],
    rest: ['Recupere-se.', 'Aproveite o descanso.'], cycleRest: ['Descanso entre ciclos. Reinicie.'],
    cooldown: ['Reduza o ritmo. Respire.'], complete: ['Treino concluído! Muito bem!'],
  },
  tough: {
    prepare: ['Prepare-se.'], work: ['Vamos.', 'Trabalhe.'], finalWork: ['Última rodada. Vamos.'],
    rest: ['Descanse.', 'Recupere-se.'], cycleRest: ['Descanso entre ciclos. Reinicie.'],
    cooldown: ['Reduza o ritmo.'], complete: ['Treino concluído. Trabalho feito.'],
  },
  calm: {
    prepare: ['Prepare-se.'], work: ['Comece.', 'Inicie.'], finalWork: ['Última rodada. Comece.'],
    rest: ['Descanse.', 'Recupere-se.'], cycleRest: ['Descanso entre ciclos. Reinicie.'],
    cooldown: ['Volte à calma. Respire.'], complete: ['Treino concluído. Respire fundo.'],
  },
};

const ES_PHRASES: Record<string, string> = {
  'focused-find-pace': 'Encontrá tu ritmo.',
  'focused-controlled': 'Bien, con control.',
  'focused-settle': 'Acomodate al esfuerzo.',
  'focused-consistent': 'Mantené la constancia.',
  'focused-rhythm': 'Sostené el ritmo.',
  'focused-hold': 'Bien. Mantenelo.',
  'focused-pace-slip': 'No dejes caer el ritmo.',
  'focused-keep-working': 'Seguí trabajando.',
  'focused-stay-with-it': 'Seguí así.',
  'focused-finish-round': 'Terminá la ronda.',
  'focused-last-seconds': 'Últimos segundos. Aguantá.',
  'focused-no-save': 'No te guardes nada ahora.',
  'energetic-find-rhythm': 'Encontrá tu ritmo.',
  'energetic-controlled': 'Suave y con control.',
  'energetic-set-pace': 'Marcá el ritmo. Podés hacerlo.',
  'energetic-stay-me': '¡Seguí conmigo!',
  'energetic-rhythm': '¡Eso es! ¡Mantené el ritmo!',
  'energetic-keep-moving': '¡Seguí moviéndote!',
  'energetic-work': '¡Seguí trabajando!',
  'energetic-dont-drop': '¡Seguí así! ¡No bajes el ritmo!',
  'energetic-now': 'Este es el esfuerzo. ¡Seguí conmigo!',
  'energetic-everything': '¡La última! ¡Dalo todo!',
  'energetic-finish': '¡Terminá con fuerza! ¡Vamos!',
  'energetic-hold': '¡Últimos segundos! ¡Aguantá!',
  'tough-control': 'Controlá el ritmo.',
  'tough-settle': 'Acomodate. Seguí trabajando.',
  'tough-no-rush': 'Sin apuro. Sin desperdiciar esfuerzo.',
  'tough-consistent': 'Mantené la constancia.',
  'tough-standard': 'Sostené el nivel.',
  'tough-good-work': 'Bien. Seguí trabajando.',
  'tough-coast': 'No aflojes ahora.',
  'tough-hard': 'Acá se pone difícil. Seguí trabajando.',
  'tough-stay': 'Seguí así.',
  'tough-started': 'Terminá lo que empezaste.',
  'tough-give-away': 'No regales estos últimos segundos.',
  'tough-finish-round': 'Terminá la ronda.',
  'calm-rhythm': 'Encontrá tu ritmo.',
  'calm-controlled': 'Mantené un movimiento suave y controlado.',
  'calm-settle': 'Acomodate al esfuerzo.',
  'calm-steady': 'Mantenete estable.',
  'calm-pace': 'Sostené el ritmo.',
  'calm-hold': 'Bien. Mantené ese ritmo.',
  'calm-present': 'Quedate presente. Seguí trabajando.',
  'calm-dont-slip': 'No dejes que se pierda el ritmo.',
  'calm-with-it': 'Seguí así.',
  'calm-finish': 'Terminá la ronda. Mantenete estable.',
  'calm-last': 'Últimos segundos. Aguantá.',
  'calm-complete': 'Completá el trabajo que empezaste.',
};

const PT_PHRASES: Record<string, string> = {
  'focused-find-pace': 'Encontre seu ritmo.',
  'focused-controlled': 'Muito bem, com controle.',
  'focused-settle': 'Encontre conforto no esforço.',
  'focused-consistent': 'Mantenha a consistência.',
  'focused-rhythm': 'Mantenha o ritmo.',
  'focused-hold': 'Muito bem. Sustente.',
  'focused-pace-slip': 'Não deixe o ritmo cair.',
  'focused-keep-working': 'Continue trabalhando.',
  'focused-stay-with-it': 'Continue assim.',
  'focused-finish-round': 'Termine a rodada.',
  'focused-last-seconds': 'Últimos segundos. Sustente.',
  'focused-no-save': 'Não guarde nada agora.',
  'energetic-find-rhythm': 'Encontre seu ritmo.',
  'energetic-controlled': 'Suave e com controle.',
  'energetic-set-pace': 'Marque o ritmo. Você consegue.',
  'energetic-stay-me': 'Continue comigo!',
  'energetic-rhythm': 'É isso! Mantenha o ritmo!',
  'energetic-keep-moving': 'Continue em movimento!',
  'energetic-work': 'Continue trabalhando!',
  'energetic-dont-drop': 'Continue assim! Não reduza o ritmo!',
  'energetic-now': 'Este é o esforço. Continue comigo!',
  'energetic-everything': 'A última! Dê tudo de si!',
  'energetic-finish': 'Termine com força! Vamos!',
  'energetic-hold': 'Últimos segundos! Sustente!',
  'tough-control': 'Controle o ritmo.',
  'tough-settle': 'Encontre o ritmo. Continue trabalhando.',
  'tough-no-rush': 'Sem pressa. Sem desperdiçar esforço.',
  'tough-consistent': 'Mantenha a consistência.',
  'tough-standard': 'Mantenha o padrão.',
  'tough-good-work': 'Muito bem. Continue trabalhando.',
  'tough-coast': 'Não relaxe agora.',
  'tough-hard': 'É aqui que fica difícil. Continue trabalhando.',
  'tough-stay': 'Continue assim.',
  'tough-started': 'Termine o que começou.',
  'tough-give-away': 'Não desperdice estes últimos segundos.',
  'tough-finish-round': 'Termine a rodada.',
  'calm-rhythm': 'Encontre seu ritmo.',
  'calm-controlled': 'Mantenha o movimento suave e controlado.',
  'calm-settle': 'Encontre conforto no esforço.',
  'calm-steady': 'Mantenha-se estável.',
  'calm-pace': 'Mantenha o ritmo.',
  'calm-hold': 'Muito bem. Mantenha esse ritmo.',
  'calm-present': 'Fique presente. Continue trabalhando.',
  'calm-dont-slip': 'Não deixe o ritmo escapar.',
  'calm-with-it': 'Continue assim.',
  'calm-finish': 'Termine a rodada. Mantenha-se estável.',
  'calm-last': 'Últimos segundos. Sustente.',
  'calm-complete': 'Conclua o trabalho que começou.',
};

const PREVIEWS: Record<Locale, Record<CoachPersonalityId, string>> = {
  en: {
    focused: 'Ready. Find your pace. Three, two, one. Start.',
    energetic: 'Ready! Stay with me. Three, two, one. Go!',
    tough: 'Ready. Keep working. Three, two, one. Go.',
    calm: 'Ready. Find your rhythm. Three, two, one. Begin.',
  },
  'es-AR': {
    focused: 'Listo. Encontrá tu ritmo. Tres, dos, uno. Empezá.',
    energetic: '¡Listo! Seguí conmigo. Tres, dos, uno. ¡Dale!',
    tough: 'Listo. Seguí trabajando. Tres, dos, uno. Dale.',
    calm: 'Listo. Encontrá tu ritmo. Tres, dos, uno. Empezá.',
  },
  'pt-BR': {
    focused: 'Pronto. Encontre seu ritmo. Três, dois, um. Comece.',
    energetic: 'Pronto! Continue comigo. Três, dois, um. Vamos!',
    tough: 'Pronto. Continue trabalhando. Três, dois, um. Vamos.',
    calm: 'Pronto. Encontre seu ritmo. Três, dois, um. Comece.',
  },
};

export function getCoachPersonalityPresentation(personality: CoachPersonalityId, locale: Locale) {
  return PERSONALITY_PRESENTATION[locale][personality];
}

export function localizeCoachPhaseCues(
  personality: CoachPersonalityId,
  cue: CoachCueKey,
  fallback: string[],
  locale: Locale,
) {
  if (locale === 'es-AR') return ES_PHASE_CUES[personality][cue];
  if (locale === 'pt-BR') return PT_PHASE_CUES[personality][cue];
  return fallback;
}

export function localizeCoachPhraseText(id: string, fallback: string, locale: Locale) {
  if (locale === 'es-AR') return ES_PHRASES[id] ?? fallback;
  if (locale === 'pt-BR') return PT_PHRASES[id] ?? fallback;
  return fallback;
}

export function getCoachPreview(personality: CoachPersonalityId, locale: Locale) {
  return PREVIEWS[locale][personality];
}
