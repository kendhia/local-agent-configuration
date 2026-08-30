import fs from "node:fs/promises";
import path from "node:path";
import { HOME, IGNORE_DIRS, tildify, untildify } from "@/lib/paths";

export const dynamic = "force-dynamic";

const HIDE = new Set(IGNORE_DIRS);

/** Lists subdirectories so the "Add project" dialog can browse the filesystem. */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("path");
  const target = raw ? path.resolve(untildify(raw)) : HOME;

  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    const dirs = entries
      .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !HIDE.has(e.name))
      .map((e) => ({
        name: e.name,
        path: path.join(target, e.name),
        hidden: e.name.startsWith("."),
      }))
      .sort((a, b) => Number(a.hidden) - Number(b.hidden) || a.name.localeCompare(b.name));

    return Response.json({
      path: target,
      displayPath: tildify(target),
      parent: path.dirname(target) === target ? null : path.dirname(target),
      dirs,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message, path: target }, { status: 400 });
  }
}
