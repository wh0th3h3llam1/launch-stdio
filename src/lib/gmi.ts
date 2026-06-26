import type { Provider } from "./types";

// ───────────────────────────────────────────────────────────────────────────
// GMI Cloud client — one API key drives LLM (text), image, TTS, and music.
// Falls back to high-quality MOCK assets when GMI_API_KEY is blank so the whole
// app (and the demo) runs with zero keys. This file is the inference backbone.
// ───────────────────────────────────────────────────────────────────────────

// AgentBox injects the MaaS key + a base/LLM URL. Names vary by template
// (GMI_MAAS_LLM_URL or GMI_MAAS_BASE_URL), so resolve all of them. Falls back
// to developer-local GMI_API_KEY so the app works outside AgentBox too.
const GMI_KEY =
  process.env.GMI_MAAS_API_KEY?.trim() ||
  process.env.GMI_API_KEY?.trim() ||
  "";

const _maasBase = process.env.GMI_MAAS_BASE_URL?.trim();
export const GMI_LLM_URL =
  process.env.GMI_MAAS_LLM_URL?.trim() ||
  process.env.GMI_LLM_URL?.trim() ||
  (_maasBase ? `${_maasBase.replace(/\/+$/, "")}/v1/chat/completions` : null) ||
  "https://api.gmi-serving.com/v1/chat/completions";
export const GMI_IE_URL =
  process.env.GMI_IE_URL?.trim() ||
  "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests";

// The MaaS LLM endpoint requires an explicit model name (verified: omitting it
// returns 400 "Missing model"). These are overridable but default to verified
// live IDs from GMI's catalog.
const MODELS = {
  llm: process.env.GMI_LLM_MODEL?.trim() || "deepseek-ai/DeepSeek-V3-0324",
  image: process.env.GMI_IMAGE_MODEL?.trim() || "seedream-4-0-250828",
  tts: process.env.GMI_TTS_MODEL?.trim() || "inworld-tts-1.5-mini",
  music: process.env.GMI_MUSIC_MODEL?.trim() || "minimax-music-2.5",
};

export const isMock = () => GMI_KEY === "";

