export type SaveTextFileResult =
  | { ok: true; fileName: string; method: "picker" | "download" }
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "error"; message: string };

export interface SaveTextFileOptions {
  suggestedName: string;
  contents: string;
  description?: string;
  extensions?: string[];
  mimeType?: string;
}

export interface SaveFilesToDirectoryEntry {
  fileName: string;
  contents: string;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}

function buildPickerTypes(options: SaveTextFileOptions) {
  const extensions = options.extensions ?? [];
  const mimeType = options.mimeType ?? "text/plain";
  return [
    {
      description: options.description ?? "File",
      accept: {
        [mimeType]: extensions,
      },
    },
  ];
}

function fallbackDownload(options: SaveTextFileOptions): SaveTextFileResult {
  const blob = new Blob([options.contents], {
    type: options.mimeType ?? "text/plain",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { ok: true, fileName: options.suggestedName, method: "download" };
}

function getGlobal(): typeof globalThis {
  return globalThis;
}

export function canPickSaveLocation(): boolean {
  return typeof getGlobal().showSaveFilePicker === "function";
}

export function canPickSaveDirectory(): boolean {
  return typeof getGlobal().showDirectoryPicker === "function";
}

export async function saveTextFile(
  options: SaveTextFileOptions,
): Promise<SaveTextFileResult> {
  const global = getGlobal();
  if (typeof global.showSaveFilePicker === "function") {
    try {
      const handle = await global.showSaveFilePicker({
        suggestedName: options.suggestedName,
        types: buildPickerTypes(options),
      });
      const writable = await handle.createWritable();
      await writable.write(options.contents);
      await writable.close();
      return { ok: true, fileName: handle.name, method: "picker" };
    } catch (error) {
      if (isAbortError(error)) {
        return { ok: false, reason: "cancelled" };
      }

      return {
        ok: false,
        reason: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return fallbackDownload(options);
}

async function writeFileToDirectory(
  directory: FileSystemDirectoryHandle,
  fileName: string,
  contents: string,
): Promise<void> {
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

export type SaveFilesToDirectoryResult =
  | {
      ok: true;
      directoryName: string;
      fileNames: string[];
      method: "picker" | "download";
    }
  | { ok: false; reason: "cancelled" }
  | { ok: false; reason: "error"; message: string };

export async function saveFilesToDirectory(
  entries: SaveFilesToDirectoryEntry[],
): Promise<SaveFilesToDirectoryResult> {
  if (entries.length === 0) {
    return { ok: false, reason: "error", message: "No files to save." };
  }

  if (typeof getGlobal().showDirectoryPicker === "function") {
    try {
      const directory = await getGlobal().showDirectoryPicker({ mode: "readwrite" });
      const fileNames: string[] = [];
      for (const entry of entries) {
        await writeFileToDirectory(directory, entry.fileName, entry.contents);
        fileNames.push(entry.fileName);
      }

      return {
        ok: true,
        directoryName: directory.name,
        fileNames,
        method: "picker",
      };
    } catch (error) {
      if (isAbortError(error)) {
        return { ok: false, reason: "cancelled" };
      }

      return {
        ok: false,
        reason: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  for (const entry of entries) {
    fallbackDownload({
      suggestedName: entry.fileName,
      contents: entry.contents,
    });
  }

  return {
    ok: true,
    directoryName: "Downloads",
    fileNames: entries.map((entry) => entry.fileName),
    method: "download",
  };
}
