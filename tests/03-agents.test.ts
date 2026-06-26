import { describe, it, expect } from "vitest";
import {
  creativeDirector,
  copywriter,
  artDirector,
  produceImage,
  produceLogo,
  produceVoice,
  produceMusic,
  jingleLyrics,
} from "@/lib/agents";
import type { LaunchKit } from "@/lib/types";

// In mock mode every agent must still return the Produced<T> contract shape
// ({ value, provider }) so the orchestrator and per-asset routes work key-free.
describe("agents in mock mode", () => {
  it("creativeDirector returns a Plan tagged mock", async () => {
    const r = await creativeDirector("a self-chilling water bottle");
    expect(r.provider).toBe("mock");
    expect(r.value.palette.length).toBeGreaterThanOrEqual(3);
    expect(typeof r.value.musicPrompt).toBe("string");
  });

  it("copywriter returns copy with 3 social posts", async () => {
    const plan = (await creativeDirector("a coffee subscription")).value;
    const r = await copywriter(plan);
    expect(r.provider).toBe("mock");
    expect(r.value.social).toHaveLength(3);
  });

  it("image/logo producers return image data URIs", async () => {
    const img = await produceImage("hero shot", ["#000000"]);
    const logo = await produceLogo("logo mark", "Acme", ["#000000"]);
    expect(img.provider).toBe("mock");
    expect(img.value.startsWith("data:image/")).toBe(true);
    expect(logo.value.startsWith("data:image/")).toBe(true);
  });

  it("voice/music producers return audio data URIs", async () => {
    const voice = await produceVoice("an ad script");
    const music = await produceMusic("upbeat", jingleLyrics((await creativeDirector("x")).value));
    expect(voice.value.startsWith("data:audio/")).toBe(true);
    expect(music.value.startsWith("data:audio/")).toBe(true);
  });

  it("artDirector scores low first, high after revision", async () => {
    const plan = (await creativeDirector("a productivity app")).value;
    const copy = (await copywriter(plan)).value;
    const kit: LaunchKit = {
      plan,
      ...copy,
      heroUrl: null,
      logoUrl: null,
      audioUrl: null,
      musicUrl: null,
      critique: null,
    };
    const first = await artDirector(kit);
    const second = await artDirector(kit, { revised: true });
    expect(first.value.score).toBeLessThan(85);
    expect(second.value.score).toBeGreaterThan(first.value.score);
  });
});
