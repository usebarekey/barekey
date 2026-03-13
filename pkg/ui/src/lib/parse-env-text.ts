export type ParsedEnvEntry = {
  name: string;
  value: string;
  lineNumber: number;
};

export type ParsedEnvIssue = {
  lineNumber: number;
  rawLine: string;
  reason: string;
};

export type ParsedEnvResult = {
  entries: Array<ParsedEnvEntry>;
  issues: Array<ParsedEnvIssue>;
};

function unquoteEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  if (first === '"' || first === "'") {
    let escapeNext = false;
    let closingQuoteIndex = -1;
    for (let index = 1; index < value.length; index += 1) {
      const char = value[index];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === first) {
        closingQuoteIndex = index;
        break;
      }
    }

    const trailing = closingQuoteIndex === -1 ? "" : value.slice(closingQuoteIndex + 1).trimStart();
    if (closingQuoteIndex !== -1 && (trailing.length === 0 || trailing.startsWith("#"))) {
      const innerValue = value.slice(1, closingQuoteIndex);
      if (first === "'") {
        return innerValue;
      }

      return innerValue
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }

  const inlineCommentMatch = value.match(/\s+#/);
  if (inlineCommentMatch && inlineCommentMatch.index !== undefined) {
    const unquotedValue = value.slice(0, inlineCommentMatch.index).trimEnd();
    if (unquotedValue.length < 2) {
      return unquotedValue;
    }

    const quote = unquotedValue[0];
    const unquotedLast = unquotedValue[unquotedValue.length - 1];
    if ((quote === '"' || quote === "'") && unquotedLast === quote) {
      const innerValue = unquotedValue.slice(1, -1);
      if (quote === "'") {
        return innerValue;
      }

      return innerValue
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }

    return unquotedValue;
  }

  return value;
}

export function parseEnvText(text: string): ParsedEnvResult {
  const entries: Array<ParsedEnvEntry> = [];
  const issues: Array<ParsedEnvIssue> = [];
  const lines = text.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineNumber = lineIndex + 1;
    const line = lines[lineIndex] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const equalsIndex = withoutExport.indexOf("=");
    if (equalsIndex <= 0) {
      issues.push({
        lineNumber,
        rawLine: line,
        reason: "Missing '=' delimiter.",
      });
      continue;
    }

    const name = withoutExport.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      issues.push({
        lineNumber,
        rawLine: line,
        reason: "Variable name must match [A-Za-z_][A-Za-z0-9_]*.",
      });
      continue;
    }

    const valuePart = withoutExport.slice(equalsIndex + 1);
    entries.push({
      name,
      value: unquoteEnvValue(valuePart),
      lineNumber,
    });
  }

  return {
    entries,
    issues,
  };
}
