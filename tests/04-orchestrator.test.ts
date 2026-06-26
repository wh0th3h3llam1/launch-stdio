import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/run/route";
import type { AgentEvent, LaunchKit } from "@/lib/types";

// Drives the real /api/run handler (mock mode) and asserts the full streamed
// sequence the frontend depends on: NDJSON, log feed, and the critic loop.
async function runBrief(brief: string): Promise<AgentEvent[]> {
  const req = new Request("http://test/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief }),
  });
  const res = await POST(req);
  const text = await res.text();
  expect(res.headers.get("content-type")).toContain("application/x-ndjson");
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AgentEvent);
}

describe("/api/run orchestrator (NDJSON)", () => {
  it("every line is valid NDJSON ending in a 'done' event", async () => {
    const events = await runBrief("An AI note-taking app for busy doctors");
    expect(events.length).toBeGreaterThan(10);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("emits the planner-first agent sequence", async () => {
    const events = await runBrief("a calendar that schedules itself");
    const first = events[0];
    expect(first).toMatchObject({ type: "status", agent: "director", status: "working" });
    const workers = events
      .filter((e) => e.type === "status" && e.status === "working")
      .map((e) => (e as { agent: string }).agent);
    for (const a of ["copy", "image", "logo", "voice", "music", "critic"]) {
      expect(workers).toContain(a);
    }
  });

  it("streams a live log feed", async () => {
    const events = await runBrief("eco-friendly running shoes");
    const logs = events.filter((e) => e.type === "log");
    expect(logs.length).toBeGreaterThanOrEqual(5);
  });

  it("runs the self-correcting critic loop (score rises after revision)", async () => {
    const events = await runBrief("a productivity app for remote teams");
    const critiques = events
      .filter((e) => e.type === "asset" && (e as { key: string }).key === "critique")
      .map((e) => (e as { value: { score: number } }).value.score);
    // first critique below threshold, final critique higher
    expect(critiques.length).toBeGreaterThanOrEqual(2);
    expect(critiques[0]).toBeLessThan(85);
    expect(critiques.at(-1)!).toBeGreaterThan(critiques[0]);
    // a "revised ✦" status confirms an asset was actually reworked
    const revised = events.some(
      (e) => e.type === "status" && (e as { note?: string }).note === "revised ✦"
    );
    expect(revised).toBe(true);
  });

  it("assembles a complete LaunchKit", async () => {
    const events = await runBrief("a smart water bottle");
    const done = events.at(-1) as { type: "done"; kit: LaunchKit };
    const kit = done.kit;
    expect(kit.plan.brand).toBeTruthy();
    expect(kit.social).toHaveLength(3);
    expect(kit.heroUrl).toBeTruthy();
    expect(kit.logoUrl).toBeTruthy();
    expect(kit.audioUrl).toBeTruthy();
    expect(kit.musicUrl).toBeTruthy();
    expect(kit.critique?.score).toBeGreaterThan(0);
  });

  it("emits an error event for an empty brief", async () => {
    const events = await runBrief("   ");
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});
