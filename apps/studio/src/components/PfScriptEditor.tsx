import { useEffect, useMemo, useState } from "react";
import {
  findPfScriptExtensionPackDuplicates,
  formatPfScriptDuplicateWarning,
  mergePfScriptIntoPreset,
  SPEC_SAMPLE_PFSCRIPT,
  tryCompilePfScriptSource,
} from "../utils/pfscript-preset";

interface PfScriptEditorProps {
  presetJson: string;
  applying: boolean;
  onPreviewJson: (behaviorJson: string) => void;
  onApply: (mergedPresetJson: string) => void;
  onStatus: (message: string, kind: "success" | "error" | "info") => void;
}

export function PfScriptEditor({
  presetJson,
  applying,
  onPreviewJson,
  onApply,
  onStatus,
}: PfScriptEditorProps) {
  const [source, setSource] = useState("");
  const [previewJson, setPreviewJson] = useState("");
  const [compileError, setCompileError] = useState<{
    message: string;
    line?: number;
    column?: number;
  } | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(presetJson) as { behaviorPfScript?: unknown };
      if (typeof parsed.behaviorPfScript === "string") {
        setSource(parsed.behaviorPfScript);
        return;
      }
    } catch {
      // keep current editor contents while preset JSON is invalid
    }
  }, [presetJson]);

  const duplicateWarning = useMemo(
    () =>
      formatPfScriptDuplicateWarning(
        findPfScriptExtensionPackDuplicates(presetJson, source),
      ),
    [presetJson, source],
  );

  const handleCompile = () => {
    const trimmed = source.trim();
    if (!trimmed) {
      setCompileError({ message: "PFScript が空です。" });
      setPreviewJson("");
      onPreviewJson("");
      return;
    }

    const result = tryCompilePfScriptSource(trimmed);
    if (!("behaviorJson" in result)) {
      setCompileError(result);
      setPreviewJson("");
      onPreviewJson("");
      onStatus(`コンパイル失敗: ${result.message}`, "error");
      return;
    }

    setCompileError(null);
    setPreviewJson(result.behaviorJson);
    onPreviewJson(result.behaviorJson);
    onStatus("PFScript をコンパイルしました。", "success");
  };

  const handleApply = () => {
    const trimmed = source.trim();
    if (!trimmed) {
      onStatus("PFScript が空のため Preset に適用できません。", "error");
      return;
    }

    const result = tryCompilePfScriptSource(trimmed);
    if (!("behaviorJson" in result)) {
      setCompileError(result);
      onStatus(`適用できません: ${result.message}`, "error");
      return;
    }

    try {
      const merged = mergePfScriptIntoPreset(presetJson, trimmed, result.behavior);
      setCompileError(null);
      setPreviewJson(result.behaviorJson);
      onPreviewJson(result.behaviorJson);
      onApply(merged);
      onStatus("PFScript を Preset に適用しました。", "success");
    } catch (error) {
      onStatus(
        error instanceof Error ? error.message : "Preset への適用に失敗しました。",
        "error",
      );
    }
  };

  return (
    <section className="pfscript-editor">
      <p className="hint">
        PFScript（上級者向け DSL）で behavior を記述します。「コンパイル」で behavior AST
        をプレビューし、「Preset に適用」で <code>behaviorPfScript</code> とコンパイル済み{" "}
        <code>behavior</code> を保存します。Graph / behaviorPlugins は保持されます。
      </p>

      {duplicateWarning ? (
        <p className="duplicate-pack-warning" role="status">
          {duplicateWarning}
        </p>
      ) : null}

      <label className="preset-editor-label">
        <span>PFScript</span>
        <textarea
          className="preset-editor pfscript-source"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setCompileError(null);
          }}
          spellCheck={false}
          placeholder={`-- 例\nsmile = interest * 0.4\nmouthOpen = volume`}
        />
      </label>

      <div className="pfscript-actions">
        <button type="button" onClick={handleCompile}>
          コンパイル
        </button>
        <button
          type="button"
          className="primary"
          disabled={applying}
          onClick={handleApply}
        >
          Preset に適用
        </button>
        <button
          type="button"
          onClick={() => {
            setSource(SPEC_SAMPLE_PFSCRIPT);
            setCompileError(null);
            onStatus("公式サンプルを挿入しました。", "info");
          }}
        >
          サンプルを挿入
        </button>
      </div>

      {compileError ? (
        <p className="pfscript-error" role="alert">
          {compileError.message}
          {compileError.line !== undefined && compileError.column !== undefined
            ? ` （行 ${compileError.line}, 列 ${compileError.column}）`
            : null}
        </p>
      ) : null}

      {previewJson ? (
        <details className="pfscript-preview" open>
          <summary>behavior JSON プレビュー</summary>
          <pre>{previewJson}</pre>
        </details>
      ) : null}
    </section>
  );
}
