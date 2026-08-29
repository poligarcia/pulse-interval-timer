# Pulse

Pulse is an installable interval-timer PWA built for iPhone, desktop browsers and offline workouts.

## Timer structure

- **Prepare** runs once at the start.
- Every **round** contains one Work interval; Rest is inserted between rounds, not after the last round.
- A **cycle** repeats the entire group of rounds.
- **Rest between cycles** is inserted only between cycles.
- **Cooldown** runs once at the end.

Timers and settings are stored locally in the browser. Audio uses the Web Audio API, so the first Start or preview tap unlocks sound on iOS. Voice cues and external-music ducking are deliberately not enabled in version 1.0 because browser voices vary by device and iOS web apps cannot control another app's volume.

## Development

```bash
npm install
npm run dev
```

The production Sites build uses `npm run build`. GitHub Pages uses `npm run build:github` and the included deployment workflow.
