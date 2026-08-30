import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { detectLanguage, tildify } from "./paths";
import { BACKUP_DIR } from "./store";
import { validate } from "./validate";
import type { FilePayload, SaveResult } from "./types";

/** Above this, the editor opens read-only — these are config files, not datasets. */
const MAX_EDITABLE_BYTES = 2 * 1024 * 1024;

const CONTROL_CHARS = /[\x00-\x08\x0e-\x1f]/;

export async function readConfigFile(abs: string): Promise<FilePayload> {
  const stat = await fs.stat(abs);
  const language = detectLanguage(abs);

  if (!stat.isFile()) throw new Error("Not a file");

  if (stat.size > MAX_EDITABLE_BYTES) {
    return {
      path: abs,
      displayPath: tildify(abs),
      content: "",
      size: stat.size,
      mtime: stat.mtimeMs,
      language,
      readOnlyReason: `File is ${(stat.size / 1024 / 1024).toFixed(1)} MB — too large to edit here`,
    };
  }

  const buffer = await fs.readFile(abs);
  const content = buffer.toString("utf8");
  const binary = CONTROL_CHARS.test(content.slice(0, 4096));

  return {
    path: abs,
    displayPath: tildify(abs),
    content: binary ? "" : content,
    size: stat.size,
    mtime: stat.mtimeMs,
    language,
    readOnlyReason: binary ? "Binary file" : undefined,
  };
}

export class WriteConflictError extends Error {
  constructor(readonly currentMtime: number) {
    super("File changed on disk since it was opened");
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly line?: number,
  ) {
    super(message);
  }
}

async function backup(abs: string): Promise<string | undefined> {
  try {
    const existing = await fs.readFile(abs);
    const hash = crypto.createHash("sha1").update(abs).digest("hex").slice(0, 8);
    const dir = path.join(BACKUP_DIR, `${path.basename(abs)}-${hash}`);
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = path.join(dir, `${stamp}${path.extname(abs) || ".bak"}`);
    await fs.writeFile(target, existing);
    return target;
  } catch {
    // No prior content (new file) or unreadable — nothing to preserve.
    return undefined;
  }
}

export async function writeConfigFile(
  abs: string,
  content: string,
  options: { expectedMtime?: number; skipValidation?: boolean } = {},
): Promise<SaveResult> {
  const language = detectLanguage(abs);

  if (!options.skipValidation) {
    const result = validate(content, language);
    if (!result.ok) throw new ValidationError(result.message ?? "Invalid syntax", result.line);
  }

  let mode: number | undefined;
  try {
    const stat = await fs.stat(abs);
    if (options.expectedMtime !== undefined && Math.abs(stat.mtimeMs - options.expectedMtime) > 1) {
      throw new WriteConflictError(stat.mtimeMs);
    }
    mode = stat.mode;
  } catch (err) {
    if (err instanceof WriteConflictError) throw err;
    // New file: make sure the parent directory exists.
    await fs.mkdir(path.dirname(abs), { recursive: true });
  }

  const backupPath = await backup(abs);

  // Write to a sibling temp file then rename, so a crash cannot truncate the
  // original. The suffix is random rather than pid-based: two saves of the same
  // file can overlap in one process, and a shared name makes the second rename
  // fail on a file the first one already moved.
  const temp = path.join(
    path.dirname(abs),
    `.${path.basename(abs)}.tmp-${crypto.randomBytes(6).toString("hex")}`,
  );
  try {
    await fs.writeFile(temp, content, { encoding: "utf8", mode });
    await fs.rename(temp, abs);
  } catch (err) {
    await fs.rm(temp, { force: true });
    throw err;
  }

  const stat = await fs.stat(abs);
  return { path: abs, size: stat.size, mtime: stat.mtimeMs, backup: backupPath };
}
