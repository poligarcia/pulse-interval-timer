# Repository Instructions

## Public-repository safety

Treat this repository as public. Every tracked file, commit message, author and committer field, workflow log, generated asset, and reachable Git object may become visible outside the project.

Before every commit or push:

- Review `git status --short`, the unstaged diff, and the complete staged diff.
- Scan staged content and all reachable history for API keys, access tokens, passwords, authorization headers, private keys, signed URLs, cookies, connection strings, credentials, and high-entropy secret-like values.
- Check filenames for `.env*`, key stores, certificates, private keys, credential files, local auth configuration, database dumps, and debug logs.
- Use the GitHub `noreply` address for both author and committer metadata. Do not publish a private or work email.
- Remove absolute local paths, personal contact details, private account identifiers, tenant IDs, and environment-specific deployment IDs unless the user explicitly confirms they are intentionally public.
- Inspect generated images and other binaries for EXIF, comments, embedded prompts, local paths, or credential-like strings.

Never commit real secrets. Example configuration may contain obvious placeholders only. In this public repository, `.openai/hosting.json` must not contain a `project_id` or other environment-specific identifier.

If sensitive data may have entered any commit:

- Stop the push and do not print or repeat the suspected value.
- Report only the affected path, commit, and secret category in redacted form.
- Revoke or rotate actual credentials before treating history rewriting as remediation.
- Remove the data from the working tree and every reachable ref; use a force push only when the user has authorized rewriting published history.
- Re-run the current-tree and full-history scans after remediation.
