# Pulse Labs Test Specification

**Version:** 1.0.0<br>
**Last updated:** 2026-08-30<br>
**Status:** Draft<br>
**Scope:** Pulse Labs and Mentria local-model experiments<br>
**Implementation source:** `docs/IMPLEMENTATION_GUIDE.md`

---

## 0. Purpose

This specification defines how Pulse Labs is verified before release. It maps the stable requirement IDs from the implementation guide to automated and manual tests, with special emphasis on:

- Production timer independence.
- Explicit model-download consent.
- Local-only data handling.
- GitHub Pages and PWA behavior.
- Cache ownership and deletion.
- Structured AI-output validation.
- Accessibility and unsupported-device behavior.

A Labs build is not releasable until every P0 test passes and every failed or blocked P1 test has an explicit disposition.

## 1. Test strategy

### 1.1 Test levels

| Level | Tool | Scope | Run frequency |
|---|---|---|---|
| Unit | Node test runner with TypeScript stripping | Pure state, parsing, prompts, validation, storage | Every commit |
| Component/integration | React test harness or browser automation with fake model client | UI-to-controller, storage, speech mocks | Every Labs change |
| Browser E2E | Playwright, using a fake model client in CI | Unlock, navigation, consent, phrase, debrief, timer proposal | Pull requests and release candidates |
| Real WebGPU | Manual real-device runs | Runtime, download, GPU, adapter, cache, offline | Runtime changes and release candidates |
| Regression | Existing automated suite plus manual timer smoke tests | Production Pulse behavior | Every release candidate |

Real model weights are not required in ordinary CI. CI should inject a deterministic `LocalTextModel` fake. Actual Mentria runtime tests run on supported hardware because generic CI runners may not expose stable WebGPU adapters.

### 1.2 Priorities

| Priority | Meaning | Release rule |
|---|---|---|
| P0 | Privacy, safety, data integrity, core flow, timer regression | Must pass |
| P1 | Important error, accessibility, cache, offline, recovery flow | Must pass or have accepted disposition |
| P2 | Secondary UX, diagnostics, rare edge case | May be deferred with issue |

### 1.3 Required environments

| Environment | Purpose |
|---|---|
| Local `npm run dev` | Fast functional development |
| Local `npm run build:github` output | GitHub Pages base-path verification |
| Published GitHub Pages preview/current deployment | Real static hosting and service worker |
| iPhone Safari | Primary mobile WebGPU and system-voice target |
| Installed iPhone PWA | Standalone, offline, cache, background/foreground behavior |
| Desktop Chrome | Reference WebGPU implementation |
| Browser without `navigator.gpu` | Unsupported-state verification |
| Slow/interrupted connection | Download recovery and consent behavior |

## 2. Requirement coverage matrix

| Requirement | Automated coverage | Manual coverage | Priority |
|---|---|---|---|
| LAB-001 Secret unlock | UT-UNLOCK-001–008, E2E-001 | UX-001, A11Y-001 | P0 |
| LAB-002 Persistent discovery | UT-STORAGE-001–004, E2E-002 | UX-002 | P0 |
| LAB-003 Labs isolation | E2E-003, INT-012 | REG-001–004 | P0 |
| MODEL-001 Capability detection | UT-MODEL-001–004, E2E-004 | GPU-001, UX-003 | P0 |
| MODEL-002 Explicit consent | UT-MODEL-005–007, E2E-005 | NET-001 | P0 |
| MODEL-003 Lifecycle | UT-MODEL-008–018, INT-001–004 | GPU-002–004 | P0 |
| MODEL-004 Pinned text assets | UT-CONFIG-001–006, SEC-001 | GPU-005 | P0 |
| MODEL-005 Cache management | UT-CACHE-001–007, INT-005–007 | PWA-001–004 | P0 |
| PHRASE-001 Custom preview | UT-SPEECH-001–004, E2E-006 | VOICE-001–003 | P1 |
| PHRASE-002 AI generation | UT-OUTPUT-001–010, INT-008, E2E-007 | GPU-006 | P0 |
| PHRASE-003 Candidate pack | UT-PHRASE-001–009, E2E-008 | UX-004 | P1 |
| DEBRIEF-001 Feedback capture | UT-FEEDBACK-001–010, E2E-009 | UX-005 | P0 |
| DEBRIEF-002 Grounded summary | UT-FACTS-001–009, INT-009, E2E-010 | UX-006 | P0 |
| DEBRIEF-003 Completion entry | INT-010, E2E-011 | REG-005 | P0 |
| PLAY-001 Prompt playground | UT-PLAY-001–006, E2E-012 | UX-007 | P1 |
| PLAY-002 Context simulator | UT-CONTEXT-001–008, E2E-013 | VOICE-004 | P1 |
| PLAY-003 Experiment registry | UT-REGISTRY-001–006 | UX-008 | P1 |
| TIMERAI-001 Timer proposal | UT-TIMERAI-001–014, E2E-014 | UX-009 | P0 |
| TIMERAI-002 Timer transformation | UT-TIMERAI-015–020, E2E-015 | UX-010 | P0 |
| SAFE-001 Timer independence | INT-011–013 | REG-001–008, PERF-004 | P0 |
| SAFE-002 Privacy | SEC-002–008 | NET-002–004 | P0 |
| SAFE-003 Accessibility | E2E-016 | A11Y-001–012 | P0 |
| SAFE-004 Licensing | LIC-001–007 | Release checklist | P0 |

