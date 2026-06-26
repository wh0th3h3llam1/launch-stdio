import { NextResponse } from "next/server";
import { produceImage } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prompt, palette } = (await req.json()) as {
      prompt: string;
      palette?: string[];
    };
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
    }
    const { value, provider } = await produceImage(prompt, palette ?? []);
    return NextResponse.json({ heroUrl: value, provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "image failed" },
      { status: 500 }
    );
  }
}
