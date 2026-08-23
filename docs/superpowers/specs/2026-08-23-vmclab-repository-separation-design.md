# VMC Lab Repository Separation Design

**Date:** 2026-08-23
**Status:** Approved

## Context

The PuppetFlow working tree contains an untracked Python project:

- `pyproject.toml`
- `src/vmclab/`
- `tests/`

The project implements a headless VMC protocol testing toolkit, while PuppetFlow is a
pnpm/TypeScript monorepo that produces the character runtime, Studio, and CLI. VMC Lab
has its own Python build backend, dependencies, command-line entry point, and test
toolchain. Keeping both products at the same repository root makes ownership, CI,
packaging, and release boundaries ambiguous.

The current VMC Lab files are untracked. They must be preserved before PuppetFlow is
updated or its working tree is cleaned.

## Goals

1. Preserve the current VMC Lab source and tests without deleting or modifying the
   PuppetFlow copies.
2. Create an independent local repository at `D:\99.AITuber\VmcLab`.
3. Give the Python project its own documentation, ignore rules, environment, and
   verification workflow.
4. Record the imported snapshot in Git before making functional fixes.
5. Keep remote repository creation and removal of the PuppetFlow copies as separate,
   explicitly approved actions.

## Non-goals

- Fixing VMC Lab feature gaps during the separation.
- Publishing a Python package.
- Creating or pushing a GitHub repository.
- Deleting `pyproject.toml`, `src/vmclab/`, or `tests/` from PuppetFlow.
- Changing PuppetFlow runtime behavior, CI, packages, or release artifacts.
- Claiming VMC interoperability or production readiness.

## Approaches Considered

### 1. Independent sibling repository — selected

Create `D:\99.AITuber\VmcLab` and copy only the Python project inputs into it.

Advantages:

- Clear Node/Python build and release boundaries.
- Independent dependency and CI lifecycle.
- The PuppetFlow working copy remains an untouched recovery source until verification.
- VMC Lab can evolve as a protocol test tool without expanding PuppetFlow's root
  tooling.

Trade-off: cross-project integration tests will eventually need fixtures, released
artifacts, or an explicit checkout relationship.

### 2. `PuppetFlow/tools/vmclab`

This keeps all code in one repository, but requires Python setup in PuppetFlow CI,
additional root documentation, ownership rules, and mixed release semantics. That
overhead is not justified for the current standalone tool.

### 3. Preservation-only PuppetFlow branch

Committing the files to a temporary PuppetFlow branch would prevent data loss, but it
would not resolve the product boundary and would complicate later history extraction.

## Repository Contents

The initial VMC Lab repository will contain:

```text
VmcLab/
  .gitignore
  LICENSE
  README.md
  pyproject.toml
  src/
    vmclab/
  tests/
```

`LICENSE` will be copied from PuppetFlow because the existing `pyproject.toml` already
declares that file as its license source. A dedicated VMC Lab README will replace the
accidental dependency on PuppetFlow's root README.

The copy will exclude `.env` files, caches, virtual environments, pnpm content,
PuppetFlow documentation, and generated build artifacts.

## Separation Flow

1. Resolve and display the absolute source and destination paths.
2. Stop if the destination already exists with content; never overwrite an unknown
   directory.
3. Create the destination and copy `pyproject.toml`, `src/`, `tests/`, and `LICENSE`
   with literal paths. Do not move files.
4. Compare the copied Python source, tests, and project metadata against the originals.
5. Add a dedicated README and Python `.gitignore`.
6. Initialize a local Git repository on `main` and commit the imported snapshot with a
   message that records its unverified/prototype status.
7. Create `.venv`, install the declared project and development dependencies, and run
   pytest, Ruff, and mypy.
8. Record any verification failures without altering or deleting the PuppetFlow source.
9. Report the new repository path, commit ID, verification results, and unchanged
   PuppetFlow status.

Remote creation or push is a later external write and requires a separate user request.
Removal of the original untracked files is destructive and also requires separate
explicit approval after the new repository and commit have been verified.

## Failure Handling and Recovery

- **Destination already exists:** stop and report its contents. Do not merge or
  overwrite automatically.
- **Copy comparison fails:** stop. Keep both source and partial destination intact for
  inspection.
- **Git initialization or commit fails:** keep the copied files and report the exact
  blocker; do not touch PuppetFlow.
- **Dependency installation fails:** retain the snapshot commit and report the missing
  dependency or network failure.
- **Tests, Ruff, or mypy fail:** report the failures as imported technical debt. Do not
  rewrite the snapshot or remove the source copy.
- **Unexpected PuppetFlow tracked changes appear:** stop before committing or deleting
  anything further.

Because the process copies before it removes, rollback consists of abandoning the new
directory while the original untracked files remain available. No automatic deletion is
part of this design.

## Verification

The separation is accepted when:

1. `D:\99.AITuber\VmcLab` is a Git repository with an initial snapshot commit.
2. Every copied Python source and test file matches the PuppetFlow source copy.
3. The new repository contains no PuppetFlow `.env`, pnpm, worktree, or cache data.
4. pytest, Ruff, and mypy results are captured; failures are allowed only when reported
   explicitly as pre-existing imported debt.
5. PuppetFlow's tracked diff remains limited to the approved design and implementation
   plan documents on the design branch.
6. PuppetFlow's original untracked VMC Lab files still exist and remain unchanged.

## Follow-up Work

After separation, VMC Lab can address its known prototype gaps in independent commits,
including freeze/reorder faults, byte argument serialization, strict scenario
validation, malformed datagram handling, and wire-fidelity expectations. PuppetFlow can
then be synchronized to remote `main`, and removal of the duplicate untracked VMC Lab
files can be considered with explicit approval.