## 3. Unit tests

Pure tests should live as `labs/*.test.ts` so they can run under the repository’s existing Node test command.

### 3.1 Unlock state

| ID | Scenario | Input/action | Expected result | Priority |
|---|---|---|---|---|
| UT-UNLOCK-001 | Initial activation | Count 0, valid tap | Count becomes 1; no hint | P0 |
| UT-UNLOCK-002 | Third activation | Count 2, valid tap | Count becomes 3; remaining count is 4 | P0 |
| UT-UNLOCK-003 | Seventh activation | Count 6, valid tap | State becomes unlocked | P0 |
| UT-UNLOCK-004 | Timeout | More than five seconds between taps | Count resets before accepting new tap | P0 |
| UT-UNLOCK-005 | Rapid extra activation | Already unlocked | State remains unlocked | P1 |
| UT-UNLOCK-006 | Credits interaction | Credits link event | Count unchanged | P0 |
| UT-UNLOCK-007 | Non-monotonic timestamp | Current time earlier than prior time | Sequence resets safely | P1 |
| UT-UNLOCK-008 | Exact boundary | Seventh tap at five-second boundary | Behavior matches documented inclusive/exclusive rule | P2 |

### 3.2 Versioned storage

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-STORAGE-001 | Valid Labs settings | Parsed and normalized | P0 |
| UT-STORAGE-002 | Invalid JSON | Defaults returned; no throw | P0 |
| UT-STORAGE-003 | Unknown schema version | Defaults returned; original record ignored | P0 |
| UT-STORAGE-004 | Hide Labs | Unlock false; unrelated data unchanged | P0 |
| UT-STORAGE-005 | Candidate cap exceeded | Oldest non-starred records evicted deterministically | P1 |
| UT-STORAGE-006 | Feedback cap exceeded | Retention policy applied deterministically | P1 |
| UT-STORAGE-007 | Storage write throws | Current in-memory result retained; recoverable result returned | P0 |

### 3.3 Model configuration and lifecycle

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-CONFIG-001 | Runtime URL under local root | Correct `/mentria/dist/mentria.mjs` URL | P0 |
| UT-CONFIG-002 | Runtime URL under GitHub subpath | Includes `/pulse-interval-timer/` once | P0 |
| UT-CONFIG-003 | Worker URL | Resolves beside vendored runtime | P0 |
| UT-CONFIG-004 | Model base URL | Contains exact revision, not `/main/` | P0 |
| UT-CONFIG-005 | Text-only options | No vision URL, shard, or config present | P0 |
| UT-CONFIG-006 | User input | Cannot alter runtime/model URLs | P0 |
| UT-MODEL-001 | No `navigator.gpu` | Unsupported result, no throw | P0 |
| UT-MODEL-002 | `requestAdapter()` returns null | Unsupported result, no throw | P0 |
| UT-MODEL-003 | Adapter throws | Recoverable unsupported/error result | P0 |
| UT-MODEL-004 | Supported adapter | Idle/cached state returned | P0 |
| UT-MODEL-005 | Open Labs | No `load()` call | P0 |
| UT-MODEL-006 | Decline consent | No runtime import or model fetch | P0 |
| UT-MODEL-007 | Approve consent | Exactly one load begins | P0 |
| UT-MODEL-008 | Duplicate load click | Same in-flight promise or no-op | P0 |
| UT-MODEL-009 | Load success | State becomes ready/base | P0 |
| UT-MODEL-010 | Load failure | State becomes recoverable error | P0 |
| UT-MODEL-011 | Progress event | Download state is clamped and normalized | P1 |
| UT-MODEL-012 | Generation before ready | Rejected without invoking engine | P0 |
| UT-MODEL-013 | Generation success | Tokens stream in order; state returns ready | P0 |
| UT-MODEL-014 | Duplicate generation | Second request rejected or disabled | P0 |
| UT-MODEL-015 | Abort generation | Engine receives abort; state returns ready | P0 |
| UT-MODEL-016 | Device lost | Generation ends; worker terminates; error shown | P0 |
| UT-MODEL-017 | Unload | GPU/worker released; cached state retained | P0 |
| UT-MODEL-018 | Quote adapter failure | Base-model fallback offered and labeled | P1 |

