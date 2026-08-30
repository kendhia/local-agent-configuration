"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  FolderPlus,
  Home,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { AGENT_BY_ID, KIND_LABEL } from "@/lib/agents";
import type { AgentGroup, ConfigFile, ProjectScan, Snapshot } from "@/lib/types";
import { api, cn, formatRelative } from "@/lib/ui";
import { AgentDot } from "./agent-dot";
import { KindIcon } from "./icons";

interface Props {
  snapshot: Snapshot | undefined;
  loading: boolean;
  selected: ConfigFile | null;
  dirtyPaths: Set<string>;
  onSelect: (file: ConfigFile) => void;
  onRefresh: () => void;
  onAddProject: () => void;
}

function matchesQuery(file: ConfigFile, query: string, agentName: string): boolean {
  if (!query) return true;
  const haystack = `${file.displayPath} ${file.name} ${agentName} ${KIND_LABEL[file.kind]}`;
  return haystack.toLowerCase().includes(query);
}

function filterGroups(groups: AgentGroup[], query: string): AgentGroup[] {
  if (!query) return groups;
  return groups
    .map((g) => ({ ...g, files: g.files.filter((f) => matchesQuery(f, query, g.agentName)) }))
    .filter((g) => g.files.length > 0);
}

export function Sidebar({
  snapshot,
  loading,
  selected,
  dirtyPaths,
  onSelect,
  onRefresh,
  onAddProject,
}: Props) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const globalGroups = useMemo(
    () => filterGroups(snapshot?.global ?? [], normalized),
    [snapshot, normalized],
  );

  const projectScans = useMemo(
    () =>
      (snapshot?.projects ?? []).map((scan) => ({
        ...scan,
        agents: filterGroups(scan.agents, normalized),
      })),
    [snapshot, normalized],
  );

  const globalCount = globalGroups.reduce((sum, g) => sum + g.files.length, 0);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-line bg-surface">
      <header className="border-b border-line-soft px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-accent">
              <svg viewBox="0 0 16 16" className="size-3.5 fill-current">
                <path d="M8 0 1 4v8l7 4 7-4V4L8 0Zm0 2.2 5 2.9v5.8l-5 2.9-5-2.9V5.1l5-2.9Z" />
                <circle cx="8" cy="8" r="2.2" />
              </svg>
            </span>
            <h1 className="text-[13px] font-semibold tracking-tight">Agent Configs</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onAddProject}
              title="Add project folder"
              className="rounded-md p-1.5 text-ink-faint transition hover:bg-raised hover:text-ink"
            >
              <FolderPlus className="size-4" />
            </button>
            <button
              onClick={onRefresh}
              title="Rescan"
              className="rounded-md p-1.5 text-ink-faint transition hover:bg-raised hover:text-ink"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter configs…"
            spellCheck={false}
            className="w-full rounded-md border border-line bg-canvas py-1.5 pl-8 pr-3 text-xs text-ink outline-none transition placeholder:text-ink-faint focus:border-accent"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <Section
          title="Root level"
          subtitle={snapshot ? `${snapshot.home} · ${globalCount} files` : "scanning…"}
          icon={<Home className="size-3.5" />}
        >
          {globalGroups.map((group) => (
            <AgentSection
              key={group.agentId}
              group={group}
              selected={selected}
              dirtyPaths={dirtyPaths}
              onSelect={onSelect}
            />
          ))}
          {!loading && globalGroups.length === 0 && (
            <Empty text={normalized ? "No matches" : "No root-level configs found"} />
          )}
        </Section>

        {projectScans.map((scan) => (
          <ProjectSection
            key={scan.project.id}
            scan={scan}
            selected={selected}
            dirtyPaths={dirtyPaths}
            onSelect={onSelect}
            onRemoved={onRefresh}
          />
        ))}

        <button
          onClick={onAddProject}
          className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-lg border border-dashed border-line py-2.5 text-xs text-ink-faint transition hover:border-accent hover:text-accent"
        >
          <FolderPlus className="size-3.5" />
          Add project folder
        </button>
      </div>

      {snapshot && (
        <footer className="flex items-center gap-2 border-t border-line-soft px-4 py-2 text-[11px] text-ink-faint">
          <span className="flex-1 truncate">Scanned {formatRelative(snapshot.scannedAt)}</span>
          <label className="flex shrink-0 items-center gap-1" title="How deep to search inside project folders">
            depth
            <select
              value={snapshot.scanDepth}
              onChange={async (e) => {
                await api("/api/projects", {
                  method: "POST",
                  body: JSON.stringify({ scanDepth: Number(e.target.value) }),
                });
                onRefresh();
              }}
              className="rounded border border-line bg-canvas px-1 py-0.5 text-ink-dim outline-none transition hover:border-accent focus:border-accent"
            >
              {[2, 4, 6, 8, 10, 12].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </footer>
      )}
    </aside>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-3">
      <div className="flex items-baseline gap-2 px-4 pb-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">
          {icon}
          {title}
        </span>
      </div>
      {subtitle && (
        <p className="truncate px-4 pb-2 font-mono text-[10px] text-ink-faint">{subtitle}</p>
      )}
      {children}
    </section>
  );
}

