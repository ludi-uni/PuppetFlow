export const PFSCRIPT_INDENT = "  ";

const BLOCK_OPENER =
  /\b(then|else|elseif\b.*)\s*(--.*)?$|\($/i;

export function getLineIndent(line: string): string {
  return line.match(/^[\t ]*/)?.[0]?.replace(/\t/g, PFSCRIPT_INDENT) ?? "";
}

export function dedentLinePrefix(indent: string): string {
  if (indent.startsWith(PFSCRIPT_INDENT)) {
    return indent.slice(PFSCRIPT_INDENT.length);
  }
  if (indent.startsWith("\t")) {
    return indent.slice(1);
  }
  return indent;
}

export function shouldIncreaseIndentOnBreak(trimmedLinePrefix: string): boolean {
  const trimmed = trimmedLinePrefix.trimEnd();
  if (!trimmed || trimmed.startsWith("--")) {
    return false;
  }
  if (BLOCK_OPENER.test(trimmed)) {
    return true;
  }
  return /=(\s*(--.*)?)?$/.test(trimmed);
}

export function computeNextLineIndent(currentLine: string, cursorInLine: number): string {
  const base = getLineIndent(currentLine);
  const beforeCursor = currentLine.slice(0, cursorInLine);
  const trimmedLine = currentLine.trim();

  if (trimmedLine === "end") {
    return dedentLinePrefix(base);
  }

  if (shouldIncreaseIndentOnBreak(beforeCursor)) {
    return base + PFSCRIPT_INDENT;
  }

  return base;
}

export interface TextEditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function insertTextAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): TextEditResult {
  return {
    value: value.slice(0, selectionStart) + insert + value.slice(selectionEnd),
    selectionStart: selectionStart + insert.length,
    selectionEnd: selectionStart + insert.length,
  };
}

function lineRange(value: string, selectionStart: number, selectionEnd: number): {
  lineStart: number;
  lineEnd: number;
} {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextBreak = value.indexOf("\n", selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  return { lineStart, lineEnd };
}

export function indentSelectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  unindent = false,
): TextEditResult {
  const { lineStart, lineEnd } = lineRange(value, selectionStart, selectionEnd);
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  let startDelta = 0;
  let endDelta = 0;

  const modified = lines.map((line, index) => {
    if (!unindent) {
      if (index === 0) {
        startDelta = PFSCRIPT_INDENT.length;
      }
      if (index === lines.length - 1) {
        endDelta = PFSCRIPT_INDENT.length;
      }
      return PFSCRIPT_INDENT + line;
    }

    if (line.startsWith(PFSCRIPT_INDENT)) {
      if (index === 0) {
        startDelta = -PFSCRIPT_INDENT.length;
      }
      if (index === lines.length - 1) {
        endDelta = -PFSCRIPT_INDENT.length;
      }
      return line.slice(PFSCRIPT_INDENT.length);
    }

    if (line.startsWith("\t")) {
      if (index === 0) {
        startDelta = -1;
      }
      if (index === lines.length - 1) {
        endDelta = -1;
      }
      return line.slice(1);
    }

    return line;
  });

  const nextValue = value.slice(0, lineStart) + modified.join("\n") + value.slice(lineEnd);
  const nextStart = Math.max(lineStart, selectionStart + startDelta);
  const nextEnd = Math.max(nextStart, selectionEnd + endDelta);

  return {
    value: nextValue,
    selectionStart: nextStart,
    selectionEnd: nextEnd,
  };
}

export function handleBackspaceAtIndent(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult | null {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const linePrefix = value.slice(lineStart, selectionStart);

  if (!/^[ \t]+$/.test(linePrefix)) {
    return null;
  }

  if (linePrefix.endsWith(PFSCRIPT_INDENT)) {
    const remove = PFSCRIPT_INDENT.length;
    return {
      value: value.slice(0, selectionStart - remove) + value.slice(selectionEnd),
      selectionStart: selectionStart - remove,
      selectionEnd: selectionStart - remove,
    };
  }

  if (linePrefix.endsWith("\t")) {
    return {
      value: value.slice(0, selectionStart - 1) + value.slice(selectionEnd),
      selectionStart: selectionStart - 1,
      selectionEnd: selectionStart - 1,
    };
  }

  return null;
}

export function applyEnterKey(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextEditResult {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionStart);
  const currentLine = value.slice(
    lineStart,
    lineEnd === -1 ? value.length : lineEnd,
  );
  const cursorInLine = selectionStart - lineStart;
  const nextIndent = computeNextLineIndent(currentLine, cursorInLine);
  return insertTextAtSelection(value, selectionStart, selectionEnd, `\n${nextIndent}`);
}

export function applyTabKey(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  shiftKey: boolean,
): TextEditResult {
  if (selectionStart !== selectionEnd) {
    return indentSelectedLines(value, selectionStart, selectionEnd, shiftKey);
  }

  if (shiftKey) {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const linePrefix = value.slice(lineStart, selectionStart);
    if (linePrefix.endsWith(PFSCRIPT_INDENT)) {
      const remove = PFSCRIPT_INDENT.length;
      return {
        value: value.slice(0, selectionStart - remove) + value.slice(selectionEnd),
        selectionStart: selectionStart - remove,
        selectionEnd: selectionStart - remove,
      };
    }
    if (linePrefix.endsWith("\t")) {
      return {
        value: value.slice(0, selectionStart - 1) + value.slice(selectionEnd),
        selectionStart: selectionStart - 1,
        selectionEnd: selectionEnd - 1,
      };
    }
    return { value, selectionStart, selectionEnd };
  }

  return insertTextAtSelection(
    value,
    selectionStart,
    selectionEnd,
    PFSCRIPT_INDENT,
  );
}
