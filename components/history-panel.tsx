"use client";

import { History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { Version } from "@/lib/types";
import { cn, formatBytes, formatRelative } from "@/lib/ui";

interface Props {
  versions: Version[];
  loading: boolean;
  currentSize: number;
  previewId: string | null;
  restoringId: string | null;
  onPreview: (id: string | null) => void;
  onRestore: (id: string) => void;
  onClear: () => void;
}

function absoluteTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

/** Two saves a few seconds apart both read "1m ago", so pair it with a clock time. */
function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function HistoryPanel({
  versions,
  loading,
  currentSize,
  previewId,
  restoringId,
  onPreview,
  onRestore,
  onClear,
}: Props) {
  return (
    <aside className="flex h-full w-[290px] shrink-0 flex-col border-l border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
        <History className="size-3.5 text-ink-faint" />
        <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">
          History
        </h3>
        {versions.length > 0 && (
          <button
            onClick={onClear}
            title="Discard all stored versions of this file"
            className="rounded p-1 text-ink-faint transition hover:text-bad"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <button
          onClick={() => onPreview(null)}
          className={cn(
            "flex w-full flex-col gap-0.5 border-b border-line-soft px-4 py-2.5 text-left transition",
            previewId === null ? "bg-accent-soft" : "hover:bg-surface-2",
          )}
        >
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-ok" />
            <span className="text-xs font-medium text-ink">Current</span>
          </span>
          <span className="pl-3.5 text-[11px] text-ink-faint">{formatBytes(currentSize)} on disk</span>
        </button>

        {loading && versions.length === 0 && (
          <div className="grid place-items-center py-8 text-ink-faint">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}

        {!loading && versions.length === 0 && (
          <p className="px-4 py-6 text-[11px] leading-relaxed text-ink-faint">
            No earlier versions yet. Every save from here on records the content it
            replaced, so you can roll back to it.
          </p>
        )}

        {versions.map((version, index) => {
          const active = previewId === version.id;
          const delta = version.size - currentSize;
          return (
            <div
              key={version.id}
              className={cn(
                "group border-b border-line-soft transition",
                active ? "bg-accent-soft" : "hover:bg-surface-2",
              )}
            >
              <button
                onClick={() => onPreview(active ? null : version.id)}
                className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left"
                title={absoluteTime(version.savedAt)}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-ink">
                    {formatRelative(version.savedAt)}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {clockTime(version.savedAt)}
                  </span>
                  {index === versions.length - 1 && (
                    <span className="rounded border border-line px-1 text-[9px] uppercase tracking-wide text-ink-faint">
                      oldest
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {formatBytes(version.size)}
                  {delta !== 0 && (
                    <span className={delta > 0 ? "text-ok" : "text-warn"}>
                      {" "}
                      ({delta > 0 ? "+" : ""}
                      {delta} B vs current)
                    </span>
                  )}
                </span>
              </button>

              {active && (
                <div className="px-4 pb-2.5">
                  <button
                    onClick={() => onRestore(version.id)}
                    disabled={restoringId !== null}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-[11px] font-medium text-canvas transition hover:brightness-110 disabled:opacity-40"
                  >
                    {restoringId === version.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    Restore this version
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="border-t border-line-soft px-4 py-2 text-[10px] leading-relaxed text-ink-faint">
        Up to 50 versions per file, kept in <code className="font-mono">data/versions</code>.
      </footer>
    </aside>
  );
}
