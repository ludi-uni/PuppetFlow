import { execSync } from "node:child_process";
import fs from "node:fs";
import { parseVersionTag } from "./lib/semver-version.mjs";
import { resolveNextReleaseTag } from "./lib/next-version.mjs";

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
}

function listSemverTags() {
  try {
    execSync("git fetch --tags --force", { stdio: "ignore" });
  } catch {
    // Offline or no remote — use local tags only.
  }

  const output = git('tag -l "v*" --sort=-v:refname');
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => parseVersionTag(tag).ok);
}

function headIsTagged(headSha, tags) {
  for (const tag of tags) {
    try {
      const tagSha = git(`rev-list -n 1 ${tag}`);
      if (tagSha === headSha) {
        return true;
      }
    } catch {
      // Ignore invalid tags.
    }
  }

  return false;
}

function shouldSkipRelease(commitMessage) {
  return commitMessage.includes("[skip release]");
}

const manualVersion = process.env.MANUAL_VERSION?.trim() || "";
const commitMessage = git("log -1 --pretty=%B");
const headSha = git("rev-parse HEAD");
const tags = listSemverTags();
const latestTag = tags[0] ?? null;

const result = resolveNextReleaseTag({
  latestTag,
  headIsTagged: headIsTagged(headSha, tags),
  manualVersion,
  skipRelease: shouldSkipRelease(commitMessage),
});

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${result.tag}\n`);
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `should_release=${result.shouldRelease}\n`,
  );
}

if (result.shouldRelease) {
  console.log(`Next release tag: ${result.tag}`);
} else {
  console.log("Release skipped for this commit.");
}
