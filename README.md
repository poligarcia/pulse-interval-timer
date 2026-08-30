# Pulse

Pulse is an installable interval-timer PWA built for iPhone, desktop browsers and offline workouts.

## Timer structure

- **Prepare** runs once at the start.
- Every **round** contains one Work interval; Rest is inserted between rounds, not after the last round.
- A **cycle** repeats the entire group of rounds.
- **Rest between cycles** is inserted only between cycles.
- **Cooldown** runs once at the end.

Timers, their order and settings are stored locally in the browser. They are not synced to another browser or device.

## Audio on iPhone

Pulse sound effects use the Web Audio API. On iPhone, Web Audio follows the device's **Silent Mode**, so cues and ticking are muted while the crossed-out bell is visible—even if media volume is raised. Turn Silent Mode off from Control Center or the Action button, then tap Start or an audio preview to unlock sound for the session. Chrome on iOS follows the same system behavior.

The optional coach uses the system Speech Synthesis voices installed on the device. Focused, Energetic, Tough and Calm personalities vary their wording and delivery while keeping one concrete system voice for the full workout. The coach announces each phase, reads the displayed Rest and Cooldown message, counts down 3–2–1 at the end of Prepare, Work and Rest, and occasionally adds context-aware cues based only on the timer's rounds, cycles and progress.

Automatic voice selection curates English system voices, avoids known novelty/effect voices, and applies a Female, Male or Surprise me preference where a known matching voice is available. A manually selected system voice always wins. Web Speech does not expose voice gender or quality metadata, so unknown voices remain available under **Other system voices** and device/browser voice availability can vary. External-music ducking remains unavailable because iOS web apps cannot control another app's volume.

Pulse bundles 120 curated motivational messages and 40 workout-specific cooldown reflections, so they work offline without sending workout activity to a third-party service. The motivational library is curated from the pinned, Apache-2.0-licensed Mentria Motivational Quotes dataset; source and license details ship in `public/third-party-notices.txt`.

## Development

```bash
npm install
npm run dev
```

The production Sites build uses `npm run build`. GitHub Pages uses `npm run build:github` and the included deployment workflow.
