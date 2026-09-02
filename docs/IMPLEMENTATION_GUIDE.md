# Laptiva Labs Implementation Guide

**Version:** 1.0.0<br>
**Last updated:** 2026-08-30<br>
**Status:** Draft for implementation<br>
**Application:** Laptiva Interval Timer<br>
**Platform:** Static TypeScript/React PWA deployed through GitHub Pages

---

## 0. Purpose

Laptiva Labs is a hidden, explicitly experimental area for testing local Mentria AI capabilities without making the production timer depend on AI.

The first release establishes a reusable local-model foundation and ships a Phrase & Voice Studio. Later increments add post-workout debriefs, a raw prompt playground, a coach-context simulator, and natural-language timer generation.

This document is the implementation source of truth. Stable requirement IDs are referenced by `docs/TEST_SPEC.md` so implementation and QA remain aligned.

## 1. Fixed product decisions

These decisions are part of the initial scope and should not be changed implicitly during implementation.

| ID | Decision |
|---|---|
| DEC-001 | The feature is called **Laptiva Labs**. Mentria is credited as the runtime/model source without suggesting a commercial partnership. |
| DEC-002 | Labs is unlocked by activating the Settings version label seven times within five seconds. |
| DEC-003 | Unlocking Labs never downloads or initializes a model. |
| DEC-004 | The initial model is Mentria Qwen3.5 0.8B, text-only. Vision is out of scope. |
| DEC-005 | The user must explicitly approve the model download after seeing its approximate size. |
| DEC-006 | Mentria generates text. Laptiva continues using browser/system Speech Synthesis voices. |
| DEC-007 | Inference never runs inside the active timer loop. Production timer correctness has priority over AI. |
| DEC-008 | Prompts, generated text, ratings, and workout feedback remain local unless the user explicitly exports them. |
| DEC-009 | Static production phrases remain the permanent fallback. |
| DEC-010 | Laptiva continues to deploy only through the existing GitHub Pages workflow. |

## 2. Existing integration points

The current application already provides most of the domain data needed by Labs:

- `ScreenName` in `app/page.tsx` controls the single-page screen state.
- The version footer in Settings is the unlock entry point.
- `coach/types.ts` defines personality, intent, fatigue-zone, delivery, and phase context.
- `coach/context.ts` derives deterministic workout context.
- `coach/personalities.ts` owns voice rate and pitch behavior.
- `progress/types.ts` defines completed workout sessions.
- `recordCompletedWorkout()` creates the session that a post-workout debrief can reference.
- `public/sw.js` owns the PWA app-shell cache.

Labs should consume these modules rather than duplicate their rules.

## 3. Functional requirements

### 3.1 Unlock and navigation

#### LAB-001 — Secret unlock

Given Labs is locked, activating the version control seven times within a rolling five-second window unlocks Labs.

Acceptance criteria:

- Activations before the third produce no visible hint.
- Starting with the third activation, an `aria-live` message reports the remaining count.
- A timeout resets the count.
- Activating the Content Credits link does not increment the count.
- Keyboard activation behaves the same as pointer activation.

#### LAB-002 — Persistent discovery

After unlock, Settings displays a normal Laptiva Labs row on subsequent launches.

Acceptance criteria:

- Unlock state uses the versioned storage key `pulse-labs-settings-v1`.
- “Hide Labs” removes the Settings row and resets the unlock state.
- Hiding Labs does not delete cached model data without separate confirmation.

#### LAB-003 — Labs screen isolation

Labs is added as a separate application screen and is not included in primary navigation.

Acceptance criteria:

- Labs opens from Settings and returns to Settings.
- Entering Labs does not mutate timer, progress, coach, or reminder settings.
- Leaving Labs stops generation and releases the worker/GPU, while retaining cached weights.

### 3.2 Model foundation

#### MODEL-001 — Capability detection

Labs detects whether `navigator.gpu` and a usable adapter are available before offering model download.

Acceptance criteria:

