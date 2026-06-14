import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  findPfScriptExtensionPackDuplicates,
  formatPfScriptDuplicateWarning,
  mergePfScriptIntoPreset,
  SPEC_SAMPLE_PFSCRIPT,
  tryCompilePfScriptSource,
} from "../utils/pfscript-preset";
import {
  applyEnterKey,
  applyTabKey,
  handleBackspaceAtIndent,
} from "../utils/pfscript-textarea";

interface PfScriptEditorProps {
  presetJson: string;
  applying: boolean;
  onPreviewJson: (behaviorJson: string) => void;
  onApply: (mergedPresetJson: string) => void;
  onStatus: (message: string, kind: "success" | "error" | "info") => void;
}

function applyTextEdit(
  textarea: HTMLTextAreaElement,
  nextValue: string,
  selectionStart: number,
  selectionEnd: number,
  onValueChange: (value: string) => void,
): void {
  onValueChange(nextValue);
  requestAnimationFrame(() => {
    textarea.selectionStart = selectionStart;
    textarea.selectionEnd = selectionEnd;
  });
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

  const updateSource = (nextSource: string) => {
    setSource(nextSource);
    setCompileError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    if (event.key === "Tab") {
      event.preventDefault();
      const result = applyTabKey(value, selectionStart, selectionEnd, event.shiftKey);
      applyTextEdit(textarea, result.value, result.selectionStart, result.selectionEnd, updateSource);
      return;
    }

    if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      const result = applyEnterKey(value, selectionStart, selectionEnd);
      applyTextEdit(textarea, result.value, result.selectionStart, result.selectionEnd, updateSource);
      return;
    }

    if (event.key === "Backspace" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const result = handleBackspaceAtIndent(value, selectionStart, selectionEnd);
      if (result) {
        event.preventDefault();
        applyTextEdit(textarea, result.value, result.selectionStart, result.selectionEnd, updateSource);
      }
    }
  };

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
      <p className="hint pfscript-editor-keys">
        <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> でインデント、<kbd>Enter</kbd>{" "}
        で自動インデント（<code>then</code> / <code>=</code> / <code>(</code> の後など）。
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
          onChange={(event) => updateSource(event.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder={`-- 例\nif interest > 0.7 then\n  smile = interest * 0.4\nend`}
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
            updateSource(SPEC_SAMPLE_PFSCRIPT);
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
