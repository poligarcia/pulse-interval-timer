# Backup and restore

In Settings, **Export backup** saves a JSON file. Where supported, the browser opens a Save As picker for a location and filename. Otherwise it downloads using the browser's configured download behavior. **Choose backup to restore** reads a local file, shows a preview, and waits for confirmation before replacing local data and reloading the app.

Included:

- Every effective app setting, plus the exporting version's default values.
- App version, backup format version, and export timestamp.
- Language, timer configurations in library order, and recent timer IDs in home order.
- All saved completed and stopped workouts, including IDs, timestamps, local dates, timezone offsets, timer snapshots, planned metrics, and actual metrics.
- Experimental preferences, saved phrase candidates, and coach selection memory.

Calendar events, OS/browser permissions, analytics consent, downloaded model caches, and an in-progress workout are not transferred. The backup controls are unavailable during an active or paused workout. The file is local and unencrypted; keep it somewhere you trust. Export does not provide automatic or server recovery.

## Compatibility contract

The current envelope uses `format: "laptiva-backup"` and `schemaVersion: 1`. Unknown envelope versions are rejected because their layout cannot safely be interpreted. Different app versions are allowed after review. Increment the envelope version for incompatible layout changes; add an explicit migration before accepting another envelope version.

The importer compares saved defaults with current defaults, restores supported explicit values, fills missing settings with current defaults, and reports changes. It validates ranges and enums, removes unknown fields, drops invalid or duplicate records, and removes home references to missing timers while keeping valid ordering. Existing version 1 workout histories use the existing history migration and are marked as changed. Device-specific voices that are unavailable are reset to automatic with a warning.

Preview is pure and does not modify storage. Exact imports still require replacement confirmation; partial imports list changes and use a separate confirmation label. Malformed/foreign files and files over 20 MB are rejected. Export enforces the same size limit. Storage writes are restricted to supported app keys and roll back on failure; if browser storage also prevents rollback, the UI reports that explicitly. Multiple-key localStorage writes are not crash-atomic: keep the original backup until restore has succeeded, and avoid concurrent use in other tabs during restore.

## Validation and coverage

- `npm test` runs all unit tests, including backup validation, round trips, completed/stopped metadata, migration, defaults, ordering, malformed input, storage rollback, Save As cancellation, write failures, and download fallback.
- `npm run test:coverage` uses Node 22's built-in coverage support and writes `coverage/lcov.info` plus a terminal summary. No coverage service or credentials are needed.
- The Tests and coverage workflow runs on pull requests and main pushes and retains the LCOV report as an artifact. Minimums are 95% lines, 85% branches, and 77% functions for modules loaded by the unit tests.
- This is **unit-module coverage**, not whole-app or browser UI coverage. Unloaded modules and React components are not included in Node's report. The initial measured baseline is approximately 95.8% lines, 86.7% branches, and 78.1% functions. Expand the measurement scope as component/browser automation is added rather than treating these numbers as whole-app coverage.

Browser verification for this feature covers a compatible import, partial preview, cancellation, replacement, persistence after reload, and the Settings controls. The browser connection ended during the export check, so export download feedback was not verified in the browser. The native Save As API is covered with a test double; native device dialogs still warrant testing on target phones and browsers.
