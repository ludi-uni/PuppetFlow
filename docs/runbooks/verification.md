# PuppetFlow Verification Runbook

Use this runbook when an implementation, subsystem, cross-cutting change, or release candidate needs an explicit verification selection. A command's existence in `package.json` does not make it mandatory for every task.

Before running commands, inspect the current working tree and preserve existing user changes. Do not run a command that can rewrite dirty generated files or otherwise overlap unrelated work until that ownership conflict is resolved.

## Levels

| Level | Change                                    | Verification                                                                                                                                                                                                         |
| ----- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Docs or text only                         | Check the changed content, syntax, links, and relevant formatting. Do not run a build, unit suite, or `pnpm verify` by default.                                                                                      |
| 1     | Localized implementation                  | Run the focused test or direct reproduction for the affected behavior. Add an affected-package static or build check only when it provides relevant evidence. Do not run full-repository verification by default.    |
| 2     | Subsystem change                          | Run affected package or subsystem tests, relevant type or lint checks, and a targeted integration check when the boundary changed. Use only commands actually provided by the affected package or repository.        |
| 3     | Cross-cutting change or release candidate | Run the appropriate aggregate tests, build, lint, format, and integration checks. `pnpm verify` is a candidate when its full scope and generated-preset behavior match the task and the working tree is safe for it. |

Start with the narrowest level that proves the requested behavior. Broaden only when the change crosses a boundary, a focused result exposes wider impact, repository policy requires it, or the task explicitly requests broader acceptance. Record exact commands and outcomes, then stop when the requested exit criteria pass.

`pnpm verify` runs lint, format checking, build, the full test suite, preset generation, and a generated-preset diff guard. Do not use it for an ordinary localized task or when existing dirty preset files could be rewritten or misclassified.