### 3.4 Cache ownership

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-CACHE-001 | Service-worker activation | Deletes obsolete `pulse-app-*` caches only | P0 |
| UT-CACHE-002 | Current app cache | Preserved | P0 |
| UT-CACHE-003 | Labs/model cache | Preserved during app update | P0 |
| UT-CACHE-004 | Unrelated origin cache | Preserved | P0 |
| UT-CACHE-005 | User deletes model | Only allowlisted Labs cache/database names targeted | P0 |
| UT-CACHE-006 | Cache API missing/throws | Recoverable error; app shell untouched | P1 |
| UT-CACHE-007 | Delete after engine ready | Engine terminates before cache deletion | P0 |

### 3.5 Generated-output cleanup

| ID | Input | Expected result | Priority |
|---|---|---|---|
| UT-OUTPUT-001 | Normal short phrase | Same normalized phrase | P0 |
| UT-OUTPUT-002 | Leading/trailing whitespace | Trimmed | P1 |
| UT-OUTPUT-003 | Matching straight quotes | Wrapping quotes removed | P1 |
| UT-OUTPUT-004 | Matching curly quotes | Wrapping quotes removed | P1 |
| UT-OUTPUT-005 | Qwen special token | Token removed | P0 |
| UT-OUTPUT-006 | `<think>` block | Block removed | P0 |
| UT-OUTPUT-007 | Empty after cleanup | Rejected | P0 |
| UT-OUTPUT-008 | Over maximum length | Rejected or visibly truncated according to final policy | P0 |
| UT-OUTPUT-009 | HTML/script text | Returned only as inert text | P0 |
| UT-OUTPUT-010 | Multiple paragraphs | Rejected for phrase mode | P1 |

### 3.6 Speech preview

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-SPEECH-001 | Empty phrase | No utterance created | P0 |
| UT-SPEECH-002 | Selected voice present | Utterance receives that voice | P1 |
| UT-SPEECH-003 | Saved voice absent | Falls back safely | P1 |
| UT-SPEECH-004 | Component exit | `speechSynthesis.cancel()` called | P0 |

### 3.7 Candidate phrases

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-PHRASE-001 | Valid candidate | All provenance fields stored | P1 |
| UT-PHRASE-002 | Same normalized phrase | Duplicate rejected | P1 |
| UT-PHRASE-003 | Same text, different casing/spacing | Duplicate rejected | P1 |
| UT-PHRASE-004 | Invalid personality | Record ignored | P0 |
| UT-PHRASE-005 | Invalid fatigue zone | Record ignored | P0 |
| UT-PHRASE-006 | Helpful rating update | Correct candidate updated | P1 |
| UT-PHRASE-007 | Delete candidate | Only selected record removed | P1 |
| UT-PHRASE-008 | Delete pack | Candidate storage cleared; model cache retained | P1 |
| UT-PHRASE-009 | Production phrase selection | Candidate pack is not consulted | P0 |

### 3.8 Workout feedback and facts

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-FEEDBACK-001 | Valid required fields | Record accepted | P0 |
| UT-FEEDBACK-002 | Effort below 1 | Rejected | P0 |
| UT-FEEDBACK-003 | Effort above 5 | Rejected | P0 |
| UT-FEEDBACK-004 | Unknown difficulty | Rejected | P0 |
| UT-FEEDBACK-005 | Note at limit | Accepted | P1 |
| UT-FEEDBACK-006 | Note above limit | Rejected or explicitly truncated | P1 |
| UT-FEEDBACK-007 | Same session updated | Existing record updated, not duplicated | P0 |
| UT-FEEDBACK-008 | Orphaned session ID | Ignored in UI without crash | P0 |
| UT-FEEDBACK-009 | Delete feedback | Workout session retained | P0 |
| UT-FEEDBACK-010 | Delete workout | Associated feedback remains orphan-safe or is explicitly removed | P1 |
| UT-FACTS-001 | Duration facts | Match the stored session exactly | P0 |
| UT-FACTS-002 | Rounds/cycles | Match the stored session exactly | P0 |
| UT-FACTS-003 | Current-week facts | Match progress helpers at the same `now` | P0 |
| UT-FACTS-004 | Streak facts | Match progress helpers | P0 |
| UT-FACTS-005 | Subjective feedback | Copied exactly after validation | P0 |
| UT-FACTS-006 | Optional note missing | Omitted, not invented | P0 |
| UT-FACTS-007 | Previous-session comparison | Calculated deterministically | P1 |
| UT-FACTS-008 | Empty history except current | No fabricated comparison | P0 |
| UT-FACTS-009 | Prompt builder | Contains only supplied facts and fixed instructions | P0 |