- Unsupported devices get a clear explanation and can still use non-model Labs controls.
- Capability detection never throws an uncaught error.
- iOS is restricted to the 0.8B tier for the initial release.

#### MODEL-002 — Explicit download consent

The model is downloaded only after an explicit user action.

Acceptance criteria:

- The consent UI shows the approximate text-model download size.
- The quote LoRA is disclosed as an additional download before it is fetched.
- Opening or unlocking Labs produces no model-weight request.
- A declined download leaves Labs usable and retryable.

#### MODEL-003 — Model lifecycle

The model service exposes a deterministic lifecycle.

Required states:

```ts
type MentriaStatus =
  | { kind: 'unsupported'; reason: string }
  | { kind: 'idle'; cached: boolean }
  | { kind: 'awaiting-consent' }
  | { kind: 'loading-runtime' }
  | { kind: 'downloading'; loaded: number; total?: number; message?: string }
  | { kind: 'compiling'; message?: string }
  | { kind: 'ready'; adapter: 'base' | 'quotes' }
  | { kind: 'generating' }
  | { kind: 'error'; message: string };
```

Acceptance criteria:

- Only one model load may run at a time.
- Only one generation may run at a time.
- Generation supports `AbortSignal`.
- Device-loss and worker errors transition to recoverable error states.
- Runtime imports are client-only and base-path safe.

#### MODEL-004 — Pinned, text-only assets

Laptiva loads a reproducible, minimal model configuration.

Acceptance criteria:

- The Mentria runtime is vendored from an exact Git revision.
- The model URL contains an exact Hugging Face revision.
- `visionModelUrl`, vision shards, and image preprocessing are not loaded.
- Model URLs are constants, not user-supplied inputs.

#### MODEL-005 — Cache management

Users can inspect and delete local AI storage.

Acceptance criteria:

- Model cache survives a normal Laptiva service-worker update.
- “Delete model” terminates the engine first and deletes only caches/databases owned by the Labs runtime.
- Normal Laptiva app-shell caches are preserved.
- Deletion reports success or a recoverable error.

### 3.3 Phrase & Voice Studio

#### PHRASE-001 — Custom phrase preview

Users can enter text and preview it through an available system voice.

Acceptance criteria:

- Preview works without downloading the Mentria model.
- Personality, intent, delivery, voice, rate, and pitch are configurable.
- Empty input cannot be played.
- Leaving the screen cancels speech.

#### PHRASE-002 — AI phrase generation

Users can ask Mentria to generate or rewrite coaching phrases.

Supported operations:

- Generate a new phrase.
- Rewrite custom text.
- Generate alternatives.
- Generate for a chosen personality and fatigue zone.
- Switch between the base model and quote LoRA.

Acceptance criteria:

- Output is displayed as text, never injected as raw HTML.
- Special tokens and wrapping quotes are stripped.
- Output is trimmed and length-limited.
- Empty or malformed output produces a retryable error.
- Current deterministic Laptiva phrasing can be shown for comparison.

#### PHRASE-003 — Candidate phrase pack

Users can save generated phrases as experimental candidates.

Acceptance criteria:

- Candidates are stored separately from production phrase arrays.
- Each candidate records text, personality, context, adapter, model revision, prompt version, timestamp, and optional helpfulness rating.
- Duplicate normalized text is rejected.
- Users can delete individual candidates or the full pack.
- Saved candidates are never spoken during a real workout in the initial release.

### 3.4 Post-workout debrief

#### DEBRIEF-001 — Feedback capture

After a completed workout, Labs can collect subjective feedback.

Required fields:

- Perceived effort from 1 through 5.
- Difficulty: too easy, right, or too hard.

Optional fields:

- Feeling.
- Private note.

Acceptance criteria:

- Feedback is stored under `pulse-workout-feedback-v1`, keyed by session ID.
- Production `WorkoutSession` schema version 1 remains unchanged.
- Invalid or orphaned feedback records are ignored safely.
- Notes have a defined length limit.

