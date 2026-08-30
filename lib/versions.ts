import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { VERSIONS_DIR } from "./store";
import type { Version } from "./types";

/** Versions kept per file. Oldest are pruned once a file exceeds this. */
const MAX_VERSIONS = 50;

/** A version id is the epoch-millisecond stamp its file is named after. */
const VERSION_ID = /^\d+$/;

export class BadVersionError extends Error {}

function assertVersionId(id: string): void {
  if (!VERSION_ID.test(id)) throw new BadVersionError("Malformed version id");
}

/**
 * One directory per tracked file. The basename keeps it readable when poking
 * around in `data/`, the path hash keeps two same-named configs apart.
 */
function versionDir(abs: string): string {
  const hash = crypto.createHash("sha1").update(abs).digest("hex").slice(0, 8);
  return path.join(VERSIONS_DIR, `${path.basename(abs)}-${hash}`);
}

function versionFile(abs: string, id: string): string {
  return path.join(versionDir(abs), `${id}${path.extname(abs) || ".bak"}`);
}

function sha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** Newest first. */
export async function listVersions(abs: string): Promise<Version[]> {
  const dir = versionDir(abs);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const versions = await Promise.all(
    entries
      .filter((name) => VERSION_ID.test(path.basename(name, path.extname(name))))
      .map(async (name): Promise<Version | null> => {
        const id = path.basename(name, path.extname(name));
        try {
          const stat = await fs.stat(path.join(dir, name));
          return { id, savedAt: Number(id), size: stat.size };
        } catch {
          return null;
        }
      }),
  );

  return versions
    .filter((v): v is Version => v !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function readVersion(abs: string, id: string): Promise<string> {
  assertVersionId(id);
  try {
    return await fs.readFile(versionFile(abs, id), "utf8");
  } catch {
    // Don't echo the internal storage path back to the caller.
    throw new BadVersionError("No such version");
  }
}

async function prune(abs: string): Promise<void> {
  const versions = await listVersions(abs);
  const dir = versionDir(abs);
  await Promise.all(
    versions.slice(MAX_VERSIONS).map(async (v) => {
      try {
        await fs.rm(path.join(dir, `${v.id}${path.extname(abs) || ".bak"}`), { force: true });
      } catch {
        // Best effort; a stuck file just means one extra version on disk.
      }
    }),
  );
}

/**
 * Snapshots whatever is currently on disk, before it gets overwritten.
 *
 * Returns null when there is nothing to record: the file is new, or its content
 * already matches the newest version (restoring twice in a row, say).
 */
export async function captureVersion(abs: string): Promise<Version | null> {
  let current: Buffer;
  try {
    current = await fs.readFile(abs);
  } catch {
    return null; // New file — no prior state to keep.
  }

  const existing = await listVersions(abs);
  if (existing.length > 0) {
    try {
      const newest = await fs.readFile(versionFile(abs, existing[0].id));
      if (sha256(newest) === sha256(current)) return null;
    } catch {
      // Unreadable newest version — fall through and record this one.
    }
  }

  const dir = versionDir(abs);
  await fs.mkdir(dir, { recursive: true });
  // Makes an orphaned directory identifiable without reversing the hash.
  await fs.writeFile(path.join(dir, "source.json"), JSON.stringify({ path: abs }, null, 2) + "\n");

  // Two saves inside the same millisecond would collide on the filename.
  let id = Date.now();
  while (existing.some((v) => v.savedAt === id)) id += 1;

  await fs.writeFile(versionFile(abs, String(id)), current);
  await prune(abs);

  return { id: String(id), savedAt: id, size: current.byteLength };
}

/** Deletes every stored version of a file, for when history is not wanted. */
export async function clearVersions(abs: string): Promise<void> {
  await fs.rm(versionDir(abs), { recursive: true, force: true });
}
