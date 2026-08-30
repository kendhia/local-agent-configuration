import { restoreVersion } from "@/lib/fileio";
import { PathError, resolveAllowed } from "@/lib/paths";
import { allowedRoots } from "@/lib/store";
import { BadVersionError, clearVersions, listVersions, readVersion } from "@/lib/versions";

export const dynamic = "force-dynamic";

function errorResponse(err: unknown) {
  if (err instanceof PathError) return Response.json({ error: err.message }, { status: err.status });
  if (err instanceof BadVersionError) return Response.json({ error: err.message }, { status: 400 });
  const message = (err as Error)?.message ?? "Unknown error";
  const status = /ENOENT/.test(message) ? 404 : 500;
  return Response.json({ error: message }, { status });
}

/** Without `id`, lists a file's history; with one, returns that version's content. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const abs = await resolveAllowed(params.get("path"), await allowedRoots());
    const id = params.get("id");

    if (!id) return Response.json({ versions: await listVersions(abs) });
    return Response.json({ id, content: await readVersion(abs, id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Rolls the file back to a stored version. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string; id?: string };
    if (!body.id) return Response.json({ error: "Missing `id`" }, { status: 400 });
    const abs = await resolveAllowed(body.path ?? null, await allowedRoots());
    return Response.json(await restoreVersion(abs, body.id));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Discards a file's entire history. */
export async function DELETE(request: Request) {
  try {
    const abs = await resolveAllowed(
      new URL(request.url).searchParams.get("path"),
      await allowedRoots(),
    );
    await clearVersions(abs);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
