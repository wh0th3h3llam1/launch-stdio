// ───────────────────────────────────────────────────────────────────────────
// §5 Integration contract — the law both frontend (Kenil) and backend (Aarsh)
// code against. Changes here happen together, never silently.
// ───────────────────────────────────────────────────────────────────────────

export type SocialPost = {
  platform: "X" | "LinkedIn" | "Instagram";
  text: string;
};

export type Plan = {
  brand: string;
  positioning: string;
  palette: string[]; // hex values, 3–5
  imagePrompt: string;
  logoPrompt: string;
  adScript: string;
  musicPrompt: string;
};

export type Critique = {
  score: number; // 0–100 brand-consistency
  notes: string;
  revisedAsset: "copy" | "image" | "logo" | null;
};

export type LaunchKit = {
  plan: Plan;
  headline: string;
  subhead: string;
  body: string;
  cta: string;
  social: SocialPost[];
  heroUrl: string | null;
  logoUrl: string | null;
  audioUrl: string | null;
  musicUrl: string | null;
  critique: Critique | null;
};

export type AgentId =
  | "director"
  | "copy"
  | "image"
  | "logo"
  | "voice"
  | "music"
  | "critic";

export type AgentStatus = "idle" | "working" | "done" | "error";

export type Provider = "GMI" | "Nebius" | "mock";

// Newline-delimited JSON events streamed from POST /api/run so the UI feed is live.
export type AgentEvent =
  | {
      type: "status";
      agent: AgentId;
      status: AgentStatus;
      provider?: Provider;
      note?: string;
    }
  | { type: "asset"; key: keyof LaunchKit; value: unknown; provider: Provider }
  | { type: "log"; agent: AgentId; message: string }
  | { type: "done"; kit: LaunchKit }
  | { type: "error"; agent?: AgentId; message: string };

// The copywriter's structured output (subset of LaunchKit text fields).
export type CopyResult = {
  headline: string;
  subhead: string;
  body: string;
  cta: string;
  social: SocialPost[];
};

// Generic wrapper every inference helper returns so the UI can attribute work.
export type Produced<T> = {
  value: T;
  provider: Provider;
};
