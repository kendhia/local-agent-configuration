import fg from "fast-glob";
import picomatch from "picomatch";
import fs from "node:fs/promises";
import path from "node:path";
import { AGENTS, AGENT_ORDER, KIND_ORDER, type AgentDef, type Pattern } from "./agents";
import { HOME, IGNORE_GLOBS, detectLanguage, isSecretPath, tildify } from "./paths";
import { readState } from "./store";
import type { AgentGroup, ConfigFile, Project, ProjectScan, Snapshot } from "./types";

/** Hard cap so a mis-added folder (say, `/`) cannot hang the dashboard. */
const MAX_FILES_PER_PROJECT = 4000;

const matcherCache = new Map<string, (input: string) => boolean>();

function matches(rel: string, glob: string): boolean {
  let matcher = matcherCache.get(glob);
  if (!matcher) {
    matcher = picomatch(glob, { dot: true });
    matcherCache.set(glob, matcher);
  }
  return matcher(rel);
}

/**
 * The first segment of every registry glob is a literal (`CLAUDE.md`, `.claude`,
 * `.github`, …). That lets a match be split into "which subfolder holds this
 * config" and "which config is it".
 */
function anchorOf(glob: string): string {
  return glob.split("/")[0];
}

/** Splits `sub/a/.claude/settings.json` into dir `sub/a` given anchor `.claude`. */
function subdirFor(rel: string, anchor: string): string {
  const segments = rel.split("/");
  const idx = segments.indexOf(anchor);
  return idx <= 0 ? "" : segments.slice(0, idx).join("/");
}

interface Match {
  rel: string;
  pattern: Pattern;
}

async function globAgent(
  agent: AgentDef,
  root: string,
  patterns: Pattern[],
  recursive: boolean,
): Promise<Match[]> {
  if (patterns.length === 0) return [];
  const expanded = patterns.map((p) => ({ pattern: p, glob: recursive ? `**/${p.glob}` : p.glob }));

  const entries = await fg(
    expanded.map((e) => e.glob),
    {
      cwd: root,
      dot: true,
      onlyFiles: true,
      // Agents commonly symlink a shared skills directory into their own config
      // dir, so the shallow global scan follows links to show what each agent
      // actually sees. Recursive project scans do not, to avoid symlink cycles.
      followSymbolicLinks: !recursive,
      suppressErrors: true,
      unique: true,
      ignore: recursive ? IGNORE_GLOBS : undefined,
    },
  );

  // `unique: true` collapses which pattern produced a hit, so re-attribute here.
  // First match wins, which is why the registry lists specific patterns first.
  const result: Match[] = [];
  for (const rel of entries) {
    const hit = expanded.find((e) => matches(rel, e.glob));
    if (hit) result.push({ rel, pattern: hit.pattern });
  }
  return result;
}

async function toConfigFile(
  abs: string,
  displayPath: string,
  agentId: string,
  match: Match,
  scope: "global" | "project",
  projectId?: string,
  dir?: string,
): Promise<ConfigFile | null> {
  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) return null;
    return {
      path: abs,
      displayPath,
      name: path.basename(abs),
      agentId,
      kind: match.pattern.kind,
      scope,
      projectId,
      dir,
      size: stat.size,
      mtime: stat.mtimeMs,
      language: detectLanguage(abs),
    };
  } catch {
    return null;
  }
}

function sortFiles(files: ConfigFile[]): ConfigFile[] {
  return files.sort((a, b) => {
    const dirCmp = (a.dir ?? "").localeCompare(b.dir ?? "");
    if (dirCmp !== 0) return dirCmp;
    const kindCmp = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (kindCmp !== 0) return kindCmp;
    return a.displayPath.localeCompare(b.displayPath);
  });
}

function sortGroups(groups: AgentGroup[]): AgentGroup[] {
  return groups.sort(
    (a, b) => (AGENT_ORDER.get(a.agentId) ?? 999) - (AGENT_ORDER.get(b.agentId) ?? 999),
  );
}

