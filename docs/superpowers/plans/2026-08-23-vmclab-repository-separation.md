# VMC Lab Repository Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Preserve the untracked VMC Lab prototype in an independent local Git
repository without modifying or deleting its PuppetFlow source copy.

**Architecture:** Create `D:\99.AITuber\VmcLab` as a sibling of PuppetFlow, copy only
the Python project inputs, and record an exact local snapshot before running the Python
toolchain. Verification happens in the new repository, while PuppetFlow remains the
untouched recovery source.

**Tech Stack:** Windows PowerShell, Git, Python 3.12, Hatchling, pytest, Ruff, mypy

**Spec:**
`docs/superpowers/specs/2026-08-23-vmclab-repository-separation-design.md`

## Global Constraints

- The source is exactly `D:\99.AITuber\PuppetFlow`.
- The destination is exactly `D:\99.AITuber\VmcLab`.
- Copy files; never move them.
- Stop rather than overwrite a non-empty destination.
- Copy only `pyproject.toml`, `LICENSE`, `src/`, and `tests/` from PuppetFlow.
- Do not copy `.env` files, caches, virtual environments, pnpm content, worktrees,
  PuppetFlow documentation, or generated build artifacts.
- Do not modify or delete PuppetFlow's untracked `pyproject.toml`, `src/vmclab/`, or
  `tests/`.
- Do not create a remote, push, publish a package, or change PuppetFlow runtime code.
- Record the imported snapshot in Git before making any functional VMC Lab fixes.
- Verification failures are reported as imported technical debt; they do not authorize
  source rewrites or deletion of the recovery copy.

## File Structure

Files copied without modification:

- `D:\99.AITuber\PuppetFlow\pyproject.toml` →
  `D:\99.AITuber\VmcLab\pyproject.toml`
- `D:\99.AITuber\PuppetFlow\LICENSE` → `D:\99.AITuber\VmcLab\LICENSE`
- `D:\99.AITuber\PuppetFlow\src\vmclab\**` →
  `D:\99.AITuber\VmcLab\src\vmclab\**`
- `D:\99.AITuber\PuppetFlow\tests\**` → `D:\99.AITuber\VmcLab\tests\**`

Files created specifically for the independent repository:

- `D:\99.AITuber\VmcLab\README.md` — project purpose, setup, commands, verification,
  and prototype limitations
- `D:\99.AITuber\VmcLab\.gitignore` — Python environments, caches, reports, and local
  secrets
- `D:\99.AITuber\VmcLab\.git\**` — local repository metadata created by `git init`

No automation script is added. The separation is a one-time, auditable operation, so
the plan uses literal PowerShell commands and explicit comparisons.

---

### Task 1: Create and Commit the Preserved Snapshot

**Files:**

- Copy: `D:\99.AITuber\PuppetFlow\pyproject.toml`
- Copy: `D:\99.AITuber\PuppetFlow\LICENSE`
- Copy: `D:\99.AITuber\PuppetFlow\src\vmclab\**`
- Copy: `D:\99.AITuber\PuppetFlow\tests\**`
- Create: `D:\99.AITuber\VmcLab\README.md`
- Create: `D:\99.AITuber\VmcLab\.gitignore`
- Create: `D:\99.AITuber\VmcLab\.git\**`

**Interfaces:**

- Consumes: the approved spec and the untracked VMC Lab files under PuppetFlow
- Produces: a local `D:\99.AITuber\VmcLab` Git repository whose `main` branch contains
  an immutable imported snapshot and has no remote

- [ ] **Step 1: Validate the exact source and destination paths**

Run from PowerShell:

```powershell
$puppetFlowPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\PuppetFlow').Path
$vmcLabPath = [System.IO.Path]::GetFullPath('D:\99.AITuber\VmcLab')

if ($vmcLabPath -eq $puppetFlowPath) {
  throw 'VMC Lab destination resolves to the PuppetFlow source.'
}

$sourcePrefix = $puppetFlowPath.TrimEnd('\') + '\'
if ($vmcLabPath.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'VMC Lab destination must be a sibling, not a child of PuppetFlow.'
}

$requiredSources = @(
  (Join-Path $puppetFlowPath 'pyproject.toml'),
  (Join-Path $puppetFlowPath 'LICENSE'),
  (Join-Path $puppetFlowPath 'src\vmclab'),
  (Join-Path $puppetFlowPath 'tests')
)

$missingSources = @($requiredSources | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missingSources.Count -gt 0) {
  throw "Missing VMC Lab sources: $($missingSources -join ', ')"
}

if (Test-Path -LiteralPath $vmcLabPath) {
  $existingItems = @(Get-ChildItem -LiteralPath $vmcLabPath -Force)
  if ($existingItems.Count -gt 0) {
    throw "Destination already exists and is non-empty: $vmcLabPath"
  }
} else {
  New-Item -ItemType Directory -Path $vmcLabPath | Out-Null
}

"Source:      $puppetFlowPath"
"Destination: $vmcLabPath"
```

