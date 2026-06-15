import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { saveTextFile } from "./save-text-file.js";

describe("saveTextFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses showSaveFilePicker when available", async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const createWritable = vi.fn(async () => ({ write, close }));
    const showSaveFilePicker = vi.fn(async () => ({
      name: "puppetflow.yaml",
      createWritable,
    }));

    vi.stubGlobal("showSaveFilePicker", showSaveFilePicker);

    const result = await saveTextFile({
      suggestedName: "puppetflow.yaml",
      contents: "version: 1",
      extensions: [".yaml"],
      mimeType: "text/yaml",
    });

    expect(result).toEqual({
      ok: true,
      fileName: "puppetflow.yaml",
      method: "picker",
    });
    expect(write).toHaveBeenCalledWith("version: 1");
    expect(close).toHaveBeenCalled();
  });

  it("returns cancelled when picker is dismissed", async () => {
    vi.stubGlobal(
      "showSaveFilePicker",
      vi.fn(async () => {
        const error = new Error("cancelled");
        error.name = "AbortError";
        throw error;
      }),
    );

    const result = await saveTextFile({
      suggestedName: "puppetflow.yaml",
      contents: "version: 1",
    });

    expect(result).toEqual({ ok: false, reason: "cancelled" });
  });
});
