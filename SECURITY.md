# Security Policy

## Supported versions

Security fixes are applied to the default branch (`main`) and may be backported at maintainers' discretion.

| Version       | Supported   |
| ------------- | ----------- |
| latest `main` | yes         |
| older tags    | best effort |

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Instead:

1. Use [GitHub private vulnerability reporting](https://github.com/puppetflow/puppetflow/security/advisories/new) if enabled for the repository, **or**
2. Open a minimal-security-details issue asking for a contact address.

Include:

- Description of the issue and impact
- Steps to reproduce
- Affected paths (package, app, or adapter)
- Suggested fix (if any)

We aim to acknowledge reports within **7 days** and provide a remediation plan or status update within **30 days**.

## Scope notes

- PuppetFlow sends motion data to **local viewers** (OSC/WebSocket). Treat untrusted Preset JSON, PFScript, and external input sources as untrusted input.
- Discord and other Node-only sources may use secrets via environment variables — never commit `.env` files.
- Studio and CLI bind to localhost by default; document any change that exposes network listeners.

## Safe defaults

- Keep `.env` out of git (see `.gitignore`)
- Run viewers and PuppetFlow on trusted machines for live streaming
- Review custom `.pfpreset` and `puppetflow.yaml` from third parties before running
