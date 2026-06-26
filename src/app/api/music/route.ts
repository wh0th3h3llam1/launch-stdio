import { NextResponse } from "next/server";
import { produceMusic } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const { prompt, lyrics } = (await req.json()) as {
      prompt: string;
      lyrics?: string;
    };
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
    }
    const safeLyrics =
      lyrics?.trim() ||
      "[Verse]\nA brand new day, a brand new way\n[Chorus]\nLaunch today, light the way";
    const { value, provider } = await produceMusic(prompt, safeLyrics);
    return NextResponse.json({ musicUrl: value, provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "music failed" },
      { status: 500 }
    );
  }
}
