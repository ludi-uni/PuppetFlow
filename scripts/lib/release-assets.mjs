import fs from "node:fs";
import path from "node:path";

const PORTABLE_ZIP_PATTERN = /^(puppetflow-studio-.+|pf-cli-.+)\.zip$/i;

export function isReleaseAsset(fileName) {
  return PORTABLE_ZIP_PATTERN.test(fileName);
}

export function collectReleaseAssets(rootDir, { onFile } = {}) {
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (isReleaseAsset(entry.name)) {
        files.push(fullPath);
        onFile?.(fullPath);
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

export function copyReleaseAssets(sourceDir, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const copied = [];

  for (const sourcePath of collectReleaseAssets(sourceDir)) {
    const baseName = path.basename(sourcePath);
    let destPath = path.join(outputDir, baseName);
    if (fs.existsSync(destPath)) {
      const prefix = path
        .relative(sourceDir, path.dirname(sourcePath))
        .replace(/[\\/]+/g, "-")
        .replace(/^-+|-+$/g, "");
      destPath = path.join(outputDir, prefix ? `${prefix}-${baseName}` : baseName);
    }
    fs.copyFileSync(sourcePath, destPath);
    copied.push(destPath);
  }

  return copied.sort();
}

export function copyDirectory(sourceDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

const SKIP_RELEASE_FILE = /\.(pdb|lib|exp|d)$/i;

export function stageWindowsLinuxPortable(releaseDir, stageDir, binaryName) {
  fs.mkdirSync(stageDir, { recursive: true });

  for (const entry of fs.readdirSync(releaseDir, { withFileTypes: true })) {
    const sourcePath = path.join(releaseDir, entry.name);
    const destPath = path.join(stageDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "resources") {
        copyDirectory(sourcePath, destPath);
      }
      continue;
    }

    if (SKIP_RELEASE_FILE.test(entry.name)) {
      continue;
    }

    const lower = entry.name.toLowerCase();
    const isBinary =
      lower === binaryName.toLowerCase() || lower === `${binaryName.toLowerCase()}.exe`;
    const isSharedLibrary = lower.endsWith(".dll") || lower.endsWith(".so");

    if (isBinary || isSharedLibrary) {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

export function findMacAppBundle(bundleMacosDir) {
  for (const entry of fs.readdirSync(bundleMacosDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      return path.join(bundleMacosDir, entry.name);
    }
  }

  throw new Error(`No .app bundle found in ${bundleMacosDir}`);
}

export function resolveStudioTargetRoot(platform, repoRoot) {
  const studioRoot = path.join(repoRoot, "apps/studio/src-tauri");
  if (platform === "macos") {
    return path.join(studioRoot, "target/universal-apple-darwin");
  }
  return path.join(studioRoot, "target");
}

export function portableZipName(label, version) {
  return `puppetflow-studio-${label}-${version}-portable.zip`;
}
