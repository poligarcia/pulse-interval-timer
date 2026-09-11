import type { CoachPhase, CoachSpeech, PhaseKind } from './types.ts';
import { compileSpeechScript, estimateSpeechBudget, parseSpeechScript } from './speech-script.ts';
import type { SpeechScript } from './speech-script.ts';

export const DRILL_STORAGE_KEY = 'laptiva-drill-v1';
export const DRILL_PRESENTATION = { label: 'Drill Instructor', description: 'Relentless commands. Rare mercy. English only.' };
export type DrillMemory = { unlocked: boolean; recent: string[]; lastFake?: string };
export function parseDrillMemory(value: unknown): DrillMemory {
  if (!value || typeof value !== 'object') return { unlocked: false, recent: [] };
  const source = value as Partial<DrillMemory>;
  return { unlocked: source.unlocked === true, lastFake: typeof source.lastFake === 'string' && /^drill-fake-\d+$/.test(source.lastFake) ? source.lastFake : undefined, recent: Array.isArray(source.recent)
    ? source.recent.filter((id): id is string => typeof id === 'string' && /^drill-[a-z0-9-]+$/.test(id)).slice(-20) : [] };
}
export const drillAvailable = (locale: string, labs: boolean, engine: boolean, unlocked: boolean) => locale === 'en' && labs && engine && unlocked;
export function rememberDrill(memory: DrillMemory, id: string): DrillMemory {
  return { ...memory, ...(id.startsWith('drill-fake-') ? { lastFake: id } : {}), recent: [...memory.recent.filter((item) => item !== id), id].slice(-20) };
}

type AuthoredCopy = string | { source: string; compact: string };
type Line = { id: string; source: string; parts: string[]; tier: number; full: SpeechScript; compact: SpeechScript };
function authoredLine(id: string, copy: AuthoredCopy, tier = 0): Line {
  const source = typeof copy === 'string' ? copy : copy.source;
  const base = { id, rate: 1.12, pitch: .94 };
  const full = parseSpeechScript(source, base);
  if (!full.ok) throw new Error(`${id}: ${full.error}`);
  const parts = full.script.segments.filter((segment) => segment.kind === 'text').map((segment) => segment.text.trim());
  // Compact delivery keeps every word, but removes theatrical segmentation.
  // Fake countdowns explicitly retain a separate, audible reveal instead.
  const compact = parseSpeechScript(typeof copy === 'string' ? parts.join(' ') : copy.compact, base);
  if (!compact.ok) throw new Error(`${id} compact: ${compact.error}`);
  // A short, brisk single-segment command may already be faster than flat base
  // delivery. Keep it intact rather than make the compact option slower.
  const fullSteps = compileSpeechScript(full.script);
  const compactSteps = compileSpeechScript(compact.script);
  const compactScript = fullSteps.ok && compactSteps.ok && estimateSpeechBudget(fullSteps.steps) <= estimateSpeechBudget(compactSteps.steps)
    ? full.script : compact.script;
  return { id, source, parts, tier, full: full.script, compact: compactScript };
}
const lines = (group: string, copies: AuthoredCopy[], tier = 0): Line[] => copies.map((copy, i) => authoredLine(`drill-${group}-${i}`, copy, tier));