### 3.9 Playground and experiment registry

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-PLAY-001 | Temperature below range | Rejected/normalized visibly | P1 |
| UT-PLAY-002 | Temperature above range | Rejected/normalized visibly | P1 |
| UT-PLAY-003 | Token limit below range | Rejected/normalized visibly | P1 |
| UT-PLAY-004 | Token limit above range | Rejected/normalized visibly | P1 |
| UT-PLAY-005 | Unsaved conversation | Not persisted | P0 |
| UT-PLAY-006 | Explicit save | Provenance metadata included | P1 |
| UT-REGISTRY-001 | Unique experiment IDs | Registry accepted | P0 |
| UT-REGISTRY-002 | Duplicate ID | Build/test fails | P0 |
| UT-REGISTRY-003 | Unsupported capability | Disabled with reason | P1 |
| UT-REGISTRY-004 | Incomplete experiment | Maturity label shown | P1 |
| UT-REGISTRY-005 | Experiment ordering | Stable and explicit | P2 |
| UT-REGISTRY-006 | New experiment | No root-page change required | P1 |

### 3.10 Coach context simulator

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-CONTEXT-001 | Valid fresh context | Accepted | P1 |
| UT-CONTEXT-002 | Valid finishing context | Accepted | P1 |
| UT-CONTEXT-003 | Round above total | Rejected/normalized | P0 |
| UT-CONTEXT-004 | Cycle above total | Rejected/normalized | P0 |
| UT-CONTEXT-005 | Remaining above duration | Clamped by existing context logic | P1 |
| UT-CONTEXT-006 | Negative remaining | Clamped by existing context logic | P1 |
| UT-CONTEXT-007 | AI prompt | Contains selected context and no hidden workout data | P0 |
| UT-CONTEXT-008 | Deterministic comparison | Uses existing coach functions | P0 |

### 3.11 Timer proposals

| ID | Scenario | Expected result | Priority |
|---|---|---|---|
| UT-TIMERAI-001 | Valid delimited JSON | Parsed | P0 |
| UT-TIMERAI-002 | No delimiters | Rejected | P0 |
| UT-TIMERAI-003 | Malformed JSON | Rejected without throw | P0 |
| UT-TIMERAI-004 | Unknown fields | Ignored | P1 |
| UT-TIMERAI-005 | Missing required field | Rejected | P0 |
| UT-TIMERAI-006 | Non-numeric metric | Rejected | P0 |
| UT-TIMERAI-007 | Fractional repeat count | Rejected or rounded only by documented policy | P0 |
| UT-TIMERAI-008 | Work below 1 | Rejected | P0 |
| UT-TIMERAI-009 | Any field above editor maximum | Rejected with field error | P0 |
| UT-TIMERAI-010 | Name above 48 characters | Rejected/truncated according to visible policy | P1 |
| UT-TIMERAI-011 | Valid boundary values | Accepted | P0 |
| UT-TIMERAI-012 | Explanation contains HTML | Stored/rendered as inert text | P0 |
| UT-TIMERAI-013 | Proposal rejected | Draft unchanged | P0 |
| UT-TIMERAI-014 | Proposal confirmed | Normal editor draft populated once | P0 |
| UT-TIMERAI-015 | Easier transformation | Before/after diff accurate | P0 |
| UT-TIMERAI-016 | Harder transformation | Before/after diff accurate | P0 |
| UT-TIMERAI-017 | More-rest transformation | Unchanged fields remain unchanged | P0 |
| UT-TIMERAI-018 | Invalid transformation | Original timer preserved | P0 |
| UT-TIMERAI-019 | Apply then cancel editor | Saved timer preserved | P0 |
| UT-TIMERAI-020 | Apply then save | Uses normal save path and constraints | P0 |

## 4. Integration tests

### INT-001 — Runtime import under GitHub Pages base path

Build with `npm run build:github`, serve the export, approve model loading using a fake runtime module, and assert that runtime and worker URLs include `/pulse-interval-timer/` exactly once.

### INT-002 — Streaming generation

The fake engine emits several token events. Verify ordered rendering, a generating state during streaming, and a ready state afterward.

### INT-003 — Abort generation

Start a delayed fake generation, activate Stop, and verify the signal is aborted, partial output remains inert, and a new generation can start.

### INT-004 — Device loss

The fake engine reports device loss. Verify the controller terminates it, disables generation, preserves cached-state metadata, and offers retry.

### INT-005 — Cache survives service-worker update

