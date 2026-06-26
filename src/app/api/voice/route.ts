import { NextResponse } from "next/server";
import { produceVoice } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { script } = (await req.json()) as { script: string };
    if (!script || typeof script !== "string") {
      return NextResponse.json({ error: "Missing 'script'" }, { status: 400 });
    }
    const { value, provider } = await produceVoice(script);
    return NextResponse.json({ audioUrl: value, provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "voice failed" },
      { status: 500 }
    );
  }
}
