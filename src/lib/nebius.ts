import type { ChatMessage } from "./gmi";

// ───────────────────────────────────────────────────────────────────────────
// Nebius — OpenAI-compatible LLM, used ONLY as a text fallback when a GMI text
// call fails or times out. GMI stays the primary, visually-dominant provider.
// Image / TTS / music remain GMI-only.
// ───────────────────────────────────────────────────────────────────────────

const NEBIUS_KEY = process.env.NEBIUS_API_KEY?.trim() || "";

const NEBIUS_URL =
  process.env.NEBIUS_LLM_URL?.trim() ||
  "https://api.studio.nebius.com/v1/chat/completions";

const NEBIUS_MODEL =
  process.env.NEBIUS_LLM_MODEL?.trim() || "deepseek-ai/DeepSeek-V3";

export const hasNebius = () => NEBIUS_KEY !== "";

export async function nebiusChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!hasNebius()) throw new Error("Nebius key not configured");
  const res = await fetch(NEBIUS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NEBIUS_KEY}`,
    },
    body: JSON.stringify({
      model: NEBIUS_MODEL,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 1500,
    }),
  });
  if (!res.ok) {
    throw new Error(`Nebius ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Nebius returned empty content");
  return content;
}
