import {
  gmiChat,
  gmiImage,
  gmiTts,
  gmiMusic,
  extractJson,
  isMock,
  mockImageDataUri,
  mockLogoDataUri,
  mockAudioDataUri,
  type ChatMessage,
} from "./gmi";
import { nebiusChat, hasNebius } from "./nebius";
import type {
  Plan,
  CopyResult,
  Critique,
  LaunchKit,
  Produced,
  Provider,
} from "./types";

// ───────────────────────────────────────────────────────────────────────────
// The agent layer. LLM agents (director, copywriter, critic) reason via GMI
// with a Nebius text-only fallback. Asset producers (image/logo/voice/music)
// are GMI-only. Every function returns Produced<T> so the UI can attribute work.
// In mock mode (no GMI key) every function returns polished canned output.
// ───────────────────────────────────────────────────────────────────────────

// Unified chat: GMI primary → Nebius fallback on failure. Returns the provider
// that actually produced the text so the UI badge is honest.
async function llmChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<{ text: string; provider: Provider }> {
  try {
    const text = await gmiChat(messages, opts);
    return { text, provider: "GMI" };
  } catch (gmiErr) {
    if (hasNebius()) {
      try {
        const text = await nebiusChat(messages, opts);
        return { text, provider: "Nebius" };
      } catch {
        /* fall through to throw the original GMI error */
      }
    }
    throw gmiErr;
  }
}

// ── Creative Director (planner) ───────────────────────────────────────────────
const DIRECTOR_SYSTEM = `You are the Creative Director of a product-launch studio.
Given a one-line product brief, produce a tight, on-brand creative plan as STRICT JSON.
Return ONLY a JSON object with exactly these keys:
{
  "brand": string,               // short, memorable product/brand name
  "positioning": string,         // one punchy sentence of positioning
  "palette": string[],           // 3-5 hex colors that fit the brand, e.g. "#0EA5E9"
  "imagePrompt": string,         // vivid prompt for a hero product image (no text in image)
  "logoPrompt": string,          // prompt for a clean, minimal logo mark
  "adScript": string,            // 25-40 word spoken voiceover ad script, warm and confident
  "musicPrompt": string          // short description of a background jingle mood
}
No markdown, no commentary, no <think>. JSON only.`;

export async function creativeDirector(brief: string): Promise<Produced<Plan>> {
  if (isMock()) return { value: mockPlan(brief), provider: "mock" };
  const { text, provider } = await llmChat(
    [
      { role: "system", content: DIRECTOR_SYSTEM },
      { role: "user", content: `Product brief: ${brief}` },
    ],
    { temperature: 0.9, maxTokens: 900 }
  );
  const raw = extractJson<Partial<Plan>>(text);
  return { value: normalizePlan(raw, brief), provider };
}