Expected: all four source paths exist, the destination is outside PuppetFlow, and the
destination is newly created or confirmed empty. Any other state stops the task.

- [ ] **Step 2: Copy only the approved project inputs**

Run:

```powershell
$puppetFlowPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\PuppetFlow').Path
$vmcLabPath = [System.IO.Path]::GetFullPath('D:\99.AITuber\VmcLab')

Copy-Item -LiteralPath (Join-Path $puppetFlowPath 'pyproject.toml') -Destination $vmcLabPath
Copy-Item -LiteralPath (Join-Path $puppetFlowPath 'LICENSE') -Destination $vmcLabPath
Copy-Item -LiteralPath (Join-Path $puppetFlowPath 'src') -Destination $vmcLabPath -Recurse
Copy-Item -LiteralPath (Join-Path $puppetFlowPath 'tests') -Destination $vmcLabPath -Recurse

Get-ChildItem -LiteralPath $vmcLabPath -Force | Select-Object Name,Mode,Length
```

Expected top-level entries at this point: `LICENSE`, `pyproject.toml`, `src`, and
`tests`. There must be no `.env`, `.venv`, pnpm, worktree, or cache directory.

- [ ] **Step 3: Verify that every copied input matches its source**

Run:

```powershell
$puppetFlowPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\PuppetFlow').Path
$vmcLabPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\VmcLab').Path

$comparisons = @(
  @((Join-Path $puppetFlowPath 'pyproject.toml'), (Join-Path $vmcLabPath 'pyproject.toml')),
  @((Join-Path $puppetFlowPath 'LICENSE'), (Join-Path $vmcLabPath 'LICENSE')),
  @((Join-Path $puppetFlowPath 'src'), (Join-Path $vmcLabPath 'src')),
  @((Join-Path $puppetFlowPath 'tests'), (Join-Path $vmcLabPath 'tests'))
)

foreach ($comparison in $comparisons) {
  git diff --no-index --exit-code -- $comparison[0] $comparison[1]
  if ($LASTEXITCODE -ne 0) {
    throw "Copied content differs: $($comparison[0]) -> $($comparison[1])"
  }
}

'All copied inputs match their PuppetFlow sources.'
```

Expected: each `git diff --no-index` exits 0 and prints no diff. On any mismatch, leave
both directories intact and stop before Git initialization.

- [ ] **Step 4: Create the dedicated README**

Create `D:\99.AITuber\VmcLab\README.md` with exactly this initial content:

````markdown
# VMC Lab

Headless VMC Protocol testing toolkit for generating, sending, recording, replaying,
inspecting, and validating VMC OSC traffic.

## Status

VMC Lab is a prototype separated from PuppetFlow for independent development and
verification. It currently supports message-level testing and does not claim wire-level
capture fidelity or production interoperability certification.

## Requirements

- Python 3.12 or newer

## Setup

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

## Commands

```powershell
& .\.venv\Scripts\vmclab.exe --help
& .\.venv\Scripts\vmclab.exe send --pose t-pose
& .\.venv\Scripts\vmclab.exe generate --motion idle --duration 5s
& .\.venv\Scripts\vmclab.exe record --output capture.jsonl --duration 5s
& .\.venv\Scripts\vmclab.exe inspect capture.jsonl
& .\.venv\Scripts\vmclab.exe validate capture.jsonl
```

The default send target is `127.0.0.1:39539`. The default record listener is
`0.0.0.0:39540`.

## Verification

```powershell
& .\.venv\Scripts\python.exe -m pytest
& .\.venv\Scripts\python.exe -m ruff check src tests
& .\.venv\Scripts\python.exe -m mypy src/vmclab
& .\.venv\Scripts\python.exe -m pip check
```

## Prototype limitations

- Freeze and reorder fault modules are empty in the imported snapshot.
- OSC bundle grouping and timetag fidelity are not preserved during replay.
- Scenario validation accepts a narrower set of constraints than a production schema.
- Hardware and third-party VMC interoperability are not certified.

## License

Apache-2.0. See `LICENSE`.
````

Expected: `pyproject.toml` now resolves its declared `README.md` within the new project,
and the README does not describe PuppetFlow's Node or Studio setup.

- [ ] **Step 5: Create the Python ignore policy**