export async function scanGlobal(): Promise<AgentGroup[]> {
  const candidates = (
    await Promise.all(
      AGENTS.map(async (agent) => {
        const found = await globAgent(agent, HOME, agent.global, false);
        return found
          .map((match) => ({ agent, match, abs: path.join(HOME, match.rel) }))
          .filter((c) => !isSecretPath(c.abs));
      }),
    )
  ).flat();

  // Several agents symlink the same shared file (typically `~/.agents/skills`).
  // List it once, at its real location, and credit the linkers separately.
  const byReal = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    let real = candidate.abs;
    try {
      real = await fs.realpath(candidate.abs);
    } catch {
      // Broken link or race — treat the literal path as canonical.
    }
    const bucket = byReal.get(real);
    if (bucket) bucket.push(candidate);
    else byReal.set(real, [candidate]);
  }

  const filesByAgent = new Map<string, ConfigFile[]>();

  for (const [real, bucket] of byReal) {
    // Prefer the agent that owns the real file over any agent that links to it.
    const winner = bucket.find((c) => c.abs === real) ?? bucket[0];
    const linkedBy = bucket
      .filter((c) => c.agent.id !== winner.agent.id)
      .map((c) => c.agent.name)
      .filter((name, i, all) => all.indexOf(name) === i)
      .sort();

    const file = await toConfigFile(
      winner.abs,
      tildify(winner.abs),
      winner.agent.id,
      winner.match,
      "global",
    );
    if (!file) continue;
    if (linkedBy.length > 0) file.linkedBy = linkedBy;

    const list = filesByAgent.get(winner.agent.id);
    if (list) list.push(file);
    else filesByAgent.set(winner.agent.id, [file]);
  }

  const groups: AgentGroup[] = [];
  for (const agent of AGENTS) {
    const files = filesByAgent.get(agent.id);
    if (!files || files.length === 0) continue;
    groups.push({
      agentId: agent.id,
      agentName: agent.name,
      accent: agent.accent,
      files: sortFiles(files),
    });
  }
  return sortGroups(groups);
}

export async function scanProject(project: Project, maxDepth: number): Promise<ProjectScan> {
  try {
    const stat = await fs.stat(project.path);
    if (!stat.isDirectory()) {
      return { project, agents: [], fileCount: 0, dirs: [], error: "Not a directory" };
    }
  } catch {
    return { project, agents: [], fileCount: 0, dirs: [], error: "Folder not found" };
  }

  let total = 0;
  const dirs = new Set<string>();

  const groups: AgentGroup[] = [];
  for (const agent of AGENTS) {
    const found = await globAgent(agent, project.path, agent.project, true);
    const files: ConfigFile[] = [];
    for (const m of found) {
      if (total >= MAX_FILES_PER_PROJECT) break;
      const abs = path.join(project.path, m.rel);
      if (isSecretPath(abs)) continue;
      const dir = subdirFor(m.rel, anchorOf(m.pattern.glob));
      if (dir !== "" && dir.split("/").length > maxDepth) continue;
      const file = await toConfigFile(abs, m.rel, agent.id, m, "project", project.id, dir);
      if (!file) continue;
      files.push(file);
      dirs.add(dir);
      total += 1;
    }
    if (files.length > 0) {
      groups.push({
        agentId: agent.id,
        agentName: agent.name,
        accent: agent.accent,
        files: sortFiles(files),
      });
    }
  }

  return {
    project,
    agents: sortGroups(groups),
    fileCount: total,
    dirs: [...dirs].sort(),
    error: total >= MAX_FILES_PER_PROJECT ? `Stopped at ${MAX_FILES_PER_PROJECT} files` : undefined,
  };
}

export async function buildSnapshot(): Promise<Snapshot> {
  const state = await readState();
  const [global, projects] = await Promise.all([
    scanGlobal(),
    Promise.all(state.projects.map((p) => scanProject(p, state.scanDepth))),
  ]);
  return { home: HOME, global, projects, scannedAt: Date.now(), scanDepth: state.scanDepth };
}
