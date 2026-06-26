"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentEvent, AgentId, AgentStatus, LaunchKit, Provider, SocialPost } from "@/lib/types";

const EXAMPLES = [
  "A self-chilling stainless steel water bottle, $39",
  "An AI note-taking app for busy doctors",
  "Hand-roasted single-origin coffee subscription",
];

const AGENTS: { id: AgentId; name: string; role: string; icon: string }[] = [
  { id: "director", name: "Creative Director", role: "LLM · plan", icon: "sparkles" },
  { id: "copy", name: "Copywriter", role: "LLM · text", icon: "pen" },
  { id: "image", name: "Designer · Hero", role: "Image · Seedream", icon: "image" },
  { id: "logo", name: "Designer · Logo", role: "Image · Seedream", icon: "hex" },
  { id: "voice", name: "Voice", role: "TTS · Inworld", icon: "mic" },
  { id: "music", name: "Composer", role: "Music · MiniMax", icon: "music" },
  { id: "critic", name: "Art Director", role: "LLM · review", icon: "eye" },
];

type Statuses = Record<AgentId, AgentStatus>;
const IDLE: Statuses = { director: "idle", copy: "idle", image: "idle", logo: "idle", voice: "idle", music: "idle", critic: "idle" };

export default function Home() {
  const [brief, setBrief] = useState("");
  const [running, setRunning] = useState(false);
  const [mock, setMock] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Statuses>(IDLE);
  const [providers, setProviders] = useState<Partial<Record<AgentId, Provider>>>({});
  const [logs, setLogs] = useState<{ agent: AgentId; message: string }[]>([]);
  const [calls, setCalls] = useState(0);
  const [headline, setHeadline] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [kit, setKit] = useState<LaunchKit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const kitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((d) => setMock(!!d.mock)).catch(() => setMock(true));
  }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: 1e9 }); }, [logs]);

  async function run() {
    if (!brief.trim() || running) return;
    setRunning(true);
    setError(null); setStatus(IDLE); setProviders({}); setLogs([]); setCalls(0);
    setHeadline(null); setHeroUrl(null); setLogoUrl(null); setAudioUrl(null); setMusicUrl(null);
    setScore(null); setKit(null);

    try {
      const res = await fetch("/api/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief }),
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line) handle(JSON.parse(line) as AgentEvent);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function handle(e: AgentEvent) {
    if (e.type === "status") {
      setStatus((s) => ({ ...s, [e.agent]: e.status }));
      if (e.provider) setProviders((p) => ({ ...p, [e.agent]: e.provider }));
      if (e.status === "done") setCalls((c) => c + 1);
    } else if (e.type === "log") {
      setLogs((l) => [...l, { agent: e.agent, message: e.message }].slice(-40));
    } else if (e.type === "asset") {
      if (e.key === "headline") setHeadline(e.value as string);
      else if (e.key === "heroUrl") setHeroUrl(e.value as string);
      else if (e.key === "logoUrl") setLogoUrl(e.value as string);
      else if (e.key === "audioUrl") setAudioUrl(e.value as string);
      else if (e.key === "musicUrl") setMusicUrl(e.value as string);
      else if (e.key === "critique") { const c = e.value as { score: number } | null; if (c) setScore(c.score); }
    } else if (e.type === "done") {
      setKit(e.kit); setScore(e.kit.critique?.score ?? null);
      setTimeout(() => kitRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    } else if (e.type === "error") {
      setError(e.message);
    }
  }

  const started = running || logs.length > 0 || !!kit;

  return (
    <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-28 pt-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center border border-acid/40 bg-acid/10 text-acid">
            <Icon name="sparkles" />
          </div>
          <span className="font-display text-lg font-extrabold tracking-tight">
            LAUNCH<span className="text-acid">/</span>STUDIO
          </span>
        </div>
        <div className="flex items-center gap-3">
          <CounterPill calls={calls} />
          <StatusPill mock={mock} />
        </div>
      </header>

      {/* Hero + input */}
      <section className="mt-16 text-center">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mono-label">
          AGENTS FOR HIRE · POWERED BY GMI CLOUD
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="font-display mx-auto mt-4 max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl"
        >
          Hire an AI team to <span className="text-acid">launch</span> your product.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-dim sm:text-base"
        >
          One brief in. A full launch kit out — logo, hero image, landing copy, social, and a
          voiceover ad. Built by six agents that plan, produce, and <span className="text-ink">critique their own work</span>.
        </motion.p>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="card mx-auto mt-10 max-w-2xl p-2"
      >
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
          rows={2}
          placeholder="Describe your product…  e.g. a self-chilling water bottle for $39"
          className="w-full resize-none bg-transparent px-4 py-3 text-base outline-none placeholder:text-ink-dim/60"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
          <div className="hidden gap-2 sm:flex">
            {EXAMPLES.slice(0, 2).map((ex) => (
              <button key={ex} onClick={() => setBrief(ex)}
                className="mono-label border border-line px-2.5 py-1 transition hover:border-ink-dim hover:text-ink">
                {ex.length > 30 ? ex.slice(0, 30) + "…" : ex}
              </button>
            ))}
          </div>
          <button onClick={run} disabled={running || !brief.trim()}
            className="group ml-auto flex items-center gap-2 bg-acid px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">
            {running ? "Agents working…" : "Hire the team"}
            <span className="transition group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </motion.div>

      {error && (
        <p className="mx-auto mt-4 max-w-2xl border border-coral/40 bg-coral/10 px-4 py-2 text-center text-sm text-coral">{error}</p>
      )}

      {/* Control room */}
      <AnimatePresence>
        {started && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-14 grid gap-4 lg:grid-cols-[1fr_340px]">
            {/* Agent grid */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {AGENTS.map((a, i) => (
                <AgentCard key={a.id} agent={a} status={status[a.id]} provider={providers[a.id]} index={i}
                  preview={
                    a.id === "copy" && headline ? `“${headline}”`
                    : a.id === "critic" && score != null ? `Score ${score}/100`
                    : a.id === "image" && heroUrl ? "hero" : a.id === "logo" && logoUrl ? "logo"
                    : a.id === "voice" && audioUrl ? "voiced" : a.id === "music" && musicUrl ? "scored" : null
                  }
                  media={a.id === "image" ? heroUrl : a.id === "logo" ? logoUrl : null}
                />
              ))}
            </div>
            {/* Live log */}
            <div className="card flex flex-col p-0">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-acid pulse-acid" />
                <span className="mono-label !text-ink">AGENT FEED</span>
              </div>
              <div ref={logRef} className="font-mono flex-1 space-y-2 overflow-y-auto px-4 py-3 text-[12px] leading-relaxed max-h-[420px] min-h-[180px]">
                {logs.length === 0 && <span className="text-ink-dim">Waiting for agents…</span>}
                {logs.map((l, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="text-ink-dim">
                    <span className="text-acid">{l.agent}&gt;</span> {l.message}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launch kit */}
      <AnimatePresence>
        {kit && (
          <motion.div ref={kitRef} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-16">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-3xl font-extrabold tracking-tight">The launch kit</h2>
              {kit.critique && <ScoreBadge score={kit.critique.score} />}
              <button onClick={() => downloadKit(kit)}
                className="mono-label ml-auto border border-acid/50 bg-acid/10 px-3 py-1.5 !text-acid transition hover:bg-acid/20">
                ↓ DOWNLOAD KIT
              </button>
            </div>

            {/* Landing preview */}
            <div className="card overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="flex flex-col justify-center gap-4 p-8">
                  <div className="flex items-center gap-3">
                    {kit.logoUrl && <img src={kit.logoUrl} alt="logo" className="h-9 w-9 border border-line" />}
                    <span className="mono-label !text-acid">{kit.plan.brand}</span>
                  </div>
                  <h3 className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight">{kit.headline}</h3>
                  <p className="text-lg text-ink-dim">{kit.subhead}</p>
                  <p className="text-sm leading-relaxed text-ink-dim/80">{kit.body}</p>
                  <button className="mt-1 w-fit bg-acid px-5 py-2.5 text-sm font-bold text-black">{kit.cta}</button>
                  {kit.plan.palette?.length > 0 && (
                    <div className="mt-1 flex gap-1.5">
                      {kit.plan.palette.map((c) => <span key={c} className="h-5 w-5 border border-line" style={{ background: c }} title={c} />)}
                    </div>
                  )}
                </div>
                {kit.heroUrl && (
                  <div className="relative min-h-60 border-t border-line bg-black/40 md:border-l md:border-t-0">
                    <img src={kit.heroUrl} alt="hero" className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Social + audio */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {kit.social.map((p: SocialPost) => (
                <div key={p.platform} className="card p-4">
                  <div className="mono-label mb-2">{p.platform}</div>
                  <p className="text-sm text-ink">{p.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {kit.audioUrl && <AudioRow label="🎙 Voiceover ad" caption={kit.plan.adScript} src={kit.audioUrl} />}
              {kit.musicUrl && <AudioRow label="🎵 Music bed" caption={kit.plan.musicPrompt} src={kit.musicUrl} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mono-label mt-20 text-center">
        BUILD IT ON GMI · SHIP IT ON AGENTBOX · BETA FUND AI AGENTS HACKATHON
      </footer>
    </main>
  );
}

/* ---------------------------- subcomponents ---------------------------- */

function StatusPill({ mock }: { mock: boolean | null }) {
  if (mock === null) return null;
  return (
    <span className={`mono-label flex items-center gap-1.5 border px-2.5 py-1 ${mock ? "border-coral/40 !text-coral" : "border-acid/40 !text-acid"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${mock ? "bg-coral" : "bg-acid"}`} />
      {mock ? "DEMO MODE" : "LIVE · GMI"}
    </span>
  );
}

function CounterPill({ calls }: { calls: number }) {
  return (
    <span className="mono-label hidden items-center gap-2 border border-line px-2.5 py-1 sm:flex">
      <span className="text-acid">⚡{calls}</span> MODEL CALLS · 1 KEY · 3 TYPES
    </span>
  );
}

function AgentCard({ agent, status, provider, index, preview, media }: {
  agent: { id: AgentId; name: string; role: string; icon: string };
  status: AgentStatus; provider?: Provider; index: number; preview: string | null; media: string | null;
}) {
  const working = status === "working";
  const done = status === "done";
  const err = status === "error";
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className={`card relative overflow-hidden p-4 ${working ? "shimmer" : ""} ${done ? "border-acid/40" : ""} ${err ? "border-coral/50" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center border ${working ? "border-acid/50 text-acid" : done ? "border-acid/30 text-acid" : err ? "border-coral/40 text-coral" : "border-line text-ink-dim"}`}>
          <Icon name={agent.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold">{agent.name}</span>
            <StatusDot status={status} />
          </div>
          <span className="mono-label">{agent.role}</span>
        </div>
      </div>
      <div className="mt-3 min-h-[1.75rem]">
        {media && done ? (
          <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={media} alt={agent.id} className="h-20 w-full border border-line object-cover" />
        ) : preview ? (
          <p className="font-mono line-clamp-2 text-[12px] text-ink-dim">{preview}</p>
        ) : status === "idle" ? (
          <div className="mono-label">queued</div>
        ) : (
          <div className="space-y-1.5"><div className="h-2 w-3/4 bg-line" /><div className="h-2 w-1/2 bg-line" /></div>
        )}
      </div>
      {provider && done && (
        <span className={`mono-label absolute right-3 top-3 ${provider === "GMI" ? "!text-acid" : provider === "Nebius" ? "!text-ink" : "!text-ink-dim"}`}>{provider}</span>
      )}
    </motion.div>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, string> = { idle: "text-ink-dim", working: "text-acid", done: "text-acid", error: "text-coral" };
  const label: Record<AgentStatus, string> = { idle: "queued", working: "working", done: "done", error: "error" };
  return (
    <span className={`mono-label flex items-center gap-1 ${map[status]}`}>
      {status === "working" && <span className="h-1.5 w-1.5 rounded-full bg-acid pulse-acid" />}
      {status === "done" && "✓"} {label[status]}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const good = score >= 85;
  return (
    <motion.span key={score} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className={`mono-label flex items-center gap-1.5 border px-2.5 py-1 ${good ? "border-acid/50 !text-acid" : "border-coral/50 !text-coral"}`}>
      {good ? "✓" : "⟳"} BRAND SCORE {score}/100
    </motion.span>
  );
}

function AudioRow({ label, caption, src }: { label: string; caption: string; src: string }) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="mono-label !text-ink">{label}</div>
      <p className="line-clamp-1 text-xs italic text-ink-dim">“{caption}”</p>
      <audio controls src={src} className="mt-1 h-9 w-full" />
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></>,
    pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="1" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
    hex: <path d="M12 2 21 7v10l-9 5-9-5V7Z" />,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg {...common}>{paths[name] ?? paths.sparkles}</svg>;
}

/* ---------------------------- download kit ---------------------------- */

async function downloadKit(kit: LaunchKit) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const md = `# ${kit.plan.brand} — Launch Kit

## Positioning
${kit.plan.positioning}

## Landing
**${kit.headline}**
${kit.subhead}

${kit.body}

CTA: ${kit.cta}

## Social
${kit.social.map((s) => `### ${s.platform}\n${s.text}`).join("\n\n")}

## Voiceover script
${kit.plan.adScript}

## Palette
${kit.plan.palette.join(", ")}

${kit.critique ? `## Art Director review\nScore ${kit.critique.score}/100 — ${kit.critique.notes}` : ""}
`;
  zip.file(`${slug(kit.plan.brand)}/launch-kit.md`, md);
  await addAsset(zip, `${slug(kit.plan.brand)}/hero`, kit.heroUrl);
  await addAsset(zip, `${slug(kit.plan.brand)}/logo`, kit.logoUrl);
  await addAsset(zip, `${slug(kit.plan.brand)}/voiceover`, kit.audioUrl);
  await addAsset(zip, `${slug(kit.plan.brand)}/music`, kit.musicUrl);
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(kit.plan.brand)}-launch-kit.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

type Zip = InstanceType<typeof import("jszip")>;
async function addAsset(zip: Zip, path: string, url: string | null) {
  if (!url) return;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "bin").split("+")[0];
    zip.file(`${path}.${ext}`, blob);
  } catch { /* skip unfetchable asset */ }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