// Delivery is authored beside each phrase. There are no implicit pipe rules or
// blanket changes to the second clause. IDs stay stable for device phrase memory.
export const DRILL_LINES = {
  prepare: lines('prepare', [
    '[[rate:+0.08]]ATTENTION.[[pause:250]][[rate:-0.08]]Clear your space. Stand by.',
    '[[pitch:-0.04]]Recruit. Report ready.[[pause:300]][[rate:-0.06]][[reset:pitch]]Training begins on the signal.',
    'You selected this assignment voluntarily.[[pause:500]][[rate:-0.14]][[pitch:-0.06]][[volume:*0.85]]Fascinating judgment.[[pause:180]][[reset]]Stand by.',
  ]),
  work: lines('work', [
    '[[volume:*0.9]]ROUND {round}.[[pause:160]][[reset]][[rate:+0.14]]BEGIN!',
    '[[pitch:-0.03]][[volume:*0.9]]NEXT ASSIGNMENT.[[pause:140]][[reset]][[rate:+0.16]]MOVE!',
    '[[rate:-0.02]][[volume:*0.9]]WORK PHASE.[[pause:180]][[reset]][[rate:+0.12]]EXECUTE!',
    '[[volume:*0.9]]Recruit, stand by.[[pause:180]][[reset]][[rate:+0.14]]BEGIN!',
  ]),
  final: lines('final', [
    '[[volume:*0.9]]FINAL ROUND.[[pause:180]][[reset]][[rate:+0.14]]BEGIN!',
    '[[pitch:-0.03]][[volume:*0.9]]LAST ASSIGNMENT.[[pause:160]][[reset]][[rate:+0.12]]EXECUTE!',
    'FINAL ROUND.[[pause:280]][[rate:-0.14]][[pitch:-0.06]]Earn the silence.',
  ]),
  rest: lines('rest', [
    'RECOVERY AUTHORIZED.[[pause:300]][[rate:-0.12]]Use every second.',
    'REST.[[pause:220]][[rate:-0.10]]Breathe, reset,[[pause:250]][[pitch:-0.04]][[volume:*0.85]]contain the celebration.',
    'RECOVER.[[pause:200]]The clock granted mercy.[[pause:450]][[rate:-0.14]][[pitch:-0.06]][[volume:*0.82]]I objected.',
    'REST.[[pause:250]][[rate:-0.10]]Recovery is part of the assignment.',
  ]),
  cycleRest: lines('cycle-rest', [
    'CYCLE COMPLETE.[[pause:400]][[rate:-0.12]]Regroup. Recover.',
    'EXTENDED RECOVERY.[[pause:350]][[rate:-0.14]][[pitch:-0.04]]Return ready.',
    'STAND DOWN.[[pause:400]][[rate:-0.08]][[pitch:-0.03]]The next cycle awaits.',
  ]),
  cooldown: lines('cooldown', [
    'WORK COMPLETE.[[pause:400]][[rate:-0.16]][[pitch:-0.04]]Ease down. Breathe comfortably.',
    'COOLDOWN.[[pause:350]][[rate:-0.12]]Recovery is your assignment.',
    '[[rate:-0.06]]STAND DOWN GRADUALLY.[[pause:350]][[rate:-0.16]][[pitch:-0.04]]Release the effort.',
  ]),
  complete: lines('complete', [
    'OBJECTIVE COMPLETE.[[pause:450]][[rate:-0.14]][[pitch:-0.04]]Stand down.',
    'ASSIGNMENT FINISHED.[[pause:600]][[rate:-0.16]][[pitch:-0.06]][[volume:*0.9]]Acceptable.',
    'SESSION COMPLETE.[[pause:300]][[rate:-0.12]]Recover.[[pause:220]][[rate:-0.04]][[pitch:-0.04]]That is an order.',
  ]),
  comeback: lines('comeback', [
    '[[rate:-0.04]]You paused.[[pause:180]][[reset]]You returned.[[pause:350]][[rate:-0.08]][[pitch:-0.03]]Objective complete.',
    'An operation with chapters.[[pause:450]][[rate:-0.10]][[pitch:-0.04]]Still complete.',
    'Regrouped and finished.[[pause:450]][[rate:-0.14]][[pitch:-0.05]][[volume:*0.9]]Acceptable.',
  ]),
  pause: lines('pause', [
    'HALT ACKNOWLEDGED.[[pause:250]][[rate:-0.12]]Resume when ready.',
    'TACTICAL PAUSE.[[pause:280]][[rate:-0.14]]Take what you need.',
    'CLOCK FROZEN.[[pause:450]][[rate:-0.10]][[pitch:-0.06]][[volume:*0.85]]I remain professionally unimpressed.',
    'FORMATION BROKEN.[[pause:250]][[rate:-0.10]]Regroup when ready.',
    'PAUSE AUTHORIZED.[[pause:250]][[rate:-0.12]]Recover. No heroics required.',
    'INTERMISSION DETECTED.[[pause:500]][[rate:-0.14]][[pitch:-0.05]][[volume:*0.85]]Unexpectedly theatrical.',
    'STAND DOWN.[[pause:200]][[rate:-0.12]]If something feels wrong, remain paused.',
    'CLOCK STOPPED.[[pause:300]][[rate:-0.12]]The assignment will wait.',
  ]),
  resume: lines('resume', [
    '[[rate:+0.10]]BACK IN FORMATION.',
    'REGROUPED.[[pause:120]][[rate:+0.08]]Continue.',
    'REPORT RECEIVED.[[pause:140]][[rate:+0.08]]Resume the assignment.',
    '[[rate:+0.06]][[pitch:-0.02]]RETURN ACKNOWLEDGED.',
  ]),
  motivation: [
    ...lines('motivation', [
      '[[rate:+0.08]][[pitch:+0.04]]STATUS?[[pause:400]][[reset]][[rate:-0.06]]Control check. Continue.',
      'CHECK YOUR SPACE.[[pause:220]][[rate:-0.12]]Control before speed.',
      '[[pitch:-0.03]]Recruit.[[pause:220]][[reset:pitch]][[rate:-0.08]]Controlled effort until the signal.',
      'Motivation is absent.[[pause:450]][[rate:-0.08]][[pitch:-0.05]][[volume:*0.9]]Discipline may substitute.',
      'Volunteer.[[pause:320]][[rate:-0.08]][[pitch:-0.04]]You selected this assignment.',
      'This interval is temporary.[[pause:220]][[rate:-0.10]]Maintain control.',
      'CHECK YOUR BREATH.[[pause:250]][[rate:-0.14]]Stay deliberate.',
      'Candidate.[[pause:200]][[rate:-0.10]]One interval at a time.',
    ]),
    ...lines('barracks', [
      '[[rate:-0.04]]The timer reviewed your complaint.[[pause:450]][[rate:-0.10]][[pitch:-0.05]][[volume:*0.85]]No actionable information.',
      '[[rate:-0.08]][[pitch:-0.04]]This interval did not request your opinion.',
      'The clock is running.[[pause:300]][[rate:-0.12]][[pitch:-0.06]]Negotiations are closed.',
      'Your calendar said workout.[[pause:500]][[rate:-0.14]][[pitch:-0.06]][[volume:*0.82]]I checked twice.',
    ], 1),
    ...lines('severe', [
      '[[rate:-0.04]]Your excuses have impeccable attendance.[[pause:350]][[rate:+0.06]][[pitch:-0.03]]Bring that commitment.',
      '[[rate:-0.14]][[pitch:-0.06]]Almost finished is not a phase.',
      '[[rate:-0.10]][[pitch:-0.06]]Your optimism has no authority over this clock.',
    ], 2),
  ],
  mind: lines('mind', [
    'Stand by for encouragement.[[pause:650]][[rate:-0.12]][[pitch:-0.06]][[volume:*0.85]]Encouragement remains unavailable.',
    '[[pitch:+0.03]]I nearly sounded impressed.[[pause:550]][[pitch:-0.06]][[rate:-0.12]][[volume:*0.85]]Situation contained.',
    'The clock offered sympathy.[[pause:600]][[rate:-0.16]][[pitch:-0.06]][[volume:*0.82]]I declined.',
    '[[rate:-0.04]]Administrative update.[[pause:400]][[rate:-0.10]][[pitch:-0.04]][[volume:*0.9]]Morale remains optional.',
    '[[rate:-0.06]]An easier session exists.[[pause:550]][[rate:-0.12]][[pitch:-0.05]]You selected this one.',
    'Your early-release paperwork[[pause:350]][[rate:-0.12]][[pitch:-0.06]][[volume:*0.88]]is filed under fiction.',
  ], 1),
  praise: lines('praise', [
    '[[rate:-0.14]][[pitch:-0.05]][[volume:*0.9]]Competence detected.',
    '[[rate:-0.10]][[pitch:-0.04]]Acceptable.[[pause:550]][[rate:-0.04]][[volume:*0.85]]Do not become emotional.',
    '[[rate:-0.16]][[pitch:-0.04]][[volume:*0.88]]Nearly professional.',
    '[[rate:-0.08]]You may have potential.[[pause:650]][[rate:-0.12]][[pitch:-0.06]][[volume:*0.85]]Investigation continues.',
    '[[rate:-0.12]][[pitch:-0.04]][[volume:*0.95]]That met the standard.',
  ]),
  fake: lines('fake', [
    { source: 'Five, four, three, two.[[pause:180]][[rate:-0.18]][[pitch:-0.08]][[volume:*0.9]]Wrong countdown. Keep working.', compact: 'Five, four, three, two.[[pause:100]][[rate:-0.08]]Wrong countdown. Keep working.' },
    { source: 'Five, four, three, two.[[pause:150]][[rate:-0.08]][[pitch:-0.03]]Rehearsal. Keep working.', compact: 'Five, four, three, two.[[pause:100]][[rate:-0.04]]Rehearsal. Keep working.' },
    { source: 'Five, four, three, two.[[pause:200]][[rate:-0.20]][[pitch:-0.08]][[volume:*0.95]]Disappointing. More time remains.', compact: 'Five, four, three, two.[[pause:100]][[rate:-0.10]]Disappointing. More time remains.' },
    { source: 'Five, four, three, two.[[pause:180]][[rate:-0.12]][[pitch:-0.06]]Too optimistic. Keep working.', compact: 'Five, four, three, two.[[pause:100]][[rate:-0.06]]Too optimistic. Keep working.' },
    { source: 'Five, four, three, two.[[pause:160]][[rate:-0.06]][[pitch:-0.04]][[volume:*0.95]]Practice numbers. Keep working.', compact: 'Five, four, three, two.[[pause:100]][[rate:-0.02]]Practice numbers. Keep working.' },
    { source: 'Five, four, three, two.[[pause:140]][[rate:+0.04]][[pitch:-0.04]]Not yet. Keep working.', compact: 'Five, four, three, two.[[pause:100]][[rate:+0.04]]Not yet. Keep working.' },
  ]),
};

