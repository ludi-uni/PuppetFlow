# PuppetFlow CI, Pull Request, and Release Runbook

Read this runbook only when either condition applies:

- the change modifies `.github/workflows/**` or release automation; or
- the user or task explicitly requests an Issue workflow, pull request, push, merge, release, or branch completion.

Ordinary implementation does not trigger this runbook and does not require an Issue, branch-finishing workflow, or Draft Pull Request.

## GitHub Actions safety

- Give workflows explicit least-privilege `permissions`.
- Pin third-party actions to reviewed immutable commit SHAs and review their publisher, source, requested permissions, and release provenance.
- Do not expose secrets to untrusted code, forks, build output, or logs.
- Treat deployment, credential, and materially expanded workflow-permission changes as high risk and stop for explicit approval.

## Requested Issue or pull-request work

Use the supplied Issue or task specification as the scope and acceptance authority. Inspect the final diff and run verification proportional to the change before any requested external write. Create a Draft Pull Request only when the user, task, or applicable repository policy explicitly calls for one. Do not enable auto-merge or merge without explicit authorization.

## Requested release or branch completion

Use Level 3 in [the verification runbook](verification.md) when preparing a release candidate. Confirm the requested artifacts and release-specific exit criteria. A release request does not by itself authorize production deployment, secret changes, or destructive external operations; those require their own explicit current-task authorization.
