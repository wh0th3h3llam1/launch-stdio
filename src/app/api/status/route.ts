import { NextResponse } from "next/server";
import { isMock, getGmiCallCount } from "@/lib/gmi";
import { hasNebius } from "@/lib/nebius";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    mock: isMock(),
    gmiCalls: getGmiCallCount(),
    providers: {
      gmi: !isMock(),
      nebius: hasNebius(),
    },
  });
}
