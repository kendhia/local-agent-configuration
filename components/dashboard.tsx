"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { FileCode2, Layers } from "lucide-react";
import type { ConfigFile, Snapshot } from "@/lib/types";
import { api } from "@/lib/ui";
import { AddProjectDialog } from "./add-project-dialog";
import { EditorPane } from "./editor-pane";
import { Sidebar } from "./sidebar";

const fetcher = (url: string) => api<Snapshot>(url);

export function Dashboard() {
  const { data, isLoading, mutate } = useSWR<Snapshot>("/api/snapshot", fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const [selected, setSelected] = useState<ConfigFile | null>(null);
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const onDirtyChange = useCallback((path: string, dirty: boolean) => {
    setDirtyPaths((prev) => {
      if (prev.has(path) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const refresh = useCallback(() => void mutate(), [mutate]);

  // Keep the open file pointed at the latest scan result (size/mtime move).
  const current = useMemo(() => {
    if (!selected || !data) return selected;
    const all = [
      ...data.global.flatMap((g) => g.files),
      ...data.projects.flatMap((p) => p.agents.flatMap((g) => g.files)),
    ];
    return all.find((f) => f.path === selected.path) ?? selected;
  }, [selected, data]);

  const totals = useMemo(() => {
    if (!data) return { files: 0, agents: 0 };
    const agents = new Set<string>();
    let files = 0;
    for (const g of data.global) {
      agents.add(g.agentId);
      files += g.files.length;
    }
    for (const p of data.projects) {
      for (const g of p.agents) {
        agents.add(g.agentId);
        files += g.files.length;
      }
    }
    return { files, agents: agents.size };
  }, [data]);

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        snapshot={data}
        loading={isLoading}
        selected={current}
        dirtyPaths={dirtyPaths}
        onSelect={setSelected}
        onRefresh={refresh}
        onAddProject={() => setAdding(true)}
      />

      <main className="min-w-0 flex-1">
        {current ? (
          <EditorPane
            key={current.path}
            file={current}
            onDirtyChange={onDirtyChange}
            onSaved={refresh}
          />
        ) : (
          <Welcome files={totals.files} agents={totals.agents} onAddProject={() => setAdding(true)} />
        )}
      </main>

      {adding && <AddProjectDialog onClose={() => setAdding(false)} onAdded={refresh} />}
    </div>
  );
}

function Welcome({
  files,
  agents,
  onAddProject,
}: {
  files: number;
  agents: number;
  onAddProject: () => void;
}) {
  return (
    <div className="grid h-full place-items-center px-8">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-line bg-surface text-accent">
          <FileCode2 className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold">Pick a config to edit</h2>
        <p className="mt-1.5 text-sm text-ink-dim">
          {files} configuration files across {agents} agents. Edits save straight to disk, and the
          previous version is kept under <code className="font-mono text-xs">data/backups</code>.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={onAddProject}
            className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-dim transition hover:border-accent hover:text-ink"
          >
            <Layers className="size-3.5" />
            Add a project folder
          </button>
        </div>

        <p className="mt-6 text-[11px] text-ink-faint">
          JSON, TOML and YAML are syntax-checked before they touch disk. ⌘S saves.
        </p>
      </div>
    </div>
  );
}
