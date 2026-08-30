import { readConfigFile, writeConfigFile, ValidationError, WriteConflictError } from "@/lib/fileio";
import { PathError, resolveAllowed } from "@/lib/paths";
import { allowedRoots } from "@/lib/store";

export const dynamic = "force-dynamic";

function errorResponse(err: unknown) {
  if (err instanceof PathError) return Response.json({ error: err.message }, { status: err.status });
  if (err instanceof WriteConflictError) {
    return Response.json(
      { error: err.message, kind: "conflict", currentMtime: err.currentMtime },
      { status: 409 },
    );
  }
  if (err instanceof ValidationError) {
    return Response.json({ error: err.message, kind: "invalid", line: err.line }, { status: 422 });
  }
  const message = (err as Error)?.message ?? "Unknown error";
  const status = /ENOENT/.test(message) ? 404 : 500;
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("path");
    const abs = await resolveAllowed(raw, await allowedRoots());
    return Response.json(await readConfigFile(abs));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      path?: string;
      content?: string;
      expectedMtime?: number;
      force?: boolean;
    };
    if (typeof body.content !== "string") {
      return Response.json({ error: "Missing `content`" }, { status: 400 });
    }
    const abs = await resolveAllowed(body.path ?? null, await allowedRoots());
    const result = await writeConfigFile(abs, body.content, {
      expectedMtime: body.force ? undefined : body.expectedMtime,
      skipValidation: body.force,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
