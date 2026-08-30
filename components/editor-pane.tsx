"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  GitCompare,
  History,
  Link2,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { AGENT_BY_ID, KIND_LABEL } from "@/lib/agents";
import { validate } from "@/lib/validate";
import type { ConfigFile, FilePayload, SaveResult, Version } from "@/lib/types";
import { api, cn, formatBytes, formatRelative } from "@/lib/ui";
import { AgentDot } from "./agent-dot";
import { HistoryPanel } from "./history-panel";

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-xs text-ink-faint">
      <Loader2 className="size-4 animate-spin" />
    </div>
  ),
});

interface Props {
  file: ConfigFile;
  onDirtyChange: (path: string, dirty: boolean) => void;
  onSaved: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number; captured?: boolean }
  | { kind: "restored"; at: number }
  | { kind: "error"; message: string; conflict?: boolean };

export function EditorPane({ file, onDirtyChange, onSaved }: Props) {
  const [payload, setPayload] = useState<FilePayload | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const mtimeRef = useRef<number>(0);
  const savingRef = useRef(false);

  const dirty = payload !== null && draft !== payload.content;

  // The parent keys this component by path, so each file gets a fresh mount and
  // the initial `loading` / `idle` state is already correct here.
  useEffect(() => {
    let cancelled = false;
    api<FilePayload>(`/api/file?path=${encodeURIComponent(file.path)}`)
      .then((result) => {
        if (cancelled) return;
        setPayload(result);
        setDraft(result.content);
        mtimeRef.current = result.mtime;
      })
      .catch(
        (err) =>
          !cancelled &&
          setStatus({ kind: "error", message: (err as Error).message }),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file.path]);

  useEffect(() => {
    onDirtyChange(file.path, dirty);
  }, [dirty, file.path, onDirtyChange]);

  const loadVersions = useCallback(
    () =>
      api<{ versions: Version[] }>(
        `/api/versions?path=${encodeURIComponent(file.path)}`,
      )
        .then((result) => setVersions(result.versions))
        .catch(() => setVersions([]))
        .finally(() => setVersionsLoading(false)),
    [file.path],
  );

  useEffect(() => {
    let cancelled = false;
    api<{ versions: Version[] }>(
      `/api/versions?path=${encodeURIComponent(file.path)}`,
    )
      .then((result) => {
        if (cancelled) return;
        setVersions(result.versions);
        setVersionsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setVersions([]);
        setVersionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file.path]);

  // Pull the selected version's content in to diff against the live file. Id and
  // content are stored together so a half-loaded switch never shows version A's
  // text under version B's heading.
  useEffect(() => {
    if (previewId === null) return;
    let cancelled = false;
    api<{ content: string }>(
      `/api/versions?path=${encodeURIComponent(file.path)}&id=${previewId}`,
    )
      .then(
        (result) =>
          !cancelled && setPreview({ id: previewId, content: result.content }),
      )
      .catch((err) => {
        if (cancelled) return;
        setPreviewId(null);
        setStatus({ kind: "error", message: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [previewId, file.path]);

  // Warn before a reload/close would drop unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const syntax = useMemo(
    () => (payload ? validate(draft, payload.language) : { ok: true }),
    [draft, payload],
  );

  const save = useCallback(
    async (force = false) => {
      if (!payload || payload.readOnlyReason || savingRef.current) return;
      savingRef.current = true;
      setStatus({ kind: "saving" });
      try {
        const result = await api<SaveResult>("/api/file", {
          method: "PUT",
          body: JSON.stringify({
            path: file.path,
            content: draft,
            expectedMtime: mtimeRef.current,
            force,
          }),
        });
        mtimeRef.current = result.mtime;
        setPayload((prev) =>
          prev
            ? {
                ...prev,
                content: draft,
                size: result.size,
                mtime: result.mtime,
              }
            : prev,
        );
        setStatus({
          kind: "saved",
          at: Date.now(),
          captured: Boolean(result.captured),
        });
        if (result.captured) void loadVersions();
        onSaved();
      } catch (err) {
        const e = err as Error & { status?: number };
        setStatus({
          kind: "error",
          message: e.message,
          conflict: e.status === 409,
        });
      } finally {
        savingRef.current = false;
      }
    },
    [draft, file.path, loadVersions, onSaved, payload],
  );

  const restore = useCallback(
    async (id: string) => {
      setRestoringId(id);
      try {
        const result = await api<SaveResult>("/api/versions", {
          method: "POST",
          body: JSON.stringify({ path: file.path, id }),
        });
        const restored = await api<FilePayload>(
          `/api/file?path=${encodeURIComponent(file.path)}`,
        );
        mtimeRef.current = restored.mtime;
        setPayload(restored);
        setDraft(restored.content);
        setPreviewId(null);
        setStatus(
          result.unchanged
            ? { kind: "saved", at: Date.now() }
            : { kind: "restored", at: Date.now() },
        );
        await loadVersions();
        onSaved();
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error).message });
      } finally {
        setRestoringId(null);
      }
    },
    [file.path, loadVersions, onSaved],
  );

  const clearHistory = useCallback(async () => {
    try {
      await api(`/api/versions?path=${encodeURIComponent(file.path)}`, {
        method: "DELETE",
      });
      setPreviewId(null);
      await loadVersions();
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }, [file.path, loadVersions]);

  // Cmd+S also works when focus is outside the editor. CodeMirror's own binding
  // calls preventDefault, so skipping handled events keeps this from firing a
  // second, racing save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const agent = AGENT_BY_ID.get(file.agentId);
  const readOnly = Boolean(payload?.readOnlyReason);

  return (
    <div className="flex h-full min-w-0">
      <div className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
        <header className="border-b border-line bg-surface px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {agent && <AgentDot accent={agent.accent} />}
                <span className="text-xs font-medium text-ink-dim">
                  {agent?.name ?? file.agentId}
                </span>
                <span className="rounded border border-line px-1.5 py-px text-[10px] uppercase tracking-wide text-ink-faint">
                  {KIND_LABEL[file.kind]}
                </span>
                {file.scope === "global" && (
                  <span className="rounded border border-accent/30 bg-accent-soft px-1.5 py-px text-[10px] uppercase tracking-wide text-accent">
                    Root
                  </span>
                )}
              </div>
              <h2
                className="mt-1 truncate font-mono text-sm text-ink"
                title={file.path}
              >
                {payload?.displayPath ?? file.displayPath}
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                {payload ? formatBytes(payload.size) : "—"} · modified{" "}
                {payload ? formatRelative(payload.mtime) : "—"} ·{" "}
                {file.language}
              </p>
              {file.linkedBy && file.linkedBy.length > 0 && (
                <p
                  className="mt-1 truncate text-[11px] text-ink-faint"
                  title={file.linkedBy.join(", ")}
                >
                  <Link2 className="mr-1 inline size-3 -translate-y-px" />
                  Symlinked into {file.linkedBy.length} other agent
                  {file.linkedBy.length === 1 ? "" : "s"} —{" "}
                  {file.linkedBy.slice(0, 3).join(", ")}
                  {file.linkedBy.length > 3
                    ? ` +${file.linkedBy.length - 3} more`
                    : ""}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <IconButton
                title={copied ? "Copied" : "Copy path"}
                onClick={() => {
                  void navigator.clipboard.writeText(file.path);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
              >
                {copied ? (
                  <Check className="size-4 text-ok" />
                ) : (
                  <Copy className="size-4" />
                )}
              </IconButton>
              <IconButton
                title="Reveal in Finder"
                onClick={() => {
                  void api("/api/reveal", {
                    method: "POST",
                    body: JSON.stringify({ path: file.path }),
                  }).catch(() => undefined);
                }}
              >
                <ExternalLink className="size-4" />
              </IconButton>
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                title="Version history"
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition",
                  historyOpen
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-line text-ink-dim hover:border-ink-faint hover:text-ink",
                )}
              >
                <History className="size-3.5" />
                History
                {versions.length > 0 && (
                  <span className="rounded bg-black/25 px-1 text-[10px] tabular-nums">
                    {versions.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => payload && setDraft(payload.content)}
                disabled={!dirty}
                className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-dim transition hover:border-ink-faint hover:text-ink disabled:pointer-events-none disabled:opacity-35"
              >
                <RotateCcw className="size-3.5" />
                Revert
              </button>
              <button
                onClick={() => void save()}
                disabled={!dirty || readOnly || status.kind === "saving"}
                className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-35"
              >
                {status.kind === "saving" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Save
                <kbd className="ml-0.5 rounded bg-black/20 px-1 text-[10px]">
                  ⌘S
                </kbd>
              </button>
            </div>
          </div>
        </header>

        <StatusBar
          dirty={dirty}
          readOnlyReason={payload?.readOnlyReason}
          syntax={syntax}
          status={status}
          onForceSave={() => void save(true)}
        />

        {previewId && (
          <div className="flex items-center gap-2 border-b border-accent/20 bg-accent-soft px-5 py-1.5 text-[11px] text-accent">
            <GitCompare className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Previewing a version from {formatRelative(Number(previewId))} —
              green is what restoring would add, red what it would remove.
            </span>
            <button
              onClick={() => setPreviewId(null)}
              className="shrink-0 rounded border border-accent/30 px-2 py-0.5 transition hover:bg-accent/10"
            >
              Exit preview
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="grid h-full place-items-center text-xs text-ink-faint">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : payload?.readOnlyReason ? (
            <div className="grid h-full place-items-center px-8 text-center">
              <div>
                <AlertTriangle className="mx-auto size-6 text-warn" />
                <p className="mt-3 text-sm text-ink-dim">
                  {payload.readOnlyReason}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Open it in your editor instead.
                </p>
              </div>
            </div>
          ) : previewId ? (
            // The version is the "after" side so the diff reads as "what restoring does".
            preview?.id !== previewId ? (
              <div className="grid h-full place-items-center text-xs text-ink-faint">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <CodeEditor
                key={preview.id}
                value={preview.content}
                diffBase={payload?.content ?? ""}
                language={payload?.language ?? "text"}
                readOnly
                onChange={() => undefined}
                onSave={() => undefined}
              />
            )
          ) : (
            <CodeEditor
              value={draft}
              language={payload?.language ?? "text"}
              onChange={setDraft}
              onSave={() => void save()}
            />
          )}
        </div>
      </div>

      {historyOpen && (
        <HistoryPanel
          versions={versions}
          loading={versionsLoading}
          currentSize={payload?.size ?? file.size}
          previewId={previewId}
          restoringId={restoringId}
          onPreview={setPreviewId}
          onRestore={(id) => void restore(id)}
          onClear={() => void clearHistory()}
        />
      )}
    </div>
  );
}

function StatusBar({
  dirty,
  readOnlyReason,
  syntax,
  status,
  onForceSave,
}: {
  dirty: boolean;
  readOnlyReason?: string;
  syntax: { ok: boolean; message?: string; line?: number };
  status: Status;
  onForceSave: () => void;
}) {
  if (status.kind === "error") {
    return (
      <Bar tone="bad">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{status.message}</span>
        {status.conflict && (
          <button
            onClick={onForceSave}
            className="shrink-0 rounded border border-bad/40 px-2 py-0.5 text-[11px] transition hover:bg-bad/10"
          >
            Overwrite anyway
          </button>
        )}
      </Bar>
    );
  }

  if (!syntax.ok) {
    return (
      <Bar tone="warn">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {syntax.line ? `Line ${syntax.line}: ` : ""}
          {syntax.message}
        </span>
      </Bar>
    );
  }

  if (status.kind === "restored" && !dirty) {
    return (
      <Bar tone="ok">
        <CircleCheck className="size-3.5 shrink-0" />
        <span>Restored {formatRelative(status.at)}</span>
        <span className="truncate text-ink-faint">
          · the content it replaced was added to the history
        </span>
      </Bar>
    );
  }

  if (status.kind === "saved" && !dirty) {
    return (
      <Bar tone="ok">
        <CircleCheck className="size-3.5 shrink-0" />
        <span>Saved {formatRelative(status.at)}</span>
        {status.captured && (
          <span className="truncate text-ink-faint">
            · previous version kept in history
          </span>
        )}
      </Bar>
    );
  }

  if (readOnlyReason) return null;

  return (
    <Bar tone="muted">
      <span
        className={cn("size-1.5 rounded-full", dirty ? "bg-warn" : "bg-ok/60")}
      />
      <span>{dirty ? "Unsaved changes" : "Up to date with disk"}</span>
    </Bar>
  );
}

function Bar({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-5 py-1.5 text-[11px]",
        tone === "ok" && "border-line-soft bg-ok/5 text-ok",
        tone === "warn" && "border-warn/20 bg-warn/5 text-warn",
        tone === "bad" && "border-bad/20 bg-bad/5 text-bad",
        tone === "muted" && "border-line-soft bg-surface/50 text-ink-faint",
      )}
    >
      {children}
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-md p-1.5 text-ink-faint transition hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}
