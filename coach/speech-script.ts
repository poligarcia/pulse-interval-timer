import type { CoachSpeech } from './types.ts';

export type SpeechStyle = { rateDelta?: number; pitchDelta?: number; volumeScale?: number };
export type SpeechSegment =
  | { kind: 'text'; text: string; style?: SpeechStyle }
  | { kind: 'pause'; ms: number }
  | { kind: 'set'; style: SpeechStyle }
  | { kind: 'reset'; fields?: readonly ('rate' | 'pitch' | 'volume')[] };
export type SpeechScript = { id: string; rate: number; pitch: number; segments: readonly SpeechSegment[] };
export type SpeechStep =
  | { kind: 'speak'; text: string; rate: number; pitch: number; volumeScale: number }
  | { kind: 'pause'; ms: number };
export type SpeechCompilation = { ok: true; steps: SpeechStep[] } | { ok: false; error: string };
export const SPEECH_SCRIPT_LIMITS = { text: 4000, steps: 32, pause: 5000, totalPause: 15000 };
export const clampSpeech = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function flatSpeechScript(speech: CoachSpeech): SpeechScript {
  return { id: speech.id, rate: speech.rate, pitch: speech.pitch, segments: [{ kind: 'text', text: speech.text }] };
}

export function compileSpeechScript(script: SpeechScript): SpeechCompilation {
  if (!Number.isFinite(script.rate) || !Number.isFinite(script.pitch) || script.segments.length > 128) return { ok: false, error: 'Invalid script settings or too many segments.' };
  let style: Required<SpeechStyle> = { rateDelta: 0, pitchDelta: 0, volumeScale: 1 };
  let length = 0;
  let pauses = 0;
  const steps: SpeechStep[] = [];
  const validStyle = (patch: SpeechStyle) => Object.entries(patch).every(([key, value]) =>
    ['rateDelta', 'pitchDelta', 'volumeScale'].includes(key) && Number.isFinite(value)
    && (key !== 'volumeScale' || (value >= 0 && value <= 1)));
  for (const segment of script.segments) {
    if (segment.kind === 'set') {
      if (!validStyle(segment.style)) return { ok: false, error: 'Invalid delivery setting.' };
      style = { ...style, ...segment.style };
    } else if (segment.kind === 'reset') {
      for (const field of segment.fields ?? ['rate', 'pitch', 'volume']) {
        if (field === 'rate') style.rateDelta = 0;
        else if (field === 'pitch') style.pitchDelta = 0;
        else if (field === 'volume') style.volumeScale = 1;
        else return { ok: false, error: 'Unknown reset field.' };
      }
    } else if (segment.kind === 'pause') {
      if (!Number.isFinite(segment.ms) || segment.ms < 0 || segment.ms > SPEECH_SCRIPT_LIMITS.pause) return { ok: false, error: 'Pauses must be between 0 and 5000 ms.' };
      pauses += segment.ms;
      if (segment.ms > 0) steps.push({ ...segment });
    } else if (segment.kind === 'text') {
      if (!segment.text.trim() || !validStyle(segment.style ?? {})) return { ok: false, error: 'Text segments must contain text and valid settings.' };
      length += segment.text.length;
      const effective = { ...style, ...segment.style };
      steps.push({ kind: 'speak', text: segment.text.trim(), rate: clampSpeech(script.rate + effective.rateDelta, 0.8, 1.3), pitch: clampSpeech(script.pitch + effective.pitchDelta, 0.8, 1.2), volumeScale: effective.volumeScale });
    } else return { ok: false, error: 'Unknown segment.' };
  }
  if (length > SPEECH_SCRIPT_LIMITS.text || steps.length > SPEECH_SCRIPT_LIMITS.steps || pauses > SPEECH_SCRIPT_LIMITS.totalPause) return { ok: false, error: 'Script exceeds the text, step, or pause limit.' };
  if (!steps.some((step) => step.kind === 'speak')) return { ok: false, error: 'Add some text to speak.' };
  return { ok: true, steps };
}

/** Only explicitly authored scripts enter this parser. Plain coach text never does. */
export function parseSpeechScript(source: string, base = { id: 'labs-script', rate: 1, pitch: 1 }): { ok: true; script: SpeechScript } | { ok: false; error: string } {
  if (source.length > 8000) return { ok: false, error: 'Script is too long.' };
  const segments: SpeechSegment[] = [];
  let buffer = '';
  const flush = () => { if (buffer.trim()) segments.push({ kind: 'text', text: buffer }); buffer = ''; };
  for (let i = 0; i < source.length;) {
    if (source.startsWith('\\[[', i)) { buffer += '[['; i += 3; continue; }
    if (source.startsWith('\\\\', i)) { buffer += '\\'; i += 2; continue; }
    if (!source.startsWith('[[', i)) { buffer += source[i++]; continue; }
    flush();
    const end = source.indexOf(']]', i + 2);
    if (end < 0) return { ok: false, error: 'Unclosed command.' };
    const command = source.slice(i + 2, end);
    const pause = /^pause:(\d+)$/.exec(command);
    const setting = /^(rate|pitch):([+-]\d+(?:\.\d+)?)$/.exec(command);
    const volume = /^volume:\*(\d+(?:\.\d+)?)$/.exec(command);
    const reset = /^reset(?::((?:rate|pitch|volume)(?:,(?:rate|pitch|volume))*))?$/.exec(command);
    if (pause) segments.push({ kind: 'pause', ms: Number(pause[1]) });
    else if (setting) segments.push({ kind: 'set', style: { [setting[1] === 'rate' ? 'rateDelta' : 'pitchDelta']: Number(setting[2]) } });
    else if (volume) segments.push({ kind: 'set', style: { volumeScale: Number(volume[1]) } });
    else if (reset) segments.push({ kind: 'reset', fields: reset[1]?.split(',') as ('rate' | 'pitch' | 'volume')[] | undefined });
    else return { ok: false, error: `Unknown or malformed command: ${command.slice(0, 60)}` };
    i = end + 2;
  }
  flush();
  const script = { ...base, segments };
  const compiled = compileSpeechScript(script);
  return compiled.ok ? { ok: true, script } : compiled;
}

/** Admission estimate only: native synthesis has no duration guarantee. */
export function estimateSpeechBudget(steps: readonly SpeechStep[]): number {
  return steps.reduce((total, step) => total + (step.kind === 'pause' ? step.ms : 600 + Math.max(1, step.text.split(/\s+/).length) * 450 / step.rate), 0);
}