Create current app, obsolete app, Labs model, and unrelated caches. Trigger the activation cleanup helper. Only the obsolete app cache is deleted.

### INT-006 — Delete model

Load a fake engine, create allowlisted model storage, delete the model, and verify termination occurs before deletion and the app-shell cache remains.

### INT-007 — Offline cached model

Mark the model cached, disable network, load the fake cached runtime path, and verify Labs does not demand a fresh download.

### INT-008 — Phrase generation to speech

Generate a phrase through the fake model, clean it, select a voice, and preview it through a mocked `speechSynthesis` implementation.

### INT-009 — Workout facts to debrief

Create a real `WorkoutSession`, calculate progress facts with existing progress helpers, generate through the fake model, and store the summary against the correct session ID.

### INT-010 — Completion-to-debrief navigation

Complete a short fake-timer sequence, verify one session is recorded, open the debrief CTA, and verify the form references that session.

### INT-011 — Active timer isolation

With a workout running, verify Labs cannot be entered through normal UI and no model callback is referenced by the timer interval.

### INT-012 — Labs exit cleanup

Exit Labs while a fake generation and speech preview are active. Verify generation abort, worker termination, speech cancellation, and unchanged timer/progress state.

### INT-013 — Model failure during unrelated timer state

Trigger a fake model crash, then start and complete a normal timer. All normal timing, cues, session recording, and progress updates must succeed.

## 5. Browser E2E journeys

E2E tests should use a fake model client selected only by test configuration. Production builds must not expose a user-controlled switch to the fake.

### E2E-001 — Unlock Labs

1. Open Settings with clean storage.
2. Activate the version label twice.
3. Assert no hint and no Labs row.
4. Activate a third time.
5. Assert “4 taps until Pulse Labs” is announced.
6. Activate four more times within the window.
7. Assert Labs is unlocked and its Settings row appears.
8. Reload and assert the row remains.

### E2E-002 — Hide and re-unlock

1. Start unlocked.
2. Hide Labs.
3. Assert the row disappears after returning to Settings.
4. Assert model deletion was not called.
5. Repeat the unlock sequence successfully.

### E2E-003 — Labs navigation isolation

1. Open Labs from Settings.
2. Inspect the overview.
3. Return to Settings.
4. Verify timer list, progress history, and settings equal their snapshots from before entry.

### E2E-004 — Unsupported browser

1. Remove/stub `navigator.gpu`.
2. Open Labs.
3. Assert unsupported explanation appears.
4. Assert no download button or runtime request appears.
5. Assert custom phrase system-voice preview remains available when Speech Synthesis exists.

### E2E-005 — Consent and download states

1. Open Labs supported and uncached.
2. Assert no model request.
3. Select Load model.
4. Assert size/consent dialog.
5. Decline and verify no request.
6. Retry and accept.
7. Emit fake progress and verify accessible progress.
8. Finish and verify Ready.

### E2E-006 — Custom phrase preview without model

1. Leave the model unloaded.
2. Open Phrase & Voice Studio.
3. Enter custom text.
4. Choose a personality and voice.
5. Preview and verify the mocked utterance properties.

### E2E-007 — Generate and compare phrase

1. Load fake model.
2. Choose personality, zone, intent, and adapter.
3. Generate.
4. Verify cleaned AI phrase and deterministic Pulse phrase are separately labeled.
5. Preview both.

### E2E-008 — Save candidate phrase

1. Generate a phrase.
2. Save it as candidate.
3. Reload Labs and verify it remains.
4. Attempt duplicate save and verify rejection.
5. Delete it and verify removal.

### E2E-009 — Save workout feedback without model

1. Seed one completed workout.
2. Open its debrief.
3. Enter effort and difficulty; optionally add a note.
4. Save without loading the model.
5. Reload and verify feedback remains.

### E2E-010 — Generate grounded debrief

1. Seed known workout/progress history.
2. Enter known feedback.
3. Verify displayed facts.
4. Generate a summary through the fake model.
5. Verify summary provenance is stored and no displayed fact changed.

### E2E-011 — Completion CTA

1. Unlock Labs.
2. Complete a minimal timer.
3. Assert the debrief CTA appears only after completion.
4. Open it and verify correct timer name/session.
5. Dismiss and verify the session remains in progress history.

### E2E-012 — Prompt playground

1. Load model.
2. Enter prompt and choose bounded settings.
3. Generate, stop, retry, and copy.
4. Reload Labs and verify conversation was not persisted.

### E2E-013 — Coach context simulator

1. Choose a final-round context.
2. Generate AI cue.
3. Verify deterministic cue is also shown.
4. Preview both with the same voice.

### E2E-014 — Timer proposal safety