#### DEBRIEF-002 — Fact-grounded AI summary

Laptiva computes workout facts; Mentria turns those facts into prose.

Acceptance criteria:

- The prompt contains a structured fact object produced by Laptiva.
- The model is instructed not to invent metrics or medical advice.
- Facts are displayed beside the generated summary.
- Summary generation is user-triggered and never automatic.
- The summary records model revision and prompt version.

#### DEBRIEF-003 — Completion entry point

If Labs is unlocked, the completed runner may offer “Try AI debrief.”

Acceptance criteria:

- The button references the newly completed session ID.
- It never appears during an unfinished workout.
- It may open the feedback form without loading the model.
- Dismissing it does not affect workout history.

### 3.5 Playground and experiments

#### PLAY-001 — Prompt playground

Labs provides a raw text-generation playground.

Acceptance criteria:

- Controls include adapter, temperature, maximum tokens, stop, retry, and copy.
- Controls enforce bounded numeric ranges.
- Prompt history is in-memory by default.
- The user may explicitly save or export selected output.
- Model output is rendered as plain text in the first release.

#### PLAY-002 — Coach context simulator

Users can construct a `CoachContext`, generate a cue, and compare it with Laptiva’s deterministic coach.

Acceptance criteria:

- Phase, round, cycle, time, fatigue zone, personality, and intent are selectable.
- Invalid context combinations are normalized or rejected.
- AI and deterministic results are clearly labeled.
- Either result can be previewed using the same system voice.

#### PLAY-003 — Experiment registry

Labs experiments are registered through data rather than additional root-screen conditionals.

Acceptance criteria:

- Each experiment has an ID, title, summary, maturity state, capability requirements, and render target.
- Disabled or unsupported experiments explain why they cannot run.
- New experiments do not require changes to production timer logic.

### 3.6 Natural-language timer builder

#### TIMERAI-001 — Proposed timer generation

Users can describe a desired workout and receive a proposed `TimerConfig`.

Acceptance criteria:

- Model output is parsed through a strict application-owned schema.
- All values are clamped or rejected against the editor’s current bounds.
- Unknown fields are ignored.
- A proposed timer is shown as a preview before it can be applied.
- AI cannot save, start, or overwrite a timer without explicit confirmation.

#### TIMERAI-002 — Existing timer transformations

The builder can propose changes such as “easier,” “harder,” or “more recovery.”

Acceptance criteria:

- The current timer is supplied as structured input.
- A before/after diff is shown.
- Original values remain available until confirmation.
- Rejected output leaves the timer unchanged.

### 3.7 Cross-cutting requirements

#### SAFE-001 — Production timer independence

- No model code runs from the 100 ms timer interval.
- No model output controls deadlines, wake locks, phase transitions, history recording, or audio cues.
- A model crash cannot interrupt an active workout.

#### SAFE-002 — Privacy

- No analytics or telemetry is introduced.
- Prompts and workout feedback are not transmitted to Laptiva or Mentria servers.
- Network activity is limited to pinned runtime/model asset retrieval.
- Export is explicit and user-initiated.

#### SAFE-003 — Accessible experimental UI

- All controls have programmatic labels.
- Download and generation progress use `role="status"` or `aria-live` without excessive announcements.
- Focus moves to the Labs heading on entry and returns to the opening control on exit where practical.
- Keyboard-only use supports the full flow.

#### SAFE-004 — Licensing

- MIT and Apache 2.0 notices are distributed with Laptiva.
- Source repositories and exact revisions are recorded.
- Modified vendored files are documented.
- UI wording does not imply that Mentria endorses Laptiva.

## 4. Target architecture

```text
Laptiva Labs UI
    |
    +-- Phrase/voice studio --------> existing coach + Web Speech APIs
    |
    +-- Debrief --------------------> deterministic workout facts
    |
    +-- Playground/context/timer ---> prompt builders + validators
    |
    v
Labs model controller
    |
    +-- lifecycle/state machine
    +-- consent and progress
    +-- output cleanup
    +-- adapter selection
    |
    v
Mentria client boundary
    |
    +-- dynamically imported vendored runtime
    +-- dedicated worker
    +-- pinned Hugging Face model assets
    +-- Cache Storage
```

