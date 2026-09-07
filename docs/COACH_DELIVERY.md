# Coach delivery authoring — Labs first pass

## Catalog audit

| Content | Existing catalog | This pass |
| --- | --- | --- |
| Phase announcements | 36 variants per language across four personalities | Explicit delivery for final round, cycle rest, and energetic/calm two-part cooldown cues. Preserve exact localized wording. |
| Rest and cycle-rest messages | 120 English quotes; 24 each in Spanish and Portuguese | Labs uses two original recovery texts per personality and language. Normal engine keeps the existing collection. |
| Cooldown reflections | 40 English texts; 14 each in Spanish and Portuguese | Labs uses one original reflection per personality and language. Normal engine is unchanged. |
| Contextual work interventions | 48 phrases per language | Keep flat in this pass; usually short and constrained by the countdown window. |
| Genuine countdown and completion | Three numeric cues per personality; completion included in phase catalog | Keep flat. No theatrical countdowns in workouts. |

The new recovery catalog has 36 texts: 24 rest texts and 12 cooldown reflections. All are original Laptiva Coach copy. Existing third-party quotations, attribution, translations, and credits are not edited or reassigned. The small Labs pool is intentional for listening tests; repetition is more noticeable than in the normal collection. Rest selection avoids immediate repetition and retains recent IDs across reloads. Display text and full spoken text come from the same authored thought pair.

## Delivery direction

| Personality | Wording and performance | Internal pause | Recovery minimum budget |
| --- | --- | --- | --- |
| Focused | Concrete, concise instructions; slightly slower closing thought | 450 ms | 6.5 s |
| Energetic | Positive acknowledgment, then a more relaxed recovery instruction | 400 ms | 7 s |
| Tough | Recovery treated as deliberate work; composed, slightly lower opening pitch | 500 ms | 6.5 s |
| Calm | Permission to slow down; longer space and gentler delivery | 700 ms | 8.5 s |

These budgets are for the recovery phrase alone, excluding the phase announcement and its 400 ms follow-up gap. The combined sequence must also fit its conservative estimate. Closing volume is 95% of the master setting, or 90% for Calm; never louder than the user's setting. Existing personality tuning is the base, and settings are clamped by the compiler. Each thought's changes are scoped: cue emphasis cannot leak into recovery, or recovery softness into a later command.

English examples:

- Focused: “Relax your shoulders.” → 450 ms → “Use this rest to reset.”
- Energetic: “That round counts!” → 400 ms → “Take a breath. Recharge for the next one.”
- Tough: “Recovery is part of the work.” → 500 ms → “Give it your attention.”
- Calm: “Let your shoulders soften.” → 700 ms → “Give your breathing time to settle.”

Each language has explicitly authored thought boundaries and idiomatic wording. Punctuation within a thought remains under the native voice's control. For example, the two sentences in the Energetic closing thought intentionally stay in one utterance. This is not a paced-breathing exercise: pauses do not prescribe an inhalation or exhalation duration.

## Time-budget policy

1. Derive the safe window from the existing monotonic workout timeline, including elapsed time when resuming.
2. Protect 250 ms before the final three-second countdown in prepare/work/rest; protect the last 250 ms for other phase transitions.
3. Choose the authored phase + recovery script only if its full estimate and recovery minimum fit.
4. Otherwise try the same words as flat utterances, retaining the inter-phrase gap.
5. If the follow-up still cannot fit, speak only the phase cue, using flat delivery if necessary. If that cannot fit either, remain silent.
6. Keep the original absolute deadline on the resulting operation. An unexpectedly slow voice can still be cut off; estimates cannot guarantee acoustic completion.

The visible text can remain available even when optional speech is omitted. Neither text selection nor speech can lengthen a rest, delay a transition, or reschedule the real countdown.

## Expansion procedure

Author recovery copy in `coach/recovery-scripts.ts` as a pair of complete thoughts, not a string split at punctuation. Keep IDs stable and unique. Add localized text for all three languages and use the appropriate personality voice. Maintain original text attribution when annotating existing material; never rewrite someone else's quote under their name.

Use `coach/workout-speech.ts` for phase delivery and budget variants. Exact ID/text matching deliberately falls back to flat speech when copy changes without updated annotations. Unknown or legacy follow-ups also stay flat.

In Labs, select a personality and load the actual workout examples. The editor receives an equivalent DSL version of the production script, so preview and workout delivery share the same source. Preview edits remain local to the studio and are not saved as workout content.

Before expanding the pool, compare each example on iPhone Safari and Home Screen mode, desktop Safari/Chrome/Firefox, and Android Chrome. Test a 30-second rest (full script), progressively shorter rests (plain/cue-only fallback), all personalities/languages, reduced master volume, backgrounding during an internal pause, and the genuine countdown interrupting slow speech. Listen for abrupt prosody resets and overly subtle or exaggerated pitch changes. Native voice listening tests cannot be replaced by fake timers.

Non-goals: rewriting the entire quote collection, adding fake countdowns to workouts, parsing punctuation automatically, changing workout timing, introducing cloud speech, changing the Web Audio mixer, or enabling the feature outside Labs.