const BRIEFING = authoredLine('drill-briefing', '[[rate:+0.06]]ATTENTION.[[pause:200]][[rate:-0.04]]{intervals} work intervals. Work {work} seconds. Recover {rest}.[[pause:220]][[reset]]Stand by.');
const SHORT_CUES = Object.fromEntries(Object.entries({ prepare: 'STAND BY.', work: 'BEGIN!', rest: 'RECOVER.', cycleRest: 'REGROUP.', cooldown: 'EASE DOWN.' })
  .map(([kind, text]) => [kind, authoredLine(`drill-short-${kind}`, text)])) as Record<PhaseKind, Line>;

export function drillScript(line: Line, values: Record<string, string | number> = {}, compact = false): SpeechScript {
  const template = compact ? line.compact : line.full;
  return { ...template, segments: template.segments.map((segment) => segment.kind === 'text'
    ? { ...segment, text: segment.text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? key)) }
    : { ...segment }) };
}

/** Select before playback, never strip a running script halfway through. Both
 * versions retain the same phrase ID and words; a fake always keeps its reveal. */
export function fitDrillScript(line: Line, availableMs: number, values: Record<string, string | number> = {}): SpeechScript | null {
  for (const compact of [false, true]) {
    const script = drillScript(line, values, compact);
    if (drillBudget(script) < availableMs) return script;
  }
  return null;
}