The model boundary must remain replaceable. UI components depend on a Laptiva-owned interface, not directly on `MentriaEngine`.

## 5. File plan

```text
labs/
├── index.ts
├── types.ts
├── requirements.ts
├── storage.ts
├── storage.test.ts
├── unlock.ts
├── unlock.test.ts
├── prompts.ts
├── prompts.test.ts
├── output.ts
├── output.test.ts
├── timer-proposal.ts
├── timer-proposal.test.ts
├── workout-facts.ts
├── workout-facts.test.ts
├── model/
│   ├── config.ts
│   ├── types.ts
│   ├── mentria-client.ts
│   ├── model-controller.ts
│   └── cache.ts
└── components/
    ├── PulseLabsScreen.tsx
    ├── ModelManager.tsx
    ├── PhraseVoiceStudio.tsx
    ├── WorkoutDebrief.tsx
    ├── PromptPlayground.tsx
    ├── CoachContextSimulator.tsx
    └── TimerBuilderExperiment.tsx

public/mentria/
├── LICENSE
├── SOURCE.md
└── dist/
    ├── mentria.mjs
    ├── worker.mjs
    ├── THIRD_PARTY_LICENSES.md
    └── all hashed sibling modules imported by the runtime
```

Keep pure logic in `.ts` files so it can use the repository’s existing Node test runner. UI code should remain thin and delegate parsing, normalization, storage, and prompt construction to tested modules.

## 6. Storage design

| Data | Storage | Key or namespace | Retention |
|---|---|---|---|
| Labs unlock/preferences | `localStorage` | `pulse-labs-settings-v1` | Until hidden/reset |
| Candidate phrases | `localStorage` | `pulse-labs-phrases-v1` | User-managed, capped |
| Workout feedback/debriefs | `localStorage` | `pulse-workout-feedback-v1` | User-managed, capped |
| Explicitly saved playground runs | `localStorage` initially | `pulse-labs-runs-v1` | User-managed, capped |
| Model weights/tokenizer/adapter | Cache Storage/runtime cache | Runtime-owned, enumerated by adapter | Until deleted/evicted |
| Active conversation | Memory | None | Cleared on exit/reload |

Every parser must treat storage as untrusted input. Invalid versions, records, types, or ranges are discarded rather than allowed into React state.

## 7. Implementation phases

### Phase 0 — Runtime spike

Goal: prove Mentria works from Laptiva’s real GitHub Pages base path before building product UI.

Tasks:

1. Record the exact upstream runtime revision.
2. Vendor the complete Mentria `dist` directory and license files.
3. Construct runtime URLs with `document.baseURI` so local development and `/pulse-interval-timer/` both work.
4. Configure only Qwen3.5 0.8B text assets.
5. Pin the Hugging Face model revision.
6. Generate one short response from a temporary development control.
7. Verify cancellation, unload, offline repeat, and cache deletion.
8. Remove the temporary control after the reusable model controller exists.

Phase gate:

- [ ] A production GitHub Pages build generates one response.
- [ ] A second generation works offline.
- [ ] No vision file is requested.
- [ ] Model deletion removes model assets without removing the app shell.
- [ ] A normal workout remains correct before, during, and after the spike.

### Phase 1 — Pure foundations

Goal: implement all logic that can be tested without WebGPU or React.

Tasks:

1. Define model, storage, feedback, candidate phrase, experiment, and timer-proposal types.
2. Implement unlock-state transitions as a pure function.
3. Implement versioned storage parsers and caps.
4. Implement prompt builders with version constants.
5. Implement model-output cleanup.
6. Implement workout-fact calculation.
7. Implement timer-proposal parsing and validation.
8. Add unit tests and include `labs/*.test.ts` in `npm test`.