1. Request a valid timer.
2. Fake model returns valid delimited JSON.
3. Verify preview and duration.
4. Decline and verify no timer/draft changed.
5. Repeat and accept.
6. Verify the normal editor opens with the proposed draft but nothing is saved yet.

### E2E-015 — Existing timer transformation

1. Select an existing timer.
2. Request more recovery.
3. Verify before/after diff.
4. Confirm into editor, then cancel.
5. Verify saved timer is unchanged.

### E2E-016 — Keyboard flow

Using keyboard only, unlock Labs, navigate the overview, open Phrase & Voice Studio, enter and preview text, return, and hide Labs. Focus must remain visible and logical.

## 6. Manual UX evaluation

These checks evaluate clarity and trust rather than implementation mechanics.

| ID | Evaluation | Pass criteria | Priority |
|---|---|---|---|
| UX-001 | Secret unlock | Sequence feels intentional; hint is understandable without making Labs look like a security boundary | P1 |
| UX-002 | Hide Labs | Difference between hiding Labs, deleting Labs data, and deleting the model is unmistakable | P0 |
| UX-003 | Unsupported device | Explanation is concise, accurate, and does not imply the whole timer is unsupported | P0 |
| UX-004 | Candidate phrase pack | Users can distinguish generated, saved-experimental, and production phrases | P1 |
| UX-005 | Feedback form | Effort/difficulty fields are quick to complete after exercise; private-note behavior is clear | P1 |
| UX-006 | Debrief trust | Deterministic facts and AI-written interpretation are visibly distinct | P0 |
| UX-007 | Prompt playground | Experimental controls are understandable and defaults produce bounded output | P1 |
| UX-008 | Experiment registry | Maturity and capability labels explain why items are experimental or unavailable | P1 |
| UX-009 | Timer proposal | User understands that the result is a draft and has not been saved or started | P0 |
| UX-010 | Timer transformation | Before/after changes are scannable and cancellation feels safe | P0 |

## 7. Real WebGPU test matrix

| ID | Scenario | Pass criteria | Priority |
|---|---|---|---|
| GPU-001 | Support probe | Correctly identifies usable adapter | P0 |
| GPU-002 | Cold model load | Progress shown; model becomes ready | P0 |
| GPU-003 | Warm model load | Uses cached assets; no full download | P0 |
| GPU-004 | Generation abort | Stops promptly and can generate again | P0 |
| GPU-005 | Network inspection | Only pinned text/tokenizer assets requested; no vision assets | P0 |
| GPU-006 | Quote adapter | Adapter loads, is labeled, and can fall back to base | P1 |
| GPU-007 | Repeated generations | No unbounded memory growth or crash across 20 short generations | P1 |
| GPU-008 | Exit Labs | Worker/GPU released; cached assets retained | P0 |
| GPU-009 | Background/foreground | Recover or show actionable error after suspension | P1 |
| GPU-010 | Low-memory/device loss | Normal Pulse remains usable after failure | P0 |

Record device, OS, browser, model revision, runtime revision, cold-load time, warm-load time, first-token latency, and outcome.

## 8. PWA and offline tests

| ID | Test | Pass criteria | Priority |
|---|---|---|---|
| PWA-001 | App update with cached model | Model cache remains | P0 |
| PWA-002 | Offline base app without model | Timer, editor, settings, progress work | P0 |
| PWA-003 | Offline Labs after completed download | Generation works | P0 |
| PWA-004 | Offline Labs before download | Clear download-needed message; no crash | P1 |
| PWA-005 | Delete model while offline | Cache removed; base app remains offline-capable | P0 |
| PWA-006 | Service-worker cache version bump | Old app cache removed, current app/model retained | P0 |
| PWA-007 | Installed standalone mode | Unlock, Labs navigation, voice preview work | P1 |

## 9. Voice tests

| ID | Scenario | Pass criteria | Priority |
|---|---|---|---|
| VOICE-001 | Recommended system voice | Selected voice used | P1 |
| VOICE-002 | No voices initially | Handles `voiceschanged`; controls recover | P1 |
| VOICE-003 | Speech unavailable | Preview disabled with explanation | P1 |
| VOICE-004 | AI/deterministic comparison | Same voice/rate/pitch inputs can preview both | P1 |
| VOICE-005 | Repeated preview | Previous speech cancels before next begins | P1 |
| VOICE-006 | Labs exit | All speech stops | P0 |

## 10. Accessibility tests

