import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import type { Language } from "./types";

export const HOME = os.homedir();

/** Directories that never contain agent configuration worth editing. */
export const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".parcel-cache",
  "dist",
  "build",
  "out",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "target",
  "vendor",
  "Pods",
  "DerivedData",
  ".gradle",
  ".idea",
  ".terraform",
  ".serverless",
  ".pnpm-store",
  ".yarn",
  ".cache",
  ".DS_Store",
];

export const IGNORE_GLOBS = IGNORE_DIRS.map((d) => `**/${d}/**`);

/**
 * Files that hold credentials rather than configuration. Never listed, never
 * read, never written — the registry avoids them, this is the backstop.
 */
const SECRET_BASENAMES = new Set([
  "auth.json",
  ".credentials.json",
  "credentials.json",
  "oauth.json",
  "token.json",
  "tokens.json",
  ".env",
  ".netrc",
  "id_rsa",
  "id_ed25519",
]);

const SECRET_DIR_SEGMENTS = new Set([".ssh", ".gnupg", ".aws", "Keychains"]);

export function isSecretPath(abs: string): boolean {
  const base = path.basename(abs);
  if (SECRET_BASENAMES.has(base)) return true;
  if (base.endsWith(".pem") || base.endsWith(".key") || base.startsWith(".env.")) return true;
  return abs.split(path.sep).some((seg) => SECRET_DIR_SEGMENTS.has(seg));
}

export function tildify(abs: string): string {
  if (abs === HOME) return "~";
  return abs.startsWith(HOME + path.sep) ? "~" + abs.slice(HOME.length) : abs;
}

export function untildify(input: string): string {
  const trimmed = input.trim().replace(/^["']|["']$/g, "");
  if (trimmed === "~") return HOME;
  if (trimmed.startsWith("~/")) return path.join(HOME, trimmed.slice(2));
  return trimmed;
}

export function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export class PathError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Resolve a client-supplied path and confirm it sits inside one of the roots the
 * dashboard is allowed to touch (the home directory or a registered project).
 */
export async function resolveAllowed(
  raw: string | null,
  allowedRoots: string[],
): Promise<string> {
  if (!raw) throw new PathError("Missing `path`", 400);
  const abs = path.resolve(untildify(raw));
  if (isSecretPath(abs)) throw new PathError("Refusing to touch a credentials file", 403);

  // Resolve symlinks so a link cannot hop outside an allowed root.
  let real = abs;
  try {
    real = await fs.realpath(abs);
  } catch {
    // File may not exist yet (new config); fall back to the parent directory.
    try {
      real = path.join(await fs.realpath(path.dirname(abs)), path.basename(abs));
    } catch {
      real = abs;
    }
  }

  const roots = await Promise.all(
    allowedRoots.map(async (r) => {
      try {
        return await fs.realpath(r);
      } catch {
        return path.resolve(r);
      }
    }),
  );

  if (!roots.some((root) => isInside(real, root))) {
    throw new PathError("Path is outside the allowed roots", 403);
  }
  return real;
}

const LANGUAGE_BY_EXT: Record<string, Language> = {
  ".json": "json",
  ".jsonc": "jsonc",
  ".json5": "jsonc",
  ".toml": "toml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".mdc": "markdown",
  ".markdown": "markdown",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
};

export function detectLanguage(abs: string): Language {
  const base = path.basename(abs);
  const ext = path.extname(base).toLowerCase();
  if (LANGUAGE_BY_EXT[ext]) return LANGUAGE_BY_EXT[ext];
  if (base === ".cursorrules" || base === ".windsurfrules" || base === ".clinerules") return "markdown";
  if (base === ".goosehints") return "markdown";
  if (base === ".roomodes") return "yaml";
  return "text";
}
