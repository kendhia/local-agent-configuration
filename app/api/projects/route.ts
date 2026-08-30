import fs from "node:fs/promises";
import path from "node:path";
import { HOME, untildify } from "@/lib/paths";
import { makeProject, projectId, readState, updateState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readState();
  return Response.json(state);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { path?: string; scanDepth?: number };

  if (typeof body.scanDepth === "number") {
    const depth = Math.max(1, Math.min(12, Math.round(body.scanDepth)));
    const state = await updateState((s) => ({ ...s, scanDepth: depth }));
    return Response.json(state);
  }

  if (!body.path) return Response.json({ error: "Missing `path`" }, { status: 400 });

  const abs = path.resolve(untildify(body.path));

  try {
    const stat = await fs.stat(abs);
    if (!stat.isDirectory()) {
      return Response.json({ error: "That path is not a folder" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: `No such folder: ${abs}` }, { status: 400 });
  }

  if (abs === "/" || abs === HOME) {
    return Response.json(
      { error: "Pick a project folder rather than / or your home directory" },
      { status: 400 },
    );
  }

  const state = await updateState((s) => {
    if (s.projects.some((p) => p.id === projectId(abs))) return s;
    return { ...s, projects: [...s.projects, makeProject(abs)] };
  });

  return Response.json(state);
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing `id`" }, { status: 400 });
  const state = await updateState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }));
  return Response.json(state);
}
