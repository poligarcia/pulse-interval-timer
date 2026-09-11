# Drill Instructor experiment

English-only, device-local, and gated behind Labs **and** the experimental speech engine. Surprise Me always samples only the four standard personalities, including after Drill is unlocked.

## Try it

1. In Settings, tap the version control seven times to unlock Labs.
2. Open Labs and enable **Use experimental speech engine**. No model download is needed.
3. Return to Settings, select English, and enable Voice coach.
4. Tap **Surprise Me** seven times, with less than three seconds between taps. Later taps reveal clues; the seventh opens the classified briefing.
5. Choose **REPORT FOR DUTY**. Drill Instructor now shares the final row with Surprise Me.
6. Keep Coaching phrases on for optional dialogue and mind games. Enable sound effects for whistle cues.

The unlock persists locally. Disabling the engine, hiding Labs, or choosing another language makes Drill unavailable and changes an active Drill selection to Tough; re-enabling the prerequisites restores the tile, not its selection.

Labs → Speech scripts → **Drill Instructor auditions** offers all 70 authored phrases (including six fake countdowns and three post-pause endings), the mission briefing, the Settings preview, six procedural whistle previews, and 5/15/30/60-second planning examples. **Compact Drill delivery** lets you compare the shorter workout variants. The Settings preview always demonstrates full delivery. Labs previews do not change the workout personality or phrase history. Whistle previews respect Settings sound effects and master volume.

Settings → **Test coach** now plays the actual final-round command followed by the encouragement mind game, with their authored pauses, rate, pitch and volume changes. It is no longer one flat introductory utterance.

## Dialogue and planning

- An immutable-duration workout sequence is used to allocate speech before starting. The plan never modifies the timer.
- Prepare can deliver a mission briefing if it fits. Work, final work, rest, cycle rest, cooldown, pause, resume and completion have dedicated lines. Short phases fall back to a terse command or no speech.
- Each phrase in `coach/drill.ts` contains explicit `[[pause:...]]`, `[[rate:...]]`, `[[pitch:...]]`, `[[volume:*...]]`, and/or `[[reset]]` instructions. There are no pipe-based delivery rules. Commands accelerate, dry punchlines slow down, rare praise is restrained, and cooldown/recovery guidance is measured. Safety instructions remain at full master volume; effects never amplify above it.
- Before playback, the planner tries full delivery, then a compact version with the same words and ID, then skips the line if neither fits. Ordinary compact versions remove theatrical segmentation; already-brief commands may stay unchanged. Every fake has a separately authored compact script that retains both the count and its reveal. A running script is never rewritten into a different version halfway through.
- The planner reserves whistle clearance, estimated speech duration, 650 ms of additional startup headroom, explicit pauses, and the real countdown. Optional speech ends at least 3.25 seconds before the end of Prepare/Work/Rest, or 250 ms before other boundaries.
- Every optional slot has a latest start (at most 400 ms after its planned time) and a finish deadline. An occupied director, overdue callback, or insufficient remaining budget discards the slot. Missed speech is not replayed from a backlog.
- A fake countdown is considered in 20% of workouts, at most once, only in work phases of at least 30 seconds. It starts at ten seconds remaining and includes a compact spoken reveal before the protected countdown. Admission can still reject it; 20% is an eligibility rate, not a playback guarantee.
- During a fake the screen reminds the user to follow the real timer. When the script settles, it explains the rehearsal even if native speech failed or ran out of time. Pausing, changing phases and leaving the workout still take precedence.
- Native TTS cannot guarantee exactly spaced numbers or completion of a reveal after an unexpected interruption. Hard deadlines protect real workout timing; actual delivery requires device testing.
- Other mind games appear at most twice per workout. Delivery severity is randomized within bounded original copy, with at most two top-tier optional lines. Praise is sparse.
- Pause speech uses its own wall-clock window, independent of the frozen phase. Resume cancels it, discards nearby optional slots, and uses a short return command only if it fits. A user pause changes the completion response; praise is suppressed for the first 30 active seconds after resuming.
- Twenty recently started phrase IDs are retained locally. The last fake ID is separately retained so the next fake cannot repeat it after history rotation. Planned but skipped lines do not enter persistent history.

Whistles use layered high-frequency sine resonances, filtered breath noise, amplitude flutter and a sustained blast with short attack/release envelopes. They replace phase-transition beeps only for Drill. The regular countdown, optional ticking, sound toggle and master volume remain intact. Scheduled nodes are canceled on pause/reset/backgrounding and disconnected after playback. Noise buffers are cached per audio context and do not consume the coach planner's random source.

## Verification and remaining tuning

Automated coverage includes gating, Surprise exclusion, all 70 full/compact phrase pairs, exact Labs markup round-trips, Settings preview delivery, six fake budgets and distinct reveals, short intervals, phrase-off mode, 1,000 randomized plans, slot deadlines, pause/resume, phrase history, native speech overruns, whistle timing/gain/cancellation and existing coach regressions.

Listen on target browsers/devices before promoting this experiment. Check the perceived authority, whistle comfort, phrase repetition, fast pause/resume, and fake-reveal intelligibility with both local and remote system voices. Very slow voices can cause optional content to be skipped or truncated.

Deferred: multilingual writing, processed/ensemble voices, a persistent cross-workout rank/respect arc, and a detailed spoken After Action Report. No model-generated dialogue, user callsigns, intensity settings, or separate Mind Games toggle is introduced.