| ID | Area | Test | Pass criteria | Priority |
|---|---|---|---|---|
| A11Y-001 | Unlock | Screen reader/keyboard activation | Version is a button with clear label | P0 |
| A11Y-002 | Unlock hint | Live region | Remaining count announced once per relevant activation | P0 |
| A11Y-003 | Labs entry | Focus | Labs heading receives/logically follows focus | P1 |
| A11Y-004 | Model status | Live region | Important state changes announced without token spam | P0 |
| A11Y-005 | Progress | Semantics | Download percentage/value exposed | P0 |
| A11Y-006 | Experiment cards | Names/descriptions | Capability and maturity announced | P1 |
| A11Y-007 | Form controls | Labels/errors | Every input has name, state, and associated error | P0 |
| A11Y-008 | Voice controls | Keyboard | Select and sliders fully operable | P0 |
| A11Y-009 | Focus visibility | All screens | Visible focus indicator | P0 |
| A11Y-010 | Reduced motion | Download/generation animation | No essential information depends on animation | P1 |
| A11Y-011 | Text scaling/zoom | 200% browser zoom | No clipped required control; content scrolls | P0 |
| A11Y-012 | Contrast | Labs states/errors | WCAG AA for normal text and controls | P0 |

Manual screen-reader coverage should include VoiceOver on iPhone and one desktop screen reader/browser combination when feasible.

## 11. Privacy and security tests

| ID | Test | Pass criteria | Priority |
|---|---|---|---|
| SEC-001 | Asset provenance | Runtime/model URLs pinned to exact revisions | P0 |
| SEC-002 | Open Labs without loading | No Mentria/Hugging Face request | P0 |
| SEC-003 | Generate locally | No prompt content in network requests | P0 |
| SEC-004 | Save feedback | No network request | P0 |
| SEC-005 | Console inspection | No workout notes/prompts logged | P0 |
| SEC-006 | Generated HTML payload | Renders inertly; no script/event execution | P0 |
| SEC-007 | Model URL injection | User cannot alter configured origins/paths | P0 |
| SEC-008 | Explicit export | Export contains only previewed/confirmed fields | P1 |
| SEC-009 | Storage corruption | Invalid records ignored; no code execution | P0 |
| SEC-010 | Model deletion | Does not delete app/user workout data | P0 |

## 12. Network-condition tests

| ID | Condition | Expected behavior | Priority |
|---|---|---|---|
| NET-001 | Declined download | Zero model requests | P0 |
| NET-002 | Slow download | Progress remains responsive; user may leave safely | P1 |
| NET-003 | Interrupted download | Retry offered; normal app unaffected | P0 |
| NET-004 | Offline after cache | Local inference succeeds | P0 |
| NET-005 | Offline before cache | Clear actionable state | P1 |
| NET-006 | Hugging Face error | Status includes retry; no uncaught rejection | P0 |
| NET-007 | Wrong/missing pinned asset | Integrity/provenance failure is visible; no fallback to unpinned `main` | P0 |

## 13. Production regression tests

These tests are mandatory because Labs shares the root React page, storage origin, speech engine, and service worker.

| ID | Regression | Pass criteria | Priority |
|---|---|---|---|
| REG-001 | App launch, Labs never unlocked | Existing home UI and startup behavior unchanged | P0 |
| REG-002 | Create/edit/delete timer | Existing behavior unchanged | P0 |
| REG-003 | Run full timer | Phase deadlines and transitions correct | P0 |
| REG-004 | Pause/resume/reset/leave | Existing behavior unchanged | P0 |
| REG-005 | Complete workout | Exactly one session recorded; milestones correct | P0 |
| REG-006 | Voice coach | Existing cues, countdown, personalities, and phrases correct | P0 |
| REG-007 | Progress/reminders | Existing history, streaks, goals, calendar export correct | P0 |
| REG-008 | Offline base app | Still works without Labs/model cache | P0 |
| REG-009 | Model cache full/evicted | Base app continues to work | P0 |
| REG-010 | Labs model error | Base app continues to work | P0 |

## 14. Performance tests

| ID | Metric | Target | Priority |
|---|---|---|---|
| PERF-001 | Normal app, Labs never opened | No model/runtime request | P0 |
| PERF-002 | Normal app bundle impact | Labs UI/runtime lazy; no material startup regression | P0 |
| PERF-003 | Labs UI responsiveness during streaming | Input/Stop/Back remain interactive | P1 |
| PERF-004 | Timer drift after Labs use | Same tolerance as baseline timer tests | P0 |
| PERF-005 | Worker cleanup | Worker absent/terminated after leaving Labs | P0 |
| PERF-006 | 20 short generations | No monotonically unbounded memory growth | P1 |
| PERF-007 | Battery/thermal observation on iPhone | No inference during active workout; behavior documented | P1 |

Capture a baseline before implementation and compare the same build path/device after Labs is integrated.

## 15. Licensing tests

