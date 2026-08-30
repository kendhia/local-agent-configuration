"use client";

import { useEffect, useState } from "react";
import { ArrowUp, CornerDownLeft, Folder, Loader2, X } from "lucide-react";
import { api, cn } from "@/lib/ui";

interface BrowseResult {
  path: string;
  displayPath: string;
  parent: string | null;
  dirs: Array<{ name: string; path: string; hidden: boolean }>;
}

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function AddProjectDialog({ onClose, onAdded }: Props) {
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [target, setTarget] = useState<string>("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<BrowseResult>(`/api/browse${target ? `?path=${encodeURIComponent(target)}` : ""}`)
      .then((result) => {
        if (cancelled) return;
        setBrowse(result);
        setTyped(result.displayPath);
        // A successful listing clears whatever the previous attempt reported.
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function add(pathToAdd: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/projects", { method: "POST", body: JSON.stringify({ path: pathToAdd }) });
      onAdded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-6 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-in flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Add a project folder</h2>
            <p className="text-xs text-ink-faint">Any folder — it does not need to be a git repo.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-faint transition hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <form
          className="flex items-center gap-2 border-b border-line-soft px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            setTarget(typed);
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            spellCheck={false}
            placeholder="~/Documents/GitHub/my-project"
            className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink outline-none transition focus:border-accent"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-2 text-xs text-ink-dim transition hover:border-accent hover:text-ink"
            title="Go to this path"
          >
            <CornerDownLeft className="size-3.5" />
            Go
          </button>
        </form>

        <div className="max-h-[45vh] overflow-y-auto">
          {browse?.parent && (
            <button
              onClick={() => setTarget(browse.parent!)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-ink-dim transition hover:bg-surface-2"
            >
              <ArrowUp className="size-3.5 shrink-0" />
              <span className="font-mono">..</span>
            </button>
          )}
          {browse?.dirs.map((dir) => (
            <div
              key={dir.path}
              className="group flex items-center gap-2 px-4 py-1.5 transition hover:bg-surface-2"
            >
              <button
                onClick={() => setTarget(dir.path)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Folder
                  className={cn("size-3.5 shrink-0", dir.hidden ? "text-ink-faint" : "text-accent")}
                />
                <span className={cn("truncate font-mono text-xs", dir.hidden && "text-ink-dim")}>
                  {dir.name}
                </span>
              </button>
              <button
                onClick={() => add(dir.path)}
                disabled={busy}
                className="shrink-0 rounded border border-line px-2 py-0.5 text-[11px] text-ink-dim opacity-0 transition group-hover:opacity-100 hover:border-accent hover:text-ink disabled:opacity-40"
              >
                Add
              </button>
            </div>
          ))}
          {browse && browse.dirs.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-ink-faint">No subfolders here.</p>
          )}
        </div>

        {error && (
          <p className="border-t border-line-soft px-4 py-2 text-xs text-bad">{error}</p>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-4 py-3">
          <p className="truncate font-mono text-[11px] text-ink-faint">{browse?.displayPath}</p>
          <button
            onClick={() => browse && add(browse.path)}
            disabled={busy || !browse}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas transition hover:brightness-110 disabled:opacity-40"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Add this folder
          </button>
        </footer>
      </div>
    </div>
  );
}