Create `D:\99.AITuber\VmcLab\.gitignore` with exactly this content:

```gitignore
# Python environments and bytecode
.venv/
__pycache__/
*.py[cod]
*$py.class

# Test, type, lint, and coverage caches
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
coverage.xml
htmlcov/

# Packaging output
build/
dist/
*.egg-info/
*.whl
.hatch/

# Local environment and logs
.env
.env.*
!.env.example
*.log

# Operating system files
.DS_Store
Thumbs.db
```

Expected: `.venv`, Python caches, reports, build output, local secrets, and logs cannot
enter the snapshot commit.

- [ ] **Step 6: Initialize Git and inspect the exact snapshot boundary**

Run:

```powershell
$vmcLabPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\VmcLab').Path

git -C $vmcLabPath init -b main
git -C $vmcLabPath remote -v
git -C $vmcLabPath status --short
git -C $vmcLabPath add -- .gitignore LICENSE README.md pyproject.toml src tests
git -C $vmcLabPath diff --cached --check
git -C $vmcLabPath diff --cached --name-status
```

Expected:

- `git remote -v` prints nothing.
- The staged paths are only `.gitignore`, `LICENSE`, `README.md`, `pyproject.toml`,
  `src/**`, and `tests/**`.
- `git diff --cached --check` exits 0.

- [ ] **Step 7: Commit the imported prototype snapshot**

Run:

```powershell
$vmcLabPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\VmcLab').Path

git -C $vmcLabPath commit -m "chore: import VMC Lab prototype snapshot"
git -C $vmcLabPath show --stat --oneline --decorate HEAD
git -C $vmcLabPath status --short --branch
```

Expected: one root commit on `main`, no configured remote, and a clean VMC Lab working
tree.

---

### Task 2: Bootstrap and Verify the Python Project

**Files:**

- Create, ignored: `D:\99.AITuber\VmcLab\.venv\**`
- Modify: none of the tracked snapshot files

**Interfaces:**

- Consumes: the committed VMC Lab snapshot from Task 1
- Produces: an installed editable package plus recorded pytest, Ruff, mypy, and pip
  integrity outcomes

- [ ] **Step 1: Confirm the repository is clean and Python satisfies the version floor**

Run from a new PowerShell session:

```powershell
$vmcLabPath = [System.IO.Path]::GetFullPath('D:\99.AITuber\VmcLab')

git -C $vmcLabPath status --short
if ($LASTEXITCODE -ne 0) {
  throw 'VMC Lab repository is unavailable.'
}

python -c "import sys; assert sys.version_info >= (3, 12), sys.version; print(sys.version)"
if ($LASTEXITCODE -ne 0) {
  throw 'Python 3.12 or newer is required.'
}
```

Expected: Git prints no changed files and Python prints version 3.12 or newer.

- [ ] **Step 2: Create the isolated virtual environment**

Run:

```powershell
$vmcLabPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\VmcLab').Path

Set-Location -LiteralPath $vmcLabPath
python -m venv .venv
& .\.venv\Scripts\python.exe -c "import sys; print(sys.executable); print(sys.version)"
```

Expected: the executable path is
`D:\99.AITuber\VmcLab\.venv\Scripts\python.exe` and the command exits 0.

- [ ] **Step 3: Install the project and declared development dependencies**

Run:

```powershell
Set-Location -LiteralPath 'D:\99.AITuber\VmcLab'

& .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

Expected: editable `vmclab==0.1.0`, `python-osc`, `PyYAML`, pytest, Ruff, mypy, and
`types-PyYAML` install successfully. If dependency resolution or network access fails,
retain the snapshot commit and report the exact pip error without altering PuppetFlow.

- [ ] **Step 4: Smoke-test the installed package and console entry point**

Run:

```powershell
Set-Location -LiteralPath 'D:\99.AITuber\VmcLab'

& .\.venv\Scripts\python.exe -c "import vmclab; print(vmclab.__file__)"
& .\.venv\Scripts\vmclab.exe --version
& .\.venv\Scripts\vmclab.exe --help
```

Expected:

- The imported module resolves under `D:\99.AITuber\VmcLab\src\vmclab`.
- `vmclab --version` prints `vmclab 0.1.0`.
- Help lists `send`, `generate`, `record`, `replay`, `inspect`, `validate`, and `run`.

- [ ] **Step 5: Run all four verification gates and retain every outcome**

Run:

```powershell
Set-Location -LiteralPath 'D:\99.AITuber\VmcLab'

& .\.venv\Scripts\python.exe -m pytest
$pytestExit = $LASTEXITCODE