// Live counter of GMI API calls — surfaced via /api/status for the UI stat bar.
let gmiCallCount = 0;
export const getGmiCallCount = () => gmiCallCount;

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${GMI_KEY}`,
});

// ── JSON extraction ─────────────────────────────────────────────────────────
// LLMs (esp. DeepSeek) wrap output in <think>…</think> and ```json fences.
// Strip both and pull the first balanced JSON object/array.
export function extractJson<T = unknown>(raw: string): T {
  let s = raw ?? "";
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  s = s.replace(/```(?:json)?/gi, "```").replace(/```/g, "");
  s = s.trim();

  // Find first { or [ and match to its close.
  const start = s.search(/[{[]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        return JSON.parse(s.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error("Unbalanced JSON in model output");
}

// ── LLM ─────────────────────────────────────────────────────────────────────
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function gmiChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (isMock()) throw new Error("gmiChat called in mock mode");
  gmiCallCount++;
  const res = await fetch(GMI_LLM_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: MODELS.llm,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 1500,
    }),
  });
  if (!res.ok) {
    throw new Error(`GMI LLM ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("GMI LLM returned empty content");
  return content;
}

// ── Inference-Engine (image / TTS / music) async request queue ───────────────
// Submit a job, then poll until the outcome is ready. Tolerant of both a
// synchronous outcome on submit and the request-id + poll pattern.
async function gmiInference(
  model: string,
  payload: Record<string, unknown>,
  pick: (outcome: Record<string, unknown>) => string | undefined,
  timeoutMs = 90_000
): Promise<string> {
  if (isMock()) throw new Error("gmiInference called in mock mode");
  gmiCallCount++;

  const submit = await fetch(GMI_IE_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, payload }),
  });
  if (!submit.ok) {
    throw new Error(`GMI IE ${submit.status}: ${await submit.text().catch(() => "")}`);
  }
  const first = await submit.json();

  const tryPick = (obj: unknown): string | undefined => {
    const outcome = (obj as { outcome?: Record<string, unknown> })?.outcome;
    if (outcome) {
      const url = pick(outcome);
      if (url) return url;
    }
    return undefined;
  };

  const immediate = tryPick(first);
  if (immediate) return immediate;

  const requestId: string | undefined =
    first?.request_id || first?.id || first?.requestId;
  if (!requestId) {
    throw new Error("GMI IE: no request_id and no immediate outcome");
  }

  const pollUrl = `${GMI_IE_URL}/${requestId}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const poll = await fetch(pollUrl, { headers: authHeaders() });
    if (!poll.ok) continue;
    const data = await poll.json();
    const url = tryPick(data);
    if (url) return url;
    const status: string | undefined = data?.status || data?.state;
    if (status && /fail|error|cancel/i.test(status)) {
      throw new Error(`GMI IE job ${status}`);
    }
  }
  throw new Error("GMI IE timed out");
}

export async function gmiImage(
  prompt: string,
  opts: { size?: string } = {}
): Promise<string> {
  return gmiInference(
    MODELS.image,
    {
      prompt,
      size: opts.size ?? "1024x1024",
      max_images: 1,
      watermark: false,
      response_format: "url",
    },
    (o) => {
      const media = o.media_urls as Array<{ url?: string }> | undefined;
      return media?.[0]?.url || (o.image_url as string | undefined);
    }
  );
}

export async function gmiTts(text: string): Promise<string> {
  return gmiInference(
    MODELS.tts,
    {
      text,
      voice_id: process.env.GMI_TTS_VOICE?.trim() || "Ashley",
      audio_encoding: "MP3",
      sample_rate_hertz: 24000,
      speaking_rate: 1.0,
      temperature: 0.7,
    },
    (o) => (o.audio_url as string | undefined) || (o.url as string | undefined)
  );
}

// Cap the music bed length. minimax-music's clip length mainly tracks the
// lyric content, so we also keep jingleLyrics short; `duration` is the explicit
// hint applied when the adapter honors it. Override via GMI_MUSIC_SECONDS.
export const MUSIC_SECONDS = Number(process.env.GMI_MUSIC_SECONDS) || 20;

export async function gmiMusic(style: string, lyrics: string): Promise<string> {
  return gmiInference(
    MODELS.music,
    {
      lyrics,
      prompt: style,
      duration: MUSIC_SECONDS,
      sample_rate: 44100,
      bitrate: 128000,
      format: "mp3",
    },
    (o) =>
      (o.audio_url as string | undefined) ||
      (o.url as string | undefined) ||
      ((o.audio as { url?: string } | undefined)?.url),
    150_000
  );
}

// ── Mock assets ──────────────────────────────────────────────────────────────
// Inline data-URI assets so mock mode needs no network and no files on disk.

export function mockImageDataUri(seedText: string, palette: string[]): string {
  const [a = "#6366f1", b = "#ec4899", c = "#22d3ee"] = palette;
  // Deterministic-ish hue offset from the seed so different prompts differ.
  let h = 0;
  for (const ch of seedText) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="0.5" stop-color="${b}"/>
      <stop offset="1" stop-color="${c}"/>
    </linearGradient>
    <radialGradient id="r" cx="0.3" cy="0.3" r="0.8">
      <stop offset="0" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" fill="url(#r)"/>
  <g transform="rotate(${h} 512 512)" opacity="0.25">
    <circle cx="512" cy="512" r="300" fill="none" stroke="white" stroke-width="40"/>
    <circle cx="512" cy="512" r="200" fill="none" stroke="white" stroke-width="24"/>
  </g>
  <text x="512" y="540" font-family="system-ui,Segoe UI,sans-serif" font-size="44"
    fill="rgba(255,255,255,0.9)" text-anchor="middle" font-weight="700">mock asset</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function mockLogoDataUri(brand: string, palette: string[]): string {
  const [a = "#6366f1", b = "#0ea5e9"] = palette;
  const initials = brand
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#lg)"/>
  <text x="256" y="312" font-family="system-ui,Segoe UI,sans-serif" font-size="200"
    fill="white" text-anchor="middle" font-weight="800">${initials || "L"}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Generate a short sine-tone WAV as a data URI (valid, playable, ~1.2s).
export function mockAudioDataUri(freq = 320, seconds = 1.2): string {
  const sampleRate = 8000;
  const n = Math.floor(sampleRate * seconds);
  const dataLen = n; // 8-bit mono
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28); // byte rate (1 byte/sample)
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits/sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 400, (n - i) / 400); // fade in/out
    const v = Math.sin((2 * Math.PI * freq * i) / sampleRate) * env;
    buf[44 + i] = Math.round((v * 0.5 + 0.5) * 255);
  }
  return `data:audio/wav;base64,${buf.toString("base64")}`;
}

// ── Provider tagging helper ───────────────────────────────────────────────────
export const liveProvider: Provider = "GMI";
export const mockProvider: Provider = "mock";