Phase gate:

- [ ] All pure modules have boundary and corrupt-input tests.
- [ ] Existing coach/progress/reminder tests remain unchanged and green.

### Phase 2 — Labs shell and model manager

Goal: make Labs discoverable, accessible, and safely downloadable.

Tasks:

1. Add `'labs'` to `ScreenName`.
2. Add unlock state hydration without coupling it to `Settings`.
3. Replace the passive version text with a separate accessible version button; keep Content Credits outside it.
4. Implement unlock feedback and persistence.
5. Lazy-load `PulseLabsScreen`.
6. Implement support, consent, progress, error, cached, ready, unload, and delete states.
7. Terminate the engine on Labs exit.
8. Add “Hide Labs,” “Delete Labs data,” and “Delete model.”

Phase gate:

- [ ] Unlocking and navigation work with pointer and keyboard.
- [ ] No runtime/model network request occurs before explicit load.
- [ ] Unsupported devices show a complete, non-crashing screen.

### Phase 3 — Phrase & Voice Studio

Goal: ship the first user-visible Mentria experiment.

Tasks:

1. Refactor reusable Speech Synthesis preview behavior out of the root page without changing production speech behavior.
2. Build custom-text preview first; this path requires no model.
3. Add personality, intent, delivery, zone, voice, rate, and pitch controls.
4. Add generate, rewrite, and alternatives prompt modes.
5. Add base/quote adapter switching.
6. Clean and validate generated output.
7. Add deterministic comparison and helpfulness controls.
8. Add candidate save/delete/export.

Phase gate:

- [ ] A user can preview their own text without a model.
- [ ] A user can generate, preview, rate, and save a Mentria phrase.
- [ ] Saved candidates cannot enter a real workout.

### Phase 4 — Post-workout debrief

Goal: collect useful subjective context and test grounded summaries.

Tasks:

1. Add `lastCompletedSessionId` state when a workout session is recorded.
2. Show the Labs-only completion CTA.
3. Implement feedback storage separately from `WorkoutSession`.
4. Derive deterministic facts and comparisons in a pure module.
5. Build the feedback form and facts preview.
6. Generate and store an optional summary.
7. Add helpfulness and regenerate controls.

Phase gate:

- [ ] Feedback saves without a model.
- [ ] A debrief references the correct completed session.
- [ ] Deleting a workout makes associated feedback orphan-safe.
- [ ] Production progress totals are unaffected.

### Phase 5 — Playground and coach simulator

Goal: make experimentation extensible.

Tasks:

1. Create the experiment registry.
2. Add the raw prompt playground with bounded controls.
3. Keep history in memory unless explicitly saved.
4. Add the coach-context simulator using existing coach types.
5. Add AI/deterministic comparison and shared voice preview.
6. Add diagnostic metadata: model, adapter, prompt version, latency, and output length.

Phase gate:

- [ ] Raw output cannot execute HTML or script.
- [ ] Invalid context cannot produce an invalid production object.
- [ ] New experiments can be registered without root-page changes.

### Phase 6 — Natural-language timer builder

Goal: test structured generation without allowing AI to control the timer.

Tasks:

1. Define the strict proposal schema.
2. Prompt the model to emit one JSON object between fixed delimiters.
3. Extract, parse, normalize, and validate through application code.
4. Display validation errors rather than guessing missing required data.
5. Display proposed timer and before/after diff.
6. Apply only after confirmation by populating the normal editor draft.
7. Reuse `saveTimer()` rather than writing an AI-specific save path.

Phase gate:

- [ ] Malformed output cannot change timers.
- [ ] Every accepted field obeys normal editor bounds.
- [ ] The user confirms before any draft or saved timer changes.

### Phase 7 — PWA, licensing, and release hardening

Goal: make the experimental feature safe to ship publicly.

Tasks:

