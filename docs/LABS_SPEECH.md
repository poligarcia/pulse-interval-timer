# Experimental speech scripts

Unlock Laptiva Labs by tapping the version number in Settings seven times within five seconds. Open Labs and enable **Use experimental speech engine**. The setting is local to the device and off by default. Hiding Labs disables it. The normal Voice coach setting still controls speech during workouts.

The experiment uses the browser's native system voices. It does not load the Labs text-generation model. Automatic workout selection uses local voices; an explicitly selected remote voice may require internet. If a concrete voice is unavailable, the script fails safely without switching voices. Retry from a user gesture once voices are available. The visible timer and existing sound cues remain authoritative.

## Preview studio

The script editor includes two-part command, status, delivery-change, and rehearsal-countdown presets in English, Argentine Spanish, and Brazilian Portuguese. Choose a system voice, base rate/pitch, and cancellation cutoff. Playback uses the app's master volume. Stop, restart, hiding Labs, and leaving the page cancel the complete sequence.

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

When enabled, all workout coach requests pass through `CoachSpeechDirector`. Flat `CoachSpeech` values are converted to a single step. Final-round commands have explicitly authored two-part versions with a 450 ms pause and a delivery change; phases shorter than seven seconds keep the flat command. Existing phase/recovery follow-ups become one script with a 400 ms pause. Other copy remains flat.

The director owns the queue, priority, asynchronous pause timers, deadlines, and one final outcome per handle. `SpeechController` owns native events, voice loading, cancel/replacement behavior, pre-start retries, and an opt-in 30-second completion watchdog. Speech never adjusts the workout timeline.

Phase transitions replace old speech. The genuine countdown replaces optional speech, and each number expires against the next absolute second boundary. Optional phrases require a conservative estimated budget and expire 250 ms before the three-second countdown window. Estimates are admission checks, not duration guarantees. Native speech may start late, and cancellation cannot guarantee sample-accurate silence.

Backgrounding cancels scripts. Returning to the page refreshes voices and allows fresh cues derived from the timeline; it does not replay unfinished scripts. One concrete voice is kept throughout a workout, including retries. There is no native SSML, global pause/resume workaround, or Web Audio mixing of TTS.

## Verification

Automated coverage includes compiler limits/escaping, setting restoration, master-volume clamping, one-utterance sequencing, cancellation races, priority, deadline expiration in queue/pause/speech/retry, missing start/end, voice loss, persistence, unlock gating, and all localized final-round scripts.

Before promoting the feature out of Labs, manually test Safari on macOS, Safari and Home Screen mode on iPhone/iPad, desktop Chrome/Edge/Firefox, and Android Chrome. Cover cold voice loading, first user gesture, offline mode with downloaded voices, lock/unlock, app switching during both speech and pause, Bluetooth, a genuine countdown preempting a long phrase, and VoiceOver/TalkBack coexistence. Listen for unnatural segment boundaries and record actual end-to-next-start gaps. Desktop automated tests cannot establish iOS acoustic timing or background behavior.
