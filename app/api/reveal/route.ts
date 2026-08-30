import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PathError, resolveAllowed } from "@/lib/paths";
import { allowedRoots } from "@/lib/store";

const run = promisify(execFile);

export const dynamic = "force-dynamic";

/** Reveals a config in Finder. macOS only; harmless no-op elsewhere. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string };
    const abs = await resolveAllowed(body.path ?? null, await allowedRoots());
    if (process.platform !== "darwin") {
      return Response.json({ error: "Reveal is only supported on macOS" }, { status: 501 });
    }
    await run("open", ["-R", abs]);
    return Response.json({ ok: true });
  } catch (err) {
    const status = err instanceof PathError ? err.status : 500;
    return Response.json({ error: (err as Error).message }, { status });
  }
}