export function drillPreviewScript(): SpeechScript {
  const command = drillScript(DRILL_LINES.final[0]);
  const aside = drillScript(DRILL_LINES.mind[0]);
  return { ...command, id: 'drill-preview', segments: [...command.segments, { kind: 'pause', ms: 500 }, { kind: 'reset' }, ...aside.segments] };
}
export function drillText(script: SpeechScript) { return script.segments.filter((s) => s.kind === 'text').map((s) => s.text).join(' '); }
export function drillSpeech(script: SpeechScript): CoachSpeech {
  return { id: script.id, text: drillText(script), rate: script.rate, pitch: script.pitch, intent: 'challenge' };
}
export function drillBudget(script: SpeechScript) {
  const result = compileSpeechScript(script);
  return result.ok ? estimateSpeechBudget(result.steps) + 650 : Infinity;
}
export function pickDrill(group: keyof typeof DRILL_LINES, recent: string[], random = Math.random, tier = 2, avoidId?: string): Line {
  const pool = DRILL_LINES[group].filter((line) => (line.tier ?? 0) <= tier && line.id !== avoidId);
  const fresh = pool.filter((line) => !recent.includes(line.id));
  const candidates = fresh.length ? fresh : pool;
  return candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
}

export type DrillSlot = { script: SpeechScript; atMs: number; startByMs: number; finishByMs: number; kind: 'motivation' | 'fake' | 'mind' | 'praise'; attempted?: boolean };
export type DrillPhasePlan = { startMs: number; endMs: number; script: SpeechScript | null; slots: DrillSlot[] };
export type DrillPlan = { phases: DrillPhasePlan[]; tier: number; pauses: number; resumedAtMs: number; used: string[] };
const hasCountdown = (kind: PhaseKind) => ['prepare', 'work', 'rest'].includes(kind);

/** Allocate optional dialogue before playback. Every slot includes startup headroom;
 * runtime deadlines remain authoritative because native speech durations vary. */
