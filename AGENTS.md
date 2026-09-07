# Repository Instructions

## Deployment

Publish Laptiva through the existing GitHub Pages workflow only. Do not create, update, or deploy a ChatGPT Sites version of this project.

## Public-repository safety

Treat this repository as public. Every tracked file, commit message, author and committer field, workflow log, generated asset, and reachable Git object may become visible outside the project.

Before every commit or push:

- Review `git status --short`, the unstaged diff, and the complete staged diff.
- When multiple threads or agents share the working tree, identify ownership before staging. Stage only the explicit paths or hunks created for the current thread; never use `git add .`, `git add -A`, or `git commit -a`, and leave unrelated local changes untouched.
- Before a commit, scan staged content and the proposed commit metadata for API keys, access tokens, passwords, authorization headers, private keys, signed URLs, cookies, connection strings, credentials, and high-entropy secret-like values. Before a push, also scan newly reachable commits and their metadata using the history baseline described below.
- Treat added or modified generated, vendored, and minified bundles as untrusted input. Inspect their source maps and decode or decompress embedded text payloads, including `data:` URLs and base64 content; reject developer-only trackers, debug logs, absolute local paths, personal identifiers, or credentials even when they are encoded.
- Check added or modified filenames for `.env*`, key stores, certificates, private keys, credential files, local auth configuration, database dumps, and debug logs.
- Use the GitHub `noreply` address for both author and committer metadata. Do not publish a private or work email.
- Remove absolute local paths, personal contact details, private account identifiers, tenant IDs, and environment-specific deployment IDs unless the user explicitly confirms they are intentionally public.
- Inspect added or modified images and other binaries for EXIF, XMP, comments, embedded prompts, local paths, or credential-like strings. C2PA/JUMBF provenance metadata may remain only after confirming it contains no private fields and the user has accepted it as intentionally public.

Never commit real secrets. Example configuration may contain obvious placeholders only. In this public repository, `.openai/hosting.json` must not contain a `project_id` or other environment-specific identifier.

## History scan baseline

- Establish a clean baseline with a complete scan of the content and history reachable from the refs intended for publication. Record the scanned ref tips/commit IDs, scanner and policy version, and successful result in a local audit record; never include suspected secret values. Do not assume existing public history is clean.
- For subsequent pushes, verify that the baseline still covers unchanged ancestry under the same scanning policy. Scan every commit newly reachable from the exact refs being pushed, including merged branches, commit metadata, and added or modified assets. Review the resulting publishable tree for prohibited content as well.
- Run a complete reachable-history scan for the first publication, a missing or unverifiable baseline, rewritten or untrusted ancestry, a scanner/policy change, or a suspected leak. After remediation, scan the current tree and full reachable history again.
- Advance the baseline only after successful verification. If a required publication scan is unavailable or incomplete, report the gap and block the push; continue independent local work. An unchanged, verified baseline does not need a full rescan for every local commit.

If sensitive data may have entered any commit:

- Stop the push and do not print or repeat the suspected value.
- Report only the affected path, commit, and secret category in redacted form.
- Revoke or rotate actual credentials before treating history rewriting as remediation.
- Remove the data from the working tree and every reachable ref; use a force push only when the user has authorized rewriting published history.
- Re-run the current-tree and full-history scans after remediation.
