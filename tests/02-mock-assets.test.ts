import { describe, it, expect } from "vitest";
import {
  mockImageDataUri,
  mockLogoDataUri,
  mockAudioDataUri,
  isMock,
} from "@/lib/gmi";
import { mockPlan, mockCopy, mockCritique, jingleLyrics } from "@/lib/agents";

// With no GMI_API_KEY in the test env, the whole stack must be in mock mode.
describe("mock mode", () => {
  it("is active when no key is set", () => {
    expect(isMock()).toBe(true);
  });
});

describe("mock asset generators", () => {
  it("produces a valid SVG data URI for images", () => {
    const uri = mockImageDataUri("a hero shot", ["#0EA5E9", "#6366F1"]);
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(uri)).toContain("<svg");
  });

  it("embeds brand initials in the logo", () => {
    const uri = mockLogoDataUri("Frost Vibe", ["#0EA5E9"]);
    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(uri)).toContain("FV");
  });

  it("produces a structurally valid WAV data URI", () => {
    const uri = mockAudioDataUri();
    expect(uri.startsWith("data:audio/wav;base64,")).toBe(true);
    const b64 = uri.split(",")[1];
    const buf = Buffer.from(b64, "base64");
    // RIFF/WAVE magic bytes => players will accept it.
    expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buf.toString("ascii", 8, 12)).toBe("WAVE");
  });
});

describe("mock content generators", () => {
  it("mockPlan returns a complete Plan", () => {
    const p = mockPlan("an AI calendar that schedules itself");
    expect(p.brand).toBeTruthy();
    expect(p.positioning).toBeTruthy();
    expect(p.palette.length).toBeGreaterThanOrEqual(3);
    expect(p.palette.every((c) => /^#/.test(c))).toBe(true);
    expect(p.imagePrompt).toBeTruthy();
    expect(p.logoPrompt).toBeTruthy();
    expect(p.adScript).toBeTruthy();
    expect(typeof p.musicPrompt).toBe("string");
  });

  it("mockCopy returns exactly 3 social posts with valid platforms", () => {
    const c = mockCopy(mockPlan("test"));
    expect(c.social).toHaveLength(3);
    expect(c.social.map((s) => s.platform).sort()).toEqual([
      "Instagram",
      "LinkedIn",
      "X",
    ]);
    expect(c.headline && c.subhead && c.body && c.cta).toBeTruthy();
  });

  it("mockCritique flags a revision first, then clears it when revised", () => {
    const first = mockCritique(false);
    expect(first.score).toBeLessThan(85);
    expect(first.revisedAsset).toBe("copy");

    const revised = mockCritique(true);
    expect(revised.score).toBeGreaterThanOrEqual(85);
    expect(revised.revisedAsset).toBeNull();
  });

  it("jingleLyrics yields valid music lyrics with structure tags", () => {
    const lyrics = jingleLyrics(mockPlan("eco running shoes"));
    expect(lyrics).toContain("[Verse]");
    expect(lyrics).toContain("[Chorus]");
    expect(lyrics.length).toBeGreaterThan(0);
    expect(lyrics.length).toBeLessThanOrEqual(3500);
  });
});
