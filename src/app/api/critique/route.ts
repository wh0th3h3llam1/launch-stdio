import { NextResponse } from "next/server";
import { artDirector } from "@/lib/agents";
import type { LaunchKit } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { kit } = (await req.json()) as { kit: LaunchKit };
    if (!kit || typeof kit !== "object") {
      return NextResponse.json({ error: "Missing 'kit'" }, { status: 400 });
    }
    const { value, provider } = await artDirector(kit);
    return NextResponse.json({ critique: value, provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "critique failed" },
      { status: 500 }
    );
  }
}
