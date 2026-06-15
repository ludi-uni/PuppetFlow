import { parseVersionTag } from "./semver-version.mjs";

export function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }

  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function resolveNextReleaseTag({
  latestTag,
  headIsTagged,
  manualVersion,
  skipRelease,
}) {
  if (skipRelease) {
    return { tag: "", shouldRelease: false };
  }

  if (manualVersion) {
    const raw = manualVersion.startsWith("v") ? manualVersion : `v${manualVersion}`;
    const parsed = parseVersionTag(raw);
    if (!parsed.ok) {
      throw new Error(`Invalid manual version: ${manualVersion}`);
    }
    return { tag: `v${parsed.version}`, shouldRelease: true };
  }

  if (headIsTagged) {
    return { tag: "", shouldRelease: false };
  }

  if (!latestTag) {
    return { tag: "v0.1.0", shouldRelease: true };
  }

  const parsed = parseVersionTag(latestTag);
  if (!parsed.ok) {
    return { tag: "v0.1.0", shouldRelease: true };
  }

  return { tag: `v${bumpPatch(parsed.version)}`, shouldRelease: true };
}
