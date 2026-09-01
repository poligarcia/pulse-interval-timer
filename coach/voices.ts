import type { Locale } from '../i18n/locales.ts';
import type {
  ActiveCoach,
  CoachPersonalityId,
  SystemVoiceLike,
  VoiceGender,
  VoicePreference,
  VoiceProfile,
} from './types.ts';

const RECOMMENDED_VOICE_PROFILES: VoiceProfile[] = [
  { name: 'Samantha', gender: 'female', recommended: true },
  { name: 'Ava', gender: 'female', recommended: true },
  { name: 'Allison', gender: 'female', recommended: true },
  { name: 'Susan', gender: 'female', recommended: true },
  { name: 'Victoria', gender: 'female', recommended: true },
  { name: 'Karen', gender: 'female', recommended: true },
  { name: 'Moira', gender: 'female', recommended: true },
  { name: 'Tessa', gender: 'female', recommended: true },
  { name: 'Fiona', gender: 'female', recommended: true },
  { name: 'Alex', gender: 'male', recommended: true },
  { name: 'Daniel', gender: 'male', recommended: true },
  { name: 'Aaron', gender: 'male', recommended: true },
  { name: 'Arthur', gender: 'male', recommended: true },
  { name: 'Rishi', gender: 'male', recommended: true },
  { name: 'Oliver', gender: 'male', recommended: true },
  { name: 'Microsoft Zira', gender: 'female', recommended: true },
  { name: 'Microsoft Jenny', gender: 'female', recommended: true },
  { name: 'Microsoft Aria', gender: 'female', recommended: true },
  { name: 'Microsoft Sonia', gender: 'female', recommended: true },
  { name: 'Microsoft David', gender: 'male', recommended: true },
  { name: 'Microsoft Mark', gender: 'male', recommended: true },
  { name: 'Microsoft Ryan', gender: 'male', recommended: true },
  { name: 'Microsoft Guy', gender: 'male', recommended: true },
  { name: 'Google US English', recommended: true },
  { name: 'Google UK English Female', gender: 'female', recommended: true },
  { name: 'Google UK English Male', gender: 'male', recommended: true },
  { name: 'Mónica', gender: 'female', recommended: true },
  { name: 'Paulina', gender: 'female', recommended: true },
  { name: 'Soledad', gender: 'female', recommended: true },
  { name: 'Jorge', gender: 'male', recommended: true },
  { name: 'Juan', gender: 'male', recommended: true },
  { name: 'Diego', gender: 'male', recommended: true },
  { name: 'Luciana', gender: 'female', recommended: true },
  { name: 'Joana', gender: 'female', recommended: true },
  { name: 'Francisca', gender: 'female', recommended: true },
  { name: 'Felipe', gender: 'male', recommended: true },
  { name: 'Joaquim', gender: 'male', recommended: true },
  { name: 'Antônio', gender: 'male', recommended: true },
];

const NOVELTY_VOICE_NAMES = [
  'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged',
  'Good News', 'Hysterical', 'Jester', 'Junior', 'Kathy', 'Organ', 'Princess',
  'Superhero', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox',
];

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function nameMatches(actual: string, catalogName: string) {
  const normalizedActual = normalizedName(actual);
  const normalizedCatalog = normalizedName(catalogName);
  return normalizedActual === normalizedCatalog
    || normalizedActual.startsWith(`${normalizedCatalog} (`)
    || normalizedActual.startsWith(`${normalizedCatalog} -`);
}

export function classifyVoice(voice: SystemVoiceLike): VoiceProfile {
  const noveltyName = NOVELTY_VOICE_NAMES.find((name) => nameMatches(voice.name, name));
  if (noveltyName) return { name: noveltyName, recommended: false, novelty: true };

  const known = RECOMMENDED_VOICE_PROFILES.find((profile) => nameMatches(voice.name, profile.name));
  if (known) return known;
  return { name: voice.name, recommended: false };
}

export type CuratedVoice<T extends SystemVoiceLike = SystemVoiceLike> = {
  voice: T;
  profile: VoiceProfile;
};

export function speechLanguageForLocale(locale: Locale) {
  return locale === 'en' ? 'en-US' : locale;
}

function voiceLanguageFamily(locale: Locale) {
  return speechLanguageForLocale(locale).split('-')[0].toLocaleLowerCase();
}

export function curateVoices<T extends SystemVoiceLike>(voices: T[], locale: Locale = 'en'): CuratedVoice<T>[] {
  const family = voiceLanguageFamily(locale);
  return voices
    .filter((voice) => voice.lang.toLocaleLowerCase().split('-')[0] === family)
    .map((voice) => ({ voice, profile: classifyVoice(voice) }));
}

type ActiveCoachInput<T extends SystemVoiceLike> = {
  voices: T[];
  personality: CoachPersonalityId;
  preference: VoicePreference;
  selectedVoiceURI: string;
  previousAutomaticVoiceURI?: string;
  locale?: Locale;
  random?: () => number;
};

function matchesGender(gender: VoiceGender | undefined, preference: VoicePreference) {
  return preference === 'either' || gender === preference;
}

export function resolveActiveCoach<T extends SystemVoiceLike>({
  voices,
  personality,
  preference,
  selectedVoiceURI,
  previousAutomaticVoiceURI,
  locale = 'en',
  random = Math.random,
}: ActiveCoachInput<T>): ActiveCoach {
  const curated = curateVoices(voices, locale);
  const manualVoice = curated.find(({ voice }) => voice.voiceURI === selectedVoiceURI);
  if (selectedVoiceURI && manualVoice) return { personality, voiceURI: manualVoice.voice.voiceURI };

  const normalVoices = curated.filter(({ profile }) => !profile.novelty);
  const recommended = normalVoices.filter(({ profile }) => profile.recommended);
  const pools = [
    recommended.filter(({ profile }) => matchesGender(profile.gender, preference)),
    recommended,
    normalVoices.filter(({ profile }) => matchesGender(profile.gender, preference)),
    normalVoices,
    curated,
  ];
  let pool = pools.find((candidate) => candidate.length > 0) ?? [];
  const withoutPrevious = pool.filter(({ voice }) => voice.voiceURI !== previousAutomaticVoiceURI);
  if (withoutPrevious.length > 0) pool = withoutPrevious;

  const selected = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { personality, voiceURI: selected?.voice.voiceURI ?? '' };
}