1. Change service-worker cleanup to delete only obsolete app-shell caches with the legacy `pulse-app-` prefix.
2. Preserve Labs model caches across app updates.
3. Increment the app-shell cache version.
4. Add all runtime, dependency, model, dataset, and upstream notices.
5. Document exact runtime and model revisions in `public/mentria/SOURCE.md`.
6. Verify that no absolute local path or environment identifier enters tracked files.
7. Run the public-repository secret and metadata checks required by `AGENTS.md`.
8. Run the full test specification.

## 8. Key implementation patterns

### 8.1 Base-path-safe runtime URLs

Do not copy Mentria’s root-absolute `/assets/...` URLs. Laptiva is deployed under a GitHub Pages subpath.

```ts
function publicAssetUrl(relativePath: string): string {
  if (typeof document === 'undefined') throw new Error('Browser-only asset URL');
  return new URL(relativePath.replace(/^\/+/, ''), document.baseURI).href;
}

const runtimeUrl = publicAssetUrl('mentria/dist/mentria.mjs');
const workerUrl = publicAssetUrl('mentria/dist/worker.mjs');
```

The runtime import must occur only after a user asks to load the model.

### 8.2 Laptiva-owned client boundary

```ts
interface LocalTextModel {
  checkSupport(): Promise<ModelSupport>;
  load(options: LoadOptions): Promise<void>;
  generate(request: GenerationRequest, onToken: (token: string) => void): Promise<GenerationResult>;
  swapAdapter(adapter: 'base' | 'quotes'): Promise<void>;
  cancel(): void;
  unload(): Promise<void>;
  deleteCache(): Promise<void>;
}
```

Components receive this interface through a controller/hook. Tests provide a fake implementation.

### 8.3 Strict output handling

Generated output is untrusted data.

```ts
function cleanGeneratedPhrase(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<\|[^|]*\|>/g, '')
    .trim()
    .replace(/^["“]|["”]$/g, '')
    .trim();
  if (!cleaned || cleaned.length > 220 || /[\r\n]{2,}/.test(cleaned)) return null;
  return cleaned;
}
```

UI rendering uses text nodes/React interpolation. Rich Markdown is not required for the first version.

### 8.4 Versioned prompts

Each feature owns a prompt version:

```ts
export const PHRASE_PROMPT_VERSION = 1;
export const DEBRIEF_PROMPT_VERSION = 1;
export const TIMER_PROMPT_VERSION = 1;
```

Saved output records the relevant version. Prompt changes increment the version so comparisons remain meaningful.

### 8.5 Grounded debrief facts

The model must not calculate workout metrics. Laptiva creates a fact object:

```ts
type WorkoutFacts = {
  sessionId: string;
  timerName: string;
  completedAt: string;
  totalSeconds: number;
  activeWorkSeconds: number;
  rounds: number;
  cycles: number;
  activeDaysThisWeek: number;
  currentActiveDayStreak: number;
  perceivedEffort: 1 | 2 | 3 | 4 | 5;
  difficulty: 'too-easy' | 'right' | 'too-hard';
  userNote?: string;
};
```

Any comparison with previous sessions is calculated by Laptiva and included explicitly.

### 8.6 Strict timer proposals

```ts
type TimerProposal = {
  name?: string;
  prepare: number;
  work: number;
  rest: number;
  rounds: number;
  cycles: number;
  cycleRest: number;
  cooldown: number;
  explanation?: string;
};
```

Bounds match the existing editor:

| Field | Minimum | Maximum |
|---|---:|---:|
| `prepare` | 0 | 600 |
| `work` | 1 | 3600 |
| `rest` | 0 | 3600 |
| `rounds` | 1 | 99 |
| `cycles` | 1 | 20 |
| `cycleRest` | 0 | 3600 |
| `cooldown` | 0 | 3600 |
| `name` | 0 characters | 48 characters |

Do not silently clamp extreme model output in a way that disguises a bad proposal. Prefer a visible validation error when a value is materially outside the allowed range.

### 8.7 Service-worker cache ownership

The existing service worker deletes every cache other than the current app cache. That would risk deleting runtime-owned model caches.

