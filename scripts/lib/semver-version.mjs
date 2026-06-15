export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;

export function parseVersionTag(raw) {
  const version = raw.replace(/^v/, "");
  if (!SEMVER_PATTERN.test(version)) {
    return { ok: false, version, raw };
  }
  return { ok: true, version, raw };
}