function ProjectSection({
  scan,
  selected,
  dirtyPaths,
  onSelect,
  onRemoved,
}: {
  scan: ProjectScan;
  selected: ConfigFile | null;
  dirtyPaths: Set<string>;
  onSelect: (file: ConfigFile) => void;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    try {
      await api(`/api/projects?id=${scan.project.id}`, { method: "DELETE" });
      onRemoved();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="mt-4 border-t border-line-soft pt-3">
      <div className="group flex items-center gap-2 px-4 pb-1.5">
        <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-ink-dim">
          {scan.project.name}
        </span>
        <span className="text-[10px] text-ink-faint">{scan.fileCount}</span>
        <button
          onClick={remove}
          disabled={removing}
          title="Remove project"
          className="rounded p-0.5 text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-bad"
        >
          {removing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </button>
      </div>
      <p className="truncate px-4 pb-2 font-mono text-[10px] text-ink-faint">{scan.project.path}</p>

      {scan.error && (
        <p className="mx-4 mb-2 flex items-center gap-1.5 rounded border border-warn/25 bg-warn/5 px-2 py-1 text-[11px] text-warn">
          <TriangleAlert className="size-3" />
          {scan.error}
        </p>
      )}

      {scan.agents.map((group) => (
        <AgentSection
          key={group.agentId}
          group={group}
          selected={selected}
          dirtyPaths={dirtyPaths}
          onSelect={onSelect}
        />
      ))}

      {!scan.error && scan.agents.length === 0 && <Empty text="No agent configs found" />}
    </section>
  );
}

function AgentSection({
  group,
  selected,
  dirtyPaths,
  onSelect,
}: {
  group: AgentGroup;
  selected: ConfigFile | null;
  dirtyPaths: Set<string>;
  onSelect: (file: ConfigFile) => void;
}) {
  const [open, setOpen] = useState(true);
  const note = AGENT_BY_ID.get(group.agentId)?.note;


  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen((v) => !v)}
        title={note}
        className="flex w-full items-center gap-2 px-4 py-1 text-left transition hover:bg-surface-2"
      >
        <ChevronRight
          className={cn("size-3 shrink-0 text-ink-faint transition-transform", open && "rotate-90")}
        />
        <AgentDot accent={group.accent} />
        <span className="flex-1 truncate text-xs font-medium text-ink">{group.agentName}</span>
        <span className="text-[10px] tabular-nums text-ink-faint">{group.files.length}</span>
      </button>

      {open && (
        <ul>
          {group.files.map((file) => {
            const active = selected?.path === file.path;
            const label = labelFor(file);
            return (
              <li key={file.path}>
                <button
                  onClick={() => onSelect(file)}
                  className={cn(
                    "group flex w-full items-center gap-2 py-1 pl-[2.35rem] pr-3 text-left transition",
                    active ? "bg-accent-soft" : "hover:bg-surface-2",
                  )}
                >
                  <KindIcon
                    kind={file.kind}
                    className={cn("size-3.5 shrink-0", active ? "text-accent" : "text-ink-faint")}
                  />
                  <span
                    className="flex min-w-0 flex-1 items-baseline font-mono text-[11px]"
                    title={file.displayPath}
                  >
                    {label.prefix && (
                      <span className="min-w-0 truncate text-ink-faint">{label.prefix}</span>
                    )}
                    <span
                      className={cn(
                        "shrink-0",
                        active ? "text-ink" : "text-ink-dim group-hover:text-ink",
                      )}
                    >
                      {label.name}
                    </span>
                  </span>
                  {dirtyPaths.has(file.path) && (
                    <span className="size-1.5 shrink-0 rounded-full bg-warn" title="Unsaved changes" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Splits a row into a dimmed directory prefix and the filename. Basenames
 * repeat constantly across agents (`settings.local.json` in five subfolders,
 * `SKILL.md` in every skill), so the full path is the only reliable label.
 */
function labelFor(file: ConfigFile): { prefix: string; name: string } {
  // `~/` is redundant under the "Root level" heading.
  const relative = file.displayPath.replace(/^~\//, "");
  const cut = relative.lastIndexOf("/");
  return cut === -1
    ? { prefix: "", name: relative }
    : { prefix: relative.slice(0, cut + 1), name: relative.slice(cut + 1) };
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-3 text-xs text-ink-faint">{text}</p>;
}
