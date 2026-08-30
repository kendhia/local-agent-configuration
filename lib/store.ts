import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Project } from "./types";

export interface AppState {
  projects: Project[];
  /** How many subfolder levels below a project root to search. */
  scanDepth: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");

const DEFAULT_STATE: AppState = { projects: [], scanDepth: 6 };

/** Serialises read-modify-write cycles so concurrent requests cannot clobber. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function readState(): Promise<AppState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      scanDepth:
        typeof parsed.scanDepth === "number" && parsed.scanDepth > 0
          ? Math.min(parsed.scanDepth, 12)
          : DEFAULT_STATE.scanDepth,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state: AppState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export function updateState(fn: (state: AppState) => AppState | Promise<AppState>): Promise<AppState> {
  return enqueue(async () => {
    const next = await fn(await readState());
    await writeState(next);
    return next;
  });
}

export function projectId(absPath: string): string {
  return crypto.createHash("sha1").update(absPath).digest("hex").slice(0, 12);
}

export function makeProject(absPath: string): Project {
  return {
    id: projectId(absPath),
    name: path.basename(absPath) || absPath,
    path: absPath,
    addedAt: Date.now(),
  };
}

/** Home plus every registered project — the only places files may be read or written. */
export async function allowedRoots(): Promise<string[]> {
  const state = await readState();
  const { HOME } = await import("./paths");
  return [HOME, ...state.projects.map((p) => p.path)];
}