export function planDrillWorkout(phases: readonly CoachPhase[], recent: string[] = [], random = Math.random, phrases = true, lastFake?: string): DrillPlan {
  const mood = random();
  const plan: DrillPlan = { phases: [], tier: mood < .5 ? 0 : mood < .85 ? 1 : 2, pauses: 0, resumedAtMs: -Infinity, used: [] };
  const chosen = [...recent];
  let elapsed = 0;
  const eligibleFakes = phases.flatMap((phase, index) => phase.kind === 'work' && phase.duration >= 30 ? [index] : []);
  const fakePhase = random() < .2 && eligibleFakes.length ? eligibleFakes[Math.min(eligibleFakes.length - 1, Math.floor(random() * eligibleFakes.length))] : -1;
  let mindCount = 0;
  let severeCount = 0;
  const lastWork = phases.findLastIndex((phase) => phase.kind === 'work');
  for (const [index, phase] of phases.entries()) {
    const startMs = elapsed;
    elapsed += phase.duration * 1000;
    const cutoff = elapsed - (hasCountdown(phase.kind) ? 3250 : 250);
    const group = phase.kind === 'work' && index === lastWork ? 'final' : phase.kind;
    const line = pickDrill(group, chosen, random);
    const availableMs = cutoff - startMs - 700;
    let script = fitDrillScript(line, availableMs, { round: phase.round });
    if (phase.kind === 'prepare' && phrases) {
      const work = phases.find((p) => p.kind === 'work');
      const rest = phases.find((p) => p.kind === 'rest');
      const briefing = fitDrillScript(BRIEFING, availableMs, { intervals: phases.filter((p) => p.kind === 'work').length, work: work?.duration ?? 0, rest: rest?.duration ?? 0 });
      if (briefing) script = briefing;
    }
    if (!script || (!phrases && ['rest', 'cycleRest', 'cooldown'].includes(phase.kind))) {
      script = fitDrillScript(SHORT_CUES[phase.kind], availableMs);
    }
    const phasePlan: DrillPhasePlan = { startMs, endMs: elapsed, script, slots: [] };
    if (script) chosen.push(script.id);
    const add = (kind: DrillSlot['kind'], candidate: Line, atMs: number, finishByMs: number) => {
      const script = fitDrillScript(candidate, finishByMs - atMs);
      if (!script) return false;
      phasePlan.slots.push({ kind, script, atMs, startByMs: Math.min(atMs + 400, finishByMs - drillBudget(script)), finishByMs });
      chosen.push(script.id);
      return true;
    };
    if (phrases && phase.kind === 'work' && phase.duration >= 15) {
      if (index === fakePhase) {
        add('fake', pickDrill('fake', chosen, random, 2, lastFake), elapsed - 10000, cutoff);
      }
      const earliest = startMs + Math.max(5000, (phasePlan.script ? drillBudget(phasePlan.script) : 0) + 2700);
      const optionalEnd = phasePlan.slots.some((s) => s.kind === 'fake') ? elapsed - 12500 : cutoff;
      if (random() < .75) {
        const group = mindCount < 2 && random() < .16 ? 'mind' : index > 0 && random() < .10 ? 'praise' : 'motivation';
        const line = pickDrill(group, chosen, random, group === 'motivation' ? severeCount < 2 ? plan.tier : 1 : 2);
        if (add(group, line, earliest, Math.min(optionalEnd, earliest + drillBudget(drillScript(line)) + 500))) {
          if (group === 'mind') mindCount++;
          if (line.tier === 2) severeCount++;
        }
      }
    }
    phasePlan.slots.sort((a, b) => a.atMs - b.atMs);
    plan.phases.push(phasePlan);
  }
  return plan;
}

export function nextDrillSlot(plan: DrillPlan, phaseIndex: number, elapsedMs: number): DrillSlot | undefined {
  for (const slot of plan.phases[phaseIndex]?.slots ?? []) {
    if (slot.attempted || elapsedMs < slot.atMs) continue;
    slot.attempted = true;
    if (elapsedMs > slot.startByMs || elapsedMs + drillBudget(slot.script) >= slot.finishByMs) continue;
    if (slot.kind === 'praise' && plan.pauses && elapsedMs - plan.resumedAtMs < 30000) continue;
    return slot;
  }
}

/** Preserve the original rare-event decisions; discard stale slots and reserve
 * space for the resume command. Pausing can never manufacture another fake-out. */
export function resumeDrillPlan(plan: DrillPlan, elapsedMs: number) {
  plan.resumedAtMs = elapsedMs;
  for (const phase of plan.phases) for (const slot of phase.slots) {
    if (slot.atMs < elapsedMs + 4500) slot.attempted = true;
  }
}

export function drillExamples(compact = false) {
  return [
    { label: 'Settings preview', script: drillPreviewScript() },
    { label: 'Mission briefing', script: drillScript(BRIEFING, { intervals: 8, work: 40, rest: 20 }, compact) },
    ...Object.entries(DRILL_LINES).flatMap(([group, bank]) => bank.map((line, i) => ({
      label: `${group === 'comeback' ? 'Completion after pausing' : group} ${i + 1}${compact ? ' (compact)' : ''}`,
      script: drillScript(line, { round: 3 }, compact),
    }))),
  ];
}