| ID | Test | Pass criteria | Priority |
|---|---|---|---|
| LIC-001 | Mentria runtime | MIT license included | P0 |
| LIC-002 | Runtime dependencies | Third-party license file included | P0 |
| LIC-003 | Model and quote adapter | Apache 2.0 attribution present | P0 |
| LIC-004 | Upstream Qwen | Apache 2.0 attribution present | P0 |
| LIC-005 | Source provenance | URLs and exact revisions documented | P0 |
| LIC-006 | Modified files | Modifications documented where required | P0 |
| LIC-007 | Branding | No endorsement/partnership claim | P0 |

## 16. Test data

### 15.1 Fake model responses

```json
{
  "phrase_valid": "Stay steady. Finish the round.",
  "phrase_special_tokens": "<think>draft</think>\n<|assistant|>\"Keep moving.\"<|im_end|>",
  "phrase_html": "<img src=x onerror=alert(1)> Keep moving.",
  "phrase_empty": "<think>nothing visible</think>",
  "timer_valid": "PULSE_TIMER_JSON_START{\"name\":\"Quick intervals\",\"prepare\":10,\"work\":30,\"rest\":30,\"rounds\":5,\"cycles\":2,\"cycleRest\":60,\"cooldown\":30}PULSE_TIMER_JSON_END",
  "timer_invalid": "PULSE_TIMER_JSON_START{\"work\":0,\"rounds\":999}PULSE_TIMER_JSON_END"
}
```

### 15.2 Workout fixtures

- One five-minute session with known round/cycle values.
- Two sessions on the same day.
- Sessions across a week boundary.
- A first-ever workout.
- A session that unlocks each existing milestone.
- A session with feedback but no AI summary.
- A session with feedback and a versioned AI summary.
- Orphaned feedback for a deleted session.

### 15.3 Storage fixtures

- Valid version 1 records.
- Invalid JSON.
- Unknown schema version.
- Wrong scalar/array/object types.
- Duplicate candidate phrases.
- Records at and above retention caps.
- Storage API throwing quota errors.

## 17. Test execution commands

During development:

```bash
npm test
npm run lint
npm run build:github
```

If Playwright is added, expose a separate command such as:

```bash
npm run test:e2e
```

Real WebGPU tests must record their environment in the execution table below.

## 18. Release gates

### 18.1 First Labs increment

- [ ] All LAB-* P0 tests pass.
- [ ] All MODEL-* P0 tests pass.
- [ ] All PHRASE-* P0 tests pass.
- [ ] SAFE-001 through SAFE-004 pass.
- [ ] All existing automated tests pass.
- [ ] REG-001 through REG-010 pass.
- [ ] PWA-001 through PWA-006 pass.
- [ ] GPU-001 through GPU-005 and GPU-008 pass on at least one iPhone and one desktop browser.
- [ ] Accessibility P0 tests pass.
- [ ] Privacy/security P0 tests pass.
- [ ] Licensing P0 tests pass.
- [ ] GitHub Pages production build passes.
- [ ] Public-repository safety review passes before commit/push.

### 18.2 Debrief increment

- [ ] All DEBRIEF-* P0 tests pass.
- [ ] Feedback can be saved without loading the model.
- [ ] Facts match existing progress functions exactly.
- [ ] Progress and workout history regressions pass.

### 18.3 Playground/timer-builder increment

- [ ] PLAY-* and TIMERAI-* P0 tests pass.
- [ ] Raw output remains inert.
- [ ] No malformed model output can mutate a timer.
- [ ] Confirm/cancel paths preserve original timer state.

## 19. Test execution record

Copy a row for every real test run.

| Date | Build/commit | Environment | Scope | Result | Tester | Notes/issues |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | commit | device/browser | test IDs | Pass/Fail/Blocked | name | links |

### Real WebGPU result template

| Field | Value |
|---|---|
| Commit | |
| Device | |
| OS | |
| Browser/version | |
| Runtime revision | |
| Model revision | |
| Cold download/load time | |
| Warm load time | |
| First-token latency | |
| 20-generation result | |
| Offline result | |
| Cache deletion result | |
| Issues | |

## 20. Bug report template

```markdown
### Summary

[Concise failure]

### Requirement/test

- Requirement: MODEL-003
- Test: GPU-004
- Priority: P0

### Environment

- Commit:
- Pulse version:
- Device:
- OS:
- Browser:
- Installed PWA: yes/no
- Runtime revision:
- Model revision:

### Preconditions

[Model cached, Labs unlocked, etc.]

### Steps

1.
2.
3.

### Expected

[Observable pass condition]

### Actual

[Observable failure; do not paste personal prompts or secrets]

### Evidence

[Redacted screenshot/log]
```

## 21. Document history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-08-30 | Initial Pulse Labs test specification mapped to implementation requirements. |
