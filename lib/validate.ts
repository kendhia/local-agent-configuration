import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import type { Language } from "./types";

export interface ValidationResult {
  ok: boolean;
  message?: string;
  /** 1-indexed line the parser blamed, when it reports one. */
  line?: number;
}

const OK: ValidationResult = { ok: true };

function lineFromJsonError(content: string, err: unknown): number | undefined {
  const message = err instanceof Error ? err.message : "";
  const posMatch = /position (\d+)/i.exec(message);
  if (posMatch) {
    const offset = Number(posMatch[1]);
    return content.slice(0, offset).split("\n").length;
  }
  const lineMatch = /line (\d+)/i.exec(message);
  return lineMatch ? Number(lineMatch[1]) : undefined;
}

/** Strips line and block comments so JSONC files can be checked as JSON. */
function stripJsonComments(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    const next = input[i + 1];
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) {
        if (input[i] === "\n") out += "\n";
        i += 1;
      }
      i += 1;
      continue;
    }
    out += c;
  }
  return out;
}

export function validate(content: string, language: Language): ValidationResult {
  if (content.trim() === "") return OK;
  try {
    switch (language) {
      case "json":
        JSON.parse(content);
        return OK;
      case "jsonc":
        JSON.parse(stripJsonComments(content));
        return OK;
      case "toml":
        parseToml(content);
        return OK;
      case "yaml":
        parseYaml(content);
        return OK;
      default:
        return OK;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message,
      line:
        language === "json" || language === "jsonc"
          ? lineFromJsonError(content, err)
          : lineFromParserError(err),
    };
  }
}

function lineFromParserError(err: unknown): number | undefined {
  const anyErr = err as { line?: number; linePos?: Array<{ line: number }> };
  if (typeof anyErr?.line === "number") return anyErr.line;
  if (Array.isArray(anyErr?.linePos) && anyErr.linePos[0]) return anyErr.linePos[0].line;
  const message = err instanceof Error ? err.message : "";
  const m = /line (\d+)/i.exec(message);
  return m ? Number(m[1]) : undefined;
}