& .\.venv\Scripts\python.exe -m ruff check src tests
$ruffExit = $LASTEXITCODE

& .\.venv\Scripts\python.exe -m mypy src/vmclab
$mypyExit = $LASTEXITCODE

& .\.venv\Scripts\python.exe -m pip check
$pipCheckExit = $LASTEXITCODE

[pscustomobject]@{
  pytest = $pytestExit
  ruff = $ruffExit
  mypy = $mypyExit
  pip_check = $pipCheckExit
} | Format-List
```

Expected on a fully healthy snapshot: nine pytest tests pass and all four exit codes are 0. A non-zero result is preserved as imported technical debt; do not edit functional
source during this separation task.

- [ ] **Step 6: Confirm verification generated no tracked changes**

Run:

```powershell
$vmcLabPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\VmcLab').Path

git -C $vmcLabPath status --short --branch
git -C $vmcLabPath remote -v
```

Expected: the VMC Lab working tree remains clean and `git remote -v` remains empty. If
a cache or report appears, stop and report its exact path rather than staging it.

---

### Task 3: Prove Cross-Repository Integrity and Hand Off

**Files:**

- Modify: none
- Delete: none

**Interfaces:**

- Consumes: the committed VMC Lab snapshot and Task 2 verification results
- Produces: final evidence that the independent repository is recoverable and the
  PuppetFlow source remains untouched

- [ ] **Step 1: Recompare the final copied inputs with PuppetFlow**

Run:

```powershell
$puppetFlowPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\PuppetFlow').Path
$vmcLabPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\VmcLab').Path

$comparisons = @(
  @((Join-Path $puppetFlowPath 'pyproject.toml'), (Join-Path $vmcLabPath 'pyproject.toml')),
  @((Join-Path $puppetFlowPath 'LICENSE'), (Join-Path $vmcLabPath 'LICENSE')),
  @((Join-Path $puppetFlowPath 'src'), (Join-Path $vmcLabPath 'src')),
  @((Join-Path $puppetFlowPath 'tests'), (Join-Path $vmcLabPath 'tests'))
)

foreach ($comparison in $comparisons) {
  git diff --no-index --exit-code -- $comparison[0] $comparison[1]
  if ($LASTEXITCODE -ne 0) {
    throw "Final integrity check failed: $($comparison[0]) -> $($comparison[1])"
  }
}
```

Expected: copied `pyproject.toml`, `LICENSE`, `src`, and `tests` remain byte-equivalent
to their PuppetFlow sources. README and `.gitignore` are intentionally new and are not
part of this comparison.

- [ ] **Step 2: Verify the VMC Lab repository is locally recoverable**

Run:

```powershell
$vmcLabPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\VmcLab').Path

git -C $vmcLabPath rev-parse --show-toplevel
git -C $vmcLabPath log -1 --format='%H %s'
git -C $vmcLabPath status --porcelain=v1
git -C $vmcLabPath remote -v
```

Expected:

- The top level is `D:/99.AITuber/VmcLab`.
- The latest commit subject is `chore: import VMC Lab prototype snapshot`.
- Status and remote output are empty.

- [ ] **Step 3: Verify PuppetFlow still contains its recovery copy**

Run:

```powershell
$puppetFlowPath = (Resolve-Path -LiteralPath 'D:\99.AITuber\PuppetFlow').Path

$requiredRecoveryPaths = @(
  (Join-Path $puppetFlowPath 'pyproject.toml'),
  (Join-Path $puppetFlowPath 'src\vmclab'),
  (Join-Path $puppetFlowPath 'tests')
)

$requiredRecoveryPaths | ForEach-Object {
  if (-not (Test-Path -LiteralPath $_)) {
    throw "PuppetFlow recovery source is missing: $_"
  }
  "Preserved: $_"
}

git -c safe.directory=D:/99.AITuber/PuppetFlow -C $puppetFlowPath status --short --branch
```

Expected: all three recovery paths exist. They remain untracked in PuppetFlow, and no
implementation step has deleted or moved them.

- [ ] **Step 4: Report the separation outcome**

The final report must state all of the following using the exact outputs collected in
Task 2 and Task 3:

- Repository path `D:\99.AITuber\VmcLab`.
- Full snapshot commit hash and subject from `git log -1`.
- Confirmation that `git remote -v` prints no remote.
- pytest exit code plus its passed and failed counts.
- Ruff exit code plus its diagnostic count.
- mypy exit code plus its error count.
- `pip check` exit code and result text.
- Confirmation that PuppetFlow's recovery copy is preserved.
- Confirmation that no files were deleted and no external writes occurred.

Do not create a remote or delete the PuppetFlow copy as part of the reporting step.
