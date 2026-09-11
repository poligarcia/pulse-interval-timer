import type { PhaseKind } from '../coach/types.ts';
import type { ScheduledAudioHandle } from './audio-scheduler.ts';

export type DrillSound = PhaseKind | 'complete' | 'unlock';
export const DRILL_SOUNDS: Record<DrillSound, { count: number; duration: number; gap: number; from: number; to: number }> = {
  prepare: { count: 1, duration: .16, gap: .12, from: 3060, to: 3200 },
  work: { count: 1, duration: .24, gap: .12, from: 3130, to: 3280 },
  rest: { count: 2, duration: .13, gap: .10, from: 3030, to: 3180 },
  cycleRest: { count: 1, duration: .38, gap: .12, from: 3050, to: 3200 },
  cooldown: { count: 2, duration: .16, gap: .12, from: 2960, to: 3110 },
  complete: { count: 3, duration: .12, gap: .09, from: 3130, to: 3280 },
  unlock: { count: 2, duration: .05, gap: .06, from: 3060, to: 3200 },
};

const breathBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function breathBuffer(context: BaseAudioContext) {
  const cached = breathBuffers.get(context);
  if (cached) return cached;
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  // Local deterministic noise: do not consume the coach planner's random source.
  let seed = 0x6d2b79f5;
  for (let i = 0; i < samples.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    samples[i] = (seed >>> 0) / 2147483648 - 1;
  }
  breathBuffers.set(context, buffer);
  return buffer;
}

/** A blown, fluttering whistle rather than a sliding electronic beep. Layered
 * resonances and filtered breath share one short envelope. Timing stays fixed
 * so the cue still clears the reserved speech window. No downloaded assets. */
export function scheduleDrillWhistle(context: BaseAudioContext, kind: DrillSound, at: number, volume: number): ScheduledAudioHandle {
  const cue = DRILL_SOUNDS[kind];
  const start = Math.max(at, context.currentTime + .005);
  const endsAt = start + cue.count * cue.duration + (cue.count - 1) * cue.gap + .02;
  const level = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
  if (!level) return { endsAt, cancel() {} };
  const sources: AudioScheduledSourceNode[] = [];
  for (let i = 0; i < cue.count; i++) {
    const time = start + i * (cue.duration + cue.gap);
    const end = time + cue.duration;
    const envelope = context.createGain();
    const flutterGain = context.createGain();
    const flutter = context.createOscillator();
    const depth = context.createGain();
    const nodes: AudioNode[] = [envelope, flutterGain, flutter, depth];
    flutter.frequency.setValueAtTime(34 + i * 3, time);
    flutter.frequency.linearRampToValueAtTime(43 + i * 3, end);
    // Amplitude flutter, not a wide pitch glide. Keep gain in [0.44, 1].
    flutterGain.gain.value = .72;
    depth.gain.value = .28;
    flutter.connect(depth); depth.connect(flutterGain.gain);
    flutterGain.connect(envelope); envelope.connect(context.destination);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level * .095, time + .012);
    envelope.gain.setValueAtTime(level * .095, end - Math.min(.035, cue.duration * .3));
    envelope.gain.linearRampToValueAtTime(0, end);

    const blastSources: AudioScheduledSourceNode[] = [flutter];
    for (const [ratio, weight] of [[1, .62], [1.19, .25], [2.01, .06]]) {
      const oscillator = context.createOscillator();
      const mix = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(cue.from * ratio, time);
      oscillator.frequency.linearRampToValueAtTime(cue.to * ratio, time + .018);
      oscillator.frequency.linearRampToValueAtTime((cue.to - 20) * ratio, end);
      mix.gain.value = weight;
      oscillator.connect(mix); mix.connect(flutterGain);
      nodes.push(oscillator, mix); blastSources.push(oscillator);
    }

    const breath = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const breathGain = context.createGain();
    breath.buffer = breathBuffer(context);
    breath.loop = true;
    filter.type = 'bandpass'; filter.frequency.value = 3600; filter.Q.value = .8;
    breathGain.gain.value = .18;
    breath.connect(filter); filter.connect(breathGain); breathGain.connect(flutterGain);
    nodes.push(breath, filter, breathGain); blastSources.push(breath);

    let remaining = blastSources.length;
    for (const source of blastSources) {
      source.addEventListener('ended', () => {
        if (--remaining === 0) for (const node of nodes) node.disconnect();
      }, { once: true });
      source.start(time);
      source.stop(end + .02);
    }
    sources.push(...blastSources);
  }
  return { endsAt, cancel: () => { for (const source of sources) { try { source.stop(); } catch { /* Already stopped. */ } } } };
}
