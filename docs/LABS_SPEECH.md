# Experimental speech scripts

Unlock Laptiva Labs by tapping the version number in Settings seven times within five seconds. Open Labs and enable **Use experimental speech engine**. The setting is local to the device and off by default. Hiding Labs disables it. The normal Voice coach setting still controls speech during workouts.

The experiment uses the browser's native system voices. It does not load the Labs text-generation model. Automatic workout selection uses local voices; an explicitly selected remote voice may require internet. If a concrete voice is unavailable, the script fails safely without switching voices. Retry from a user gesture once voices are available. The visible timer and existing sound cues remain authoritative.

## Preview studio

The script editor includes two-part command, status, delivery-change, and rehearsal-countdown presets in English, Argentine Spanish, and Brazilian Portuguese. Choose a system voice, base rate/pitch, and cancellation cutoff. Playback uses the app's master volume. Stop, restart, hiding Labs, and leaving the page cancel the complete sequence.

The **Workout example personality** selector and **Load Final round / Cycle rest / Recovery 1 / Recovery 2 / Cooldown** buttons load the actual authored workout scripts for that personality and the app's language. Press **Play script** to listen. Loading an example also loads its base delivery settings but does not change the workout personality in Settings. These examples are generated from the same catalog and budget selector used during workouts.

Edited scripts and rehearsal countdowns are preview-only. They are not stored as workout content. Existing generated candidate phrases remain separate from workout coaching.

Supported commands:

| Command | Behavior |
| --- | --- |
| `[[pause:450]]` | Wait at least 450 ms after the preceding utterance ends. |
| `[[rate:+0.12]]` | Set the persistent rate offset from the script base. |
| `[[pitch:-0.03]]` | Set the persistent pitch offset from the script base. |
| `[[volume:*0.7]]` | Use 70% of the current master volume. |
| `[[reset]]` | Restore all script settings to their defaults. |
| `[[reset:rate,pitch]]` | Restore selected settings. |
| `\[[` | Speak a literal opening `[[`. |

Punctuation never creates an implicit pause. Unknown or malformed commands disable playback. Scripts are bounded to 4,000 spoken characters, 32 executable steps, 5 seconds per pause, and 15 seconds of total pauses. Rate is clamped to 0.8–1.3 and pitch to 0.8–1.2. Volume cannot exceed the master setting. Lowering the master volume cancels active speech; the next script uses the new volume.

## Workout behavior

When enabled, all workout coach requests pass through `CoachSpeechDirector`. Flat `CoachSpeech` values are converted to a single step. Final-round commands have explicitly authored two-part versions with a 450 ms pause and a delivery change. Cycle-rest and the two-part energetic/calm cooldown cues also have authored pauses and a softer closing segment. Short cues and genuine countdown numbers remain single utterances.

Rest and cycle-rest messages rotate through two original recovery texts per personality and language; cooldown uses one reflection per personality and language (36 texts in total). These phrases use explicit 400–700 ms internal pauses, scoped rate/pitch changes, and subtle volume reductions. The visible message is the same text that is spoken, without markup. Switching the engine off restores the existing quote/reflection collection. The Voice coach and Coaching phrases switches still control speech. Contextual work interventions and completion messages remain flat.

Phase/recovery follow-ups form one script with a 400 ms inter-phrase pause. Before starting, the selector checks the remaining safe speaking window and tries authored delivery, plain delivery of the same words, the phase cue alone, then silence if even that cue is unlikely to fit. Authored recovery requires a personality-specific minimum budget as well as the speech estimate. This replaces the earlier fixed seven-second threshold. See [Coach delivery authoring](COACH_DELIVERY.md) for the catalog audit and expansion procedure.

The director owns the queue, priority, asynchronous pause timers, deadlines, and one final outcome per handle. `SpeechController` owns native events, voice loading, cancel/replacement behavior, pre-start retries, and an opt-in 30-second completion watchdog. Speech never adjusts the workout timeline.

Phase transitions replace old speech. The genuine countdown replaces optional speech, and each number expires against the next absolute second boundary. Optional phrases require a conservative estimated budget and expire 250 ms before the three-second countdown window. Estimates are admission checks, not duration guarantees. Native speech may start late, and cancellation cannot guarantee sample-accurate silence.

Backgrounding cancels scripts. Returning to the page refreshes voices and allows fresh cues derived from the timeline; it does not replay unfinished scripts. One concrete voice is kept throughout a workout, including retries. There is no native SSML, global pause/resume workaround, or Web Audio mixing of TTS.

## Verification

Automated coverage includes compiler limits/escaping, setting restoration, master-volume clamping, one-utterance sequencing, cancellation races, priority, deadline expiration in queue/pause/speech/retry, missing start/end, voice loss, persistence, unlock gating, and all localized final-round scripts.

Before promoting the feature out of Labs, manually test Safari on macOS, Safari and Home Screen mode on iPhone/iPad, desktop Chrome/Edge/Firefox, and Android Chrome. Cover cold voice loading, first user gesture, offline mode with downloaded voices, lock/unlock, app switching during both speech and pause, Bluetooth, a genuine countdown preempting a long phrase, and VoiceOver/TalkBack coexistence. Listen for unnatural segment boundaries and record actual end-to-next-start gaps. Desktop automated tests cannot establish iOS acoustic timing or background behavior.
