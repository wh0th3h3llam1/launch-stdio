import { NextResponse } from "next/server";
import { copywriter } from "@/lib/agents";
import type { Plan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { plan, note } = (await req.json()) as { plan: Plan; note?: string };
    if (!plan || typeof plan !== "object") {
      return NextResponse.json({ error: "Missing 'plan'" }, { status: 400 });
    }
    const { value, provider } = await copywriter(plan, note);
    return NextResponse.json({ copy: value, provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "copy failed" },
      { status: 500 }
    );
  }
}
