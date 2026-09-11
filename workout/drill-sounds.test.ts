import assert from 'node:assert/strict';
import test from 'node:test';
import { DRILL_SOUNDS, scheduleDrillWhistle } from './drill-sounds.ts';

class Param {
  value = 0;
  events: { value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.events.push({ value, time }); }
  linearRampToValueAtTime = this.setValueAtTime;
  exponentialRampToValueAtTime = this.setValueAtTime;
}
class Node extends EventTarget {
  type = '';
  frequency = new Param();
  gain = new Param();
  Q = new Param();
  buffer: unknown;
  loop = false;
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  disconnected = false;
  connect() {}
  disconnect() { this.disconnected = true; }
  start(time: number) { this.starts.push(time); }
  stop(time?: number) { this.stops.push(time); }
}

test('every whistle has bounded gain, exact scheduled spacing, cancellable nodes and cleanup', () => {
  for (const kind of Object.keys(DRILL_SOUNDS) as (keyof typeof DRILL_SOUNDS)[]) {
    const nodes: Node[] = [];
    const oscillators: Node[] = [];
    const gains: Node[] = [];
    const breaths: Node[] = [];
    const filters: Node[] = [];
    const make = (list: Node[]) => { const node = new Node(); nodes.push(node); list.push(node); return node; };
    const context = {
      currentTime: 10, sampleRate: 44100, destination: {},
      createOscillator: () => make(oscillators), createGain: () => make(gains),
      createBufferSource: () => make(breaths), createBiquadFilter: () => make(filters),
      createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    };
    const handle = scheduleDrillWhistle(context as unknown as AudioContext, kind, 11, .5);
    const cue = DRILL_SOUNDS[kind];
    assert.equal(oscillators.length, cue.count * 4);
    assert.equal(breaths.length, cue.count);
    assert.ok(handle.endsAt < 11.65);
    for (let i = 0; i < cue.count; i++) {
      const time = 11 + i * (cue.duration + cue.gap);
      for (const source of [...oscillators.slice(i * 4, (i + 1) * 4), breaths[i]]) assert.equal(source.starts[0], time);
      const tone = oscillators[i * 4 + 1];
      assert.equal(tone.type, 'sine');
      assert.ok(tone.frequency.events[1].value > 3000);
      assert.equal(tone.frequency.events[1].time, time + .018, 'pitch settles immediately, not a full-length chirp');
      assert.equal(filters[i].type, 'bandpass');
      assert.equal(breaths[i].loop, true);
      assert.equal(breaths[i].buffer, breaths[0].buffer, 'noise buffer reused across blasts');
    }
    const envelopes = gains.filter((gain) => gain.gain.events.length > 0);
    assert.equal(envelopes.length, cue.count);
    for (const envelope of envelopes) {
      assert.equal(Math.max(...envelope.gain.events.map((e) => e.value)), .5 * .095);
      assert.equal(envelope.gain.events.at(-1)?.value, 0);
    }
    handle.cancel();
    for (const source of [...oscillators, ...breaths]) {
      assert.equal(source.stops.at(-1), undefined);
      source.dispatchEvent(new Event('ended'));
    }
    assert.ok(nodes.every((node) => node.disconnected));
  }
});

test('zero, negative, or invalid volume creates no audio nodes', () => {
  for (const volume of [0, -1, NaN, Infinity]) {
    const handle = scheduleDrillWhistle({ currentTime: 0 } as BaseAudioContext, 'work', 0, volume);
    assert.ok(handle.endsAt > 0);
    handle.cancel();
  }
});
