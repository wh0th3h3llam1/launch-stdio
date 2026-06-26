import { NextResponse } from "next/server";
import { creativeDirector } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { brief } = await req.json();
    if (!brief || typeof brief !== "string") {
      return NextResponse.json({ error: "Missing 'brief'" }, { status: 400 });
    }
    const { value, provider } = await creativeDirector(brief);
    return NextResponse.json({ plan: value, provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "plan failed" },
      { status: 500 }
    );
  }
}
