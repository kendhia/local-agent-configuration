import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { detectLanguage, tildify } from "./paths";
import { captureVersion, readVersion } from "./versions";
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

    // Writing identical bytes would bump the mtime and record a version that
    // says nothing. Restoring a version twice is the usual way to hit this.
    if ((await fs.readFile(abs, "utf8")) === content) {
      return { path: abs, size: stat.size, mtime: stat.mtimeMs, unchanged: true };
    }

    mode = stat.mode;
  } catch (err) {
    if (err instanceof WriteConflictError) throw err;
    // New file: make sure the parent directory exists.
    await fs.mkdir(path.dirname(abs), { recursive: true });
  }

  // Snapshot the outgoing content so this save can be rolled back.
  const captured = await captureVersion(abs);

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
  return { path: abs, size: stat.size, mtime: stat.mtimeMs, captured: captured ?? undefined };
}

/**
 * Rolls a file back to a stored version. The current content is snapshotted
 * first, so a restore can itself be undone.
 *
 * Validation is skipped deliberately: a version is a byte-exact record of what
 * was on disk, and the point of restoring is to get exactly that back. Files
 * predating the dashboard may never have parsed cleanly in the first place.
 */
export async function restoreVersion(abs: string, id: string): Promise<SaveResult> {
  const content = await readVersion(abs, id);
  return writeConfigFile(abs, content, { skipValidation: true });
}
