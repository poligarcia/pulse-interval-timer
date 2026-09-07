# Laptiva

Laptiva is an installable interval-timer PWA built for iPhone, desktop browsers and offline workouts.

## Timer structure

- **Prepare** runs once at the start.
- Every **round** contains one Work interval; Rest is inserted between rounds, not after the last round.
- A **cycle** repeats the entire group of rounds.
- **Rest between cycles** is inserted only between cycles.
- **Cooldown** runs once at the end.

Timers, their order and settings are stored locally in the browser. They are not synced to another browser or device.

## Progress

Before starting, a timer can be adjusted for the current session without changing the saved timer. Once the workout starts, its rounds and cycles are locked for that run.

Laptiva records a completed workout when its final phase finishes. A workout can also be paused, ended early and saved with its actual elapsed training and active Work time. The Progress screen summarizes training time, active Work time, workout sessions and active days across day, week and month views. It also shows active-day and configurable weekly active-day goal streaks, four durable training milestones and a reverse-chronological workout journal.

Workout history is stored locally on the current browser or installed PWA. Editing or deleting a timer does not rewrite past sessions because each history entry keeps a snapshot of its timer plan. Partial sessions are labeled separately; they contribute their actual time, while completed-workout milestones only count sessions that reached the final phase. Reset or explicitly discarded workouts are not added to Progress.

## Workout reminders

Laptiva remains a static, backend-free app. In Settings, users can choose workout days and a local time, then open a recurring iCalendar event with a display alarm in their device's calendar importer. Apple Calendar, Google Calendar or another calendar app handles the reminder after the event is imported, including while Laptiva is closed. The recurring event must be edited or removed in the calendar app.

True Web Push is intentionally not enabled in this release because scheduled push delivery requires a server to retain browser subscriptions and send messages at the selected time.

## Audio on iPhone

Laptiva sound effects use the Web Audio API. On iPhone, Web Audio follows the device's **Silent Mode**, so cues and ticking are muted while the crossed-out bell is visible—even if media volume is raised. Turn Silent Mode off from Control Center or the Action button, then tap Start or an audio preview to unlock sound for the session. Chrome on iOS follows the same system behavior.

The optional coach uses the system Speech Synthesis voices installed on the device. Focused, Energetic, Tough and Calm personalities vary their wording and delivery while keeping one concrete system voice for the full workout. The coach announces each phase and counts down 3–2–1 at the end of Prepare, Work and Rest. A separate **Coaching phrases** setting controls whether it also reads the more relaxed, context-aware Work cues and displayed Rest and Cooldown messages.

Automatic voice selection curates system voices from the active language family, avoids known novelty/effect voices, and applies a Female, Male or Surprise me preference where a known matching voice is available. A manually selected compatible system voice always wins. Web Speech does not expose voice gender or quality metadata, so unknown voices remain available under **Other system voices** and device/browser voice availability can vary. External-music ducking remains unavailable because iOS web apps cannot control another app's volume.

Laptiva bundles motivational and cooldown-message libraries for every supported language; message selection happens locally and works offline. The English motivational library is curated from the pinned, Apache-2.0-licensed Mentria Motivational Quotes dataset. English cooldown reflections are original Laptiva copy attributed to Laptiva Coach. Spanish and Portuguese messages are original, unattributed Laptiva copy. Source and license details for the English motivational collection ship in `public/third-party-notices.txt`.

When configured, optional Firebase/Google Analytics usage measurement loads only after consent and can send workout events with limited properties. Users can change their choice in Settings → Privacy; rejecting analytics does not affect workouts or local history.

## Languages

Laptiva supports English (`en`), Spanish for Argentina (`es-AR`, shared as `es`) and Portuguese for Brazil (`pt-BR`, shared as `pt`). A `?lang=` link takes precedence over the saved preference and browser language, so language-specific links are safe to share. Users can still change the language later in Settings.

The core timer, progress, reminders, calendar content, coach and PWA manifests are localized. Laptiva Labs intentionally remains an English-only experiment until it demonstrates enough product value to justify expanding its language scope. Static social-preview metadata defaults to English by design.

See [`docs/I18N.md`](docs/I18N.md) for architecture, copy conventions, QA coverage and the workflow for adding a language.

## Development

```bash
npm install
npm run dev
```

Laptiva Labs planning and verification are documented in:

- [`docs/IMPLEMENTATION_GUIDE.md`](docs/IMPLEMENTATION_GUIDE.md)
- [`docs/TEST_SPEC.md`](docs/TEST_SPEC.md)

Production is published only through GitHub Pages using `npm run build:github` and the included deployment workflow. Do not publish this project through ChatGPT Sites.
