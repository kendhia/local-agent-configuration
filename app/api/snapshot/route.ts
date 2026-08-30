import { buildSnapshot } from "@/lib/scan";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await buildSnapshot());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
