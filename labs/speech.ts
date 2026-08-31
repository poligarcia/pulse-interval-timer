export type PreviewVoice = {
  voiceURI: string;
  lang: string;
};

export type PreviewUtterance = {
  voice: PreviewVoice | null;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
};

export type SpeechPreviewEnvironment = {
  voices: () => PreviewVoice[];
  createUtterance: (text: string) => PreviewUtterance;
  speak: (utterance: PreviewUtterance) => void;
  cancel: () => void;
};

export function speakPhrasePreview(
  environment: SpeechPreviewEnvironment,
  text: string,
  options: { voiceURI: string; rate: number; pitch: number; volume?: number },
): PreviewUtterance | null {
  const phrase = text.trim();
  if (!phrase) return null;
  environment.cancel();
  const utterance = environment.createUtterance(phrase);
  const voice = environment.voices().find((candidate) => candidate.voiceURI === options.voiceURI) ?? null;
  utterance.voice = voice;
  utterance.lang = voice?.lang ?? 'en-US';
  utterance.rate = Math.min(2, Math.max(0.5, options.rate));
  utterance.pitch = Math.min(2, Math.max(0, options.pitch));
  utterance.volume = Math.min(1, Math.max(0, options.volume ?? 1));
  environment.speak(utterance);
  return utterance;
}