function normalizePlan(raw: Partial<Plan>, brief: string): Plan {
  const fallback = mockPlan(brief);
  let palette = Array.isArray(raw.palette)
    ? raw.palette.filter((c) => typeof c === "string" && /^#/.test(c))
    : [];
  if (palette.length < 3) palette = fallback.palette;
  palette = palette.slice(0, 5);
  return {
    brand: (raw.brand || fallback.brand).toString().trim(),
    positioning: (raw.positioning || fallback.positioning).toString().trim(),
    palette,
    imagePrompt: (raw.imagePrompt || fallback.imagePrompt).toString().trim(),
    logoPrompt: (raw.logoPrompt || fallback.logoPrompt).toString().trim(),
    adScript: (raw.adScript || fallback.adScript).toString().trim(),
    musicPrompt: (raw.musicPrompt || fallback.musicPrompt).toString().trim(),
  };
}

// ── Copywriter ────────────────────────────────────────────────────────────────
const COPY_SYSTEM = `You are a world-class launch Copywriter.
Given a creative plan, write landing-page copy and social posts as STRICT JSON.
Return ONLY:
{
  "headline": string,            // punchy hero headline (<= 8 words)
  "subhead": string,             // supporting sentence
  "body": string,                // 2-3 sentence value paragraph
  "cta": string,                 // 2-4 word call to action
  "social": [                    // exactly 3 posts
    { "platform": "X", "text": string },
    { "platform": "LinkedIn", "text": string },
    { "platform": "Instagram", "text": string }
  ]
}
Match the brand voice and positioning. No markdown, no <think>. JSON only.`;

export async function copywriter(
  plan: Plan,
  extraNote?: string
): Promise<Produced<CopyResult>> {
  if (isMock()) return { value: mockCopy(plan), provider: "mock" };
  const note = extraNote ? `\n\nArt Director revision note: ${extraNote}` : "";
  const { text, provider } = await llmChat(
    [
      { role: "system", content: COPY_SYSTEM },
      {
        role: "user",
        content: `Creative plan:\n${JSON.stringify(plan, null, 2)}${note}`,
      },
    ],
    { temperature: 0.85, maxTokens: 900 }
  );
  const raw = extractJson<Partial<CopyResult>>(text);
  return { value: normalizeCopy(raw, plan), provider };
}

function normalizeCopy(raw: Partial<CopyResult>, plan: Plan): CopyResult {
  const fallback = mockCopy(plan);
  const social = Array.isArray(raw.social)
    ? raw.social
        .filter((p) => p && typeof p.text === "string")
        .map((p) => ({
          platform: (["X", "LinkedIn", "Instagram"].includes(p.platform as string)
            ? p.platform
            : "X") as CopyResult["social"][number]["platform"],
          text: p.text,
        }))
    : [];
  return {
    headline: (raw.headline || fallback.headline).toString().trim(),
    subhead: (raw.subhead || fallback.subhead).toString().trim(),
    body: (raw.body || fallback.body).toString().trim(),
    cta: (raw.cta || fallback.cta).toString().trim(),
    social: social.length === 3 ? social : fallback.social,
  };
}

// ── Asset producers (GMI-only) ────────────────────────────────────────────────
export async function produceImage(
  prompt: string,
  palette: string[] = []
): Promise<Produced<string>> {
  if (isMock()) return { value: mockImageDataUri(prompt, palette), provider: "mock" };
  try {
    return { value: await gmiImage(prompt), provider: "GMI" };
  } catch {
    return { value: mockImageDataUri(prompt, palette), provider: "mock" };
  }
}

export async function produceLogo(
  prompt: string,
  brand = "Launch",
  palette: string[] = []
): Promise<Produced<string>> {
  if (isMock()) return { value: mockLogoDataUri(brand, palette), provider: "mock" };
  try {
    // seedream rejects sizes < 1024; use a square 1024 for the logo mark.
    return { value: await gmiImage(prompt, { size: "1024x1024" }), provider: "GMI" };
  } catch {
    return { value: mockLogoDataUri(brand, palette), provider: "mock" };
  }
}

export async function produceVoice(script: string): Promise<Produced<string>> {
  if (isMock()) return { value: mockAudioDataUri(320), provider: "mock" };
  try {
    return { value: await gmiTts(script), provider: "GMI" };
  } catch {
    return { value: mockAudioDataUri(320), provider: "mock" };
  }
}

// Build a short, valid jingle lyric from the brand so minimax-music has the
// required `lyrics` field even though our brief is product-, not song-, shaped.
export function jingleLyrics(plan: Plan): string {
  const tag = plan.positioning.split(/[.—-]/)[0].trim().slice(0, 80);
  return `[Verse]\n${plan.brand}, here to lead the way\n${tag}\n[Chorus]\n${plan.brand}, ${plan.brand}, launch today\nMake it happen, light the way`;
}

export async function produceMusic(
  style: string,
  lyrics: string,
  opts: { forceMock?: boolean } = {}
): Promise<Produced<string>> {
  // Live music (minimax-music-2.5) is correct but slow (~30-110s). The
  // orchestrator can force mock to keep the demo run snappy while the standalone
  // /api/music route still proves the real call.
  if (isMock() || opts.forceMock) {
    return { value: mockAudioDataUri(180, 2), provider: "mock" };
  }
  try {
    return { value: await gmiMusic(style, lyrics), provider: "GMI" };
  } catch {
    return { value: mockAudioDataUri(180, 2), provider: "mock" };
  }
}

// ── Art Director (critic) ─────────────────────────────────────────────────────
const CRITIC_SYSTEM = `You are the Art Director, a sharp brand critic reviewing a FIRST DRAFT.
Given an assembled launch kit (plan + copy), judge BRAND CONSISTENCY: does the
copy match the positioning, voice, and palette intent? Return STRICT JSON only:
{
  "score": number,               // 0-100 brand-consistency score
  "notes": string,               // 1-2 sentences: the single biggest weakness, with a concrete fix
  "revisedAsset": "copy" | "image" | "logo" | null  // weakest asset to redo, or null if exceptional
}
Be a tough first-pass critic: reserve scores of 85+ only for truly polished,
fully-consistent kits. A first draft almost always has one weakest asset — name it
in "revisedAsset" (usually "copy") unless the kit is genuinely exceptional.
No markdown, no <think>. JSON only.`;

const CRITIC_REVISED_HINT = `\n\nNOTE: This is the REVISED kit — the weakest asset was just reworked using your earlier notes. Score the improved result; reward the fix if it now reads as one consistent brand.`;

export async function artDirector(
  kit: LaunchKit,
  opts: { revised?: boolean } = {}
): Promise<Produced<Critique>> {
  if (isMock()) return { value: mockCritique(opts.revised), provider: "mock" };
  const summary = {
    plan: kit.plan,
    headline: kit.headline,
    subhead: kit.subhead,
    body: kit.body,
    cta: kit.cta,
    social: kit.social,
  };
  const userMsg =
    `Launch kit:\n${JSON.stringify(summary, null, 2)}` +
    (opts.revised ? CRITIC_REVISED_HINT : "");
  const { text, provider } = await llmChat(
    [
      { role: "system", content: CRITIC_SYSTEM },
      { role: "user", content: userMsg },
    ],
    { temperature: 0.4, maxTokens: 500 }
  );
  const raw = extractJson<Partial<Critique>>(text);
  const score = Math.max(
    0,
    Math.min(100, Math.round(Number(raw.score) || 72))
  );
  const allowed = ["copy", "image", "logo"];
  const revisedAsset =
    raw.revisedAsset && allowed.includes(raw.revisedAsset)
      ? (raw.revisedAsset as Critique["revisedAsset"])
      : null;
  return {
    value: {
      score,
      notes: (raw.notes || "Solid and on-brand.").toString().trim(),
      revisedAsset,
    },
    provider,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Mock generators — polished canned output for zero-key runs and demo fallback.
// ───────────────────────────────────────────────────────────────────────────
export function mockPlan(brief: string): Plan {
  const seed = brief.trim() || "a bold new product";
  const brand = titleCaseBrand(seed);
  return {
    brand,
    positioning: `The effortless way to ${shorten(seed)} — built for people who move fast.`,
    palette: ["#0EA5E9", "#6366F1", "#EC4899", "#F8FAFC"],
    imagePrompt: `Premium product hero shot for ${brand}: ${seed}. Studio lighting, soft gradients, cinematic depth of field, modern and aspirational, no text.`,
    logoPrompt: `Minimal geometric logo mark for ${brand}, clean lines, electric blue to indigo gradient, flat vector, on white.`,
    adScript: `Meet ${brand}. ${capitalize(shorten(seed))}, without the friction. Smarter, faster, beautifully simple. ${brand} — launch like you mean it.`,
    musicPrompt: `Upbeat, optimistic synth-pop bed, warm and modern, building energy, 15 seconds.`,
  };
}

export function mockCopy(plan: Plan): CopyResult {
  return {
    headline: `${plan.brand}: Launch Without Limits`,
    subhead: plan.positioning,
    body: `${plan.brand} brings everything you need into one beautiful, fast experience. Set up in minutes, look like a pro from day one, and let the work feel effortless.`,
    cta: "Get Started Free",
    social: [
      {
        platform: "X",
        text: `🚀 Introducing ${plan.brand} — ${plan.positioning} Try it today.`,
      },
      {
        platform: "LinkedIn",
        text: `Excited to launch ${plan.brand}. ${plan.positioning} We built it for teams who want to move fast without the busywork. Would love your feedback.`,
      },
      {
        platform: "Instagram",
        text: `✨ ${plan.brand} is here. ${plan.positioning} Tap the link in bio. #launch #${plan.brand.replace(/\s+/g, "")}`,
      },
    ],
  };
}

export function mockCritique(revised = false): Critique {
  if (revised) {
    return {
      score: 92,
      notes:
        "Revision locked the voice to the premium positioning — palette, tone, and CTA now read as one brand. Ship it.",
      revisedAsset: null,
    };
  }
  return {
    score: 74,
    notes:
      "Strong concept, but the social voice drifts more casual than the premium positioning. Tighten the copy to match the brand's confident tone.",
    revisedAsset: "copy",
  };
}

// ── small text helpers ────────────────────────────────────────────────────────
function shorten(s: string, words = 8): string {
  const w = s.replace(/[.?!]+$/, "").split(/\s+/);
  return w.slice(0, words).join(" ");
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function titleCaseBrand(seed: string): string {
  const words = seed.split(/\s+/).filter(Boolean);
  const noun = words.find((w) => w.length > 3) || words[0] || "Nova";
  return capitalize(noun.replace(/[^a-zA-Z]/g, "")) || "Nova";
}