Use ownership prefixes:

```js
const APP_CACHE_PREFIX = 'pulse-app-';
const CACHE_NAME = `${APP_CACHE_PREFIX}v9`;

keys
  .filter((key) => key.startsWith(APP_CACHE_PREFIX) && key !== CACHE_NAME)
  .map((key) => caches.delete(key));
```

Model deletion must use an explicit allowlist discovered during the runtime spike. It must not broadly delete every cache containing generic strings such as `transformers` unless Laptiva created that cache.

## 9. Error and recovery behavior

| Failure | Required behavior |
|---|---|
| No WebGPU | Show unsupported status; do not offer download. |
| Adapter request fails | Show retry; do not report device as permanently unsupported. |
| Download interrupted | Preserve safe partial runtime state where supported; allow retry. |
| Shader compilation fails | Terminate worker, show concise error, allow retry/reload. |
| Device lost | Cancel generation, terminate worker, retain cached assets. |
| Quote adapter fails | Offer base-model fallback and label it accurately. |
| Output empty/malformed | Keep prompt/input, show retry, do not save. |
| Storage full | Keep current unsaved output in memory and explain that it was not persisted. |
| Cache deletion fails | Keep current state conservative and identify what could not be removed without exposing internal user data. |

## 10. Licensing and provenance

Before the first Labs commit:

- Copy the Mentria MIT license with the vendored runtime.
- Copy Mentria’s runtime `THIRD_PARTY_LICENSES.md`.
- Add entries to `public/third-party-notices.txt` for:
  - Mentria website/runtime, MIT.
  - Hugging Face tokenizers runtime, Apache 2.0.
  - Hugging Face Jinja runtime, MIT.
  - Mentria Qwen3.5 model bundle, Apache 2.0.
  - Quote LoRA/dataset, Apache 2.0 when used.
  - Upstream Qwen3.5, Apache 2.0.
- Record source URLs and exact revisions.
- Document any modified upstream JavaScript paths.
- Do not reuse Mentria logos or imply endorsement.

## 11. Verification commands

Run throughout implementation:

```bash
npm test
npm run lint
npm run build:github
```

Before a commit or push, also follow the public-repository checks in `AGENTS.md`, including staged and history secret scans and GitHub noreply author/committer metadata.

## 12. Rollout and graduation rules

Labs experiments do not graduate merely because they work once.

An experiment may move into normal Laptiva UI only when:

- Its P0 and P1 tests pass.
- Unsupported-device behavior is complete.
- It has a deterministic fallback.
- Output validation prevents harmful state changes.
- It introduces no active-workout timing regression.
- Privacy and licensing notices are complete.
- The user must still opt into model download.
- The product value justifies the storage, battery, and latency cost.

## 13. Definition of done

### First releasable Labs increment

- [ ] Phase 0 runtime spike passes.
- [ ] Phase 1 pure foundations are implemented and tested.
- [ ] Labs unlock and persistence satisfy LAB-001 through LAB-003.
- [ ] Model manager satisfies MODEL-001 through MODEL-005.
- [ ] Phrase & Voice Studio satisfies PHRASE-001 through PHRASE-003.
- [ ] SAFE-001 through SAFE-004 pass.
- [ ] `docs/TEST_SPEC.md` P0 suite passes.
- [ ] Existing timer, coach, progress, reminders, and offline behavior regressions pass.
- [ ] `npm test`, `npm run lint`, and `npm run build:github` pass.
- [ ] Public-repository safety checks pass.

### Full experimental suite

- [ ] DEBRIEF-001 through DEBRIEF-003 pass.
- [ ] PLAY-001 through PLAY-003 pass.
- [ ] TIMERAI-001 and TIMERAI-002 pass.
- [ ] All P0/P1 tests in `docs/TEST_SPEC.md` pass.
- [ ] Real-device WebGPU matrix is complete.

## 14. Document history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-30 | Initial implementation guide for Laptiva Labs and Mentria experiments. |
