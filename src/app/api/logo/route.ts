import { NextResponse } from "next/server";
import { produceLogo } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prompt, brand, palette } = (await req.json()) as {
      prompt: string;
      brand?: string;
      palette?: string[];
    };
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
    }
    const { value, provider } = await produceLogo(prompt, brand, palette ?? []);
    return NextResponse.json({ logoUrl: value, provider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "logo failed" },
      { status: 500 }
    );
  }
}
