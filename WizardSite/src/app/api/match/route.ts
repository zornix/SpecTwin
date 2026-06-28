import { NextResponse } from "next/server";
import { z } from "zod";

import { getMatches } from "@/lib/api";

const BodySchema = z.object({
  url: z.string().url("Provide a valid product URL"),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 422 },
    );
  }

  const result = await getMatches(parsed.data.url);
  return NextResponse.json(result);
}
