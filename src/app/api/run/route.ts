import {
  creativeDirector,
  copywriter,
  produceImage,
  produceLogo,
  produceVoice,
  produceMusic,
  artDirector,
  jingleLyrics,
} from "@/lib/agents";
import type { AgentEvent, LaunchKit, Plan } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;
// Stream as the agents work — don't buffer.
export const dynamic = "force-dynamic";

const REVISION_THRESHOLD = Number(process.env.CRITIQUE_THRESHOLD || 85);

/**
 * Orchestrator. Streams newline-delimited AgentEvent JSON (NDJSON):
 *   director → [copy ∥ image ∥ logo ∥ voice ∥ music] → critic → (revise once) → done
 * The frontend reads one JSON object per line.
 */
export async function POST(req: Request) {
  let brief = "";
  try {
    const body = await req.json();
    brief = (body?.brief ?? "").toString();
  } catch {
    /* empty body → handled below */
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      try {
        if (!brief.trim()) throw new Error("Missing brief");

        // ── 1. Creative Director plans the launch ────────────────────────────
        send({ type: "status", agent: "director", status: "working" });
        send({
          type: "log",
          agent: "director",
          message: "Reading the brief and shaping a creative plan…",
        });
        const planned = await creativeDirector(brief);
        const plan: Plan = planned.value;
        send({ type: "asset", key: "plan", value: plan, provider: planned.provider });
        send({
          type: "log",
          agent: "director",
          message: `Brand: "${plan.brand}" — ${plan.positioning}`,
        });
        send({
          type: "status",
          agent: "director",
          status: "done",
          provider: planned.provider,
          note: plan.brand,
        });

        const kit: LaunchKit = {
          plan,
          headline: "",
          subhead: "",
          body: "",
          cta: "",
          social: [],
          heroUrl: null,
          logoUrl: null,
          audioUrl: null,
          musicUrl: null,
          critique: null,
        };

        // ── 2. Specialists work in PARALLEL ──────────────────────────────────
        // Each task emits its own working/log/done + asset events the moment it
        // resolves, so the UI lights up progressively. allSettled => one failure
        // never kills the run.
        send({ type: "status", agent: "copy", status: "working" });
        send({ type: "status", agent: "image", status: "working" });
        send({ type: "status", agent: "logo", status: "working" });
        send({ type: "status", agent: "voice", status: "working" });
        send({ type: "status", agent: "music", status: "working" });
        send({
          type: "log",
          agent: "director",
          message: "Delegating to the specialist agents — copy, hero, logo, voice, music…",
        });

        const copyTask = (async () => {
          try {
            const { value, provider } = await copywriter(plan);
            kit.headline = value.headline;
            kit.subhead = value.subhead;
            kit.body = value.body;
            kit.cta = value.cta;
            kit.social = value.social;
            send({ type: "asset", key: "headline", value: value.headline, provider });
            send({ type: "asset", key: "social", value: value.social, provider });
            send({
              type: "log",
              agent: "copy",
              message: `Wrote the landing copy & 3 social posts — “${value.headline}”`,
            });
            send({ type: "status", agent: "copy", status: "done", provider });
          } catch (err) {
            send({ type: "status", agent: "copy", status: "error", note: errMsg(err) });
            send({ type: "log", agent: "copy", message: `Failed: ${errMsg(err)}` });
          }
        })();

        const imageTask = (async () => {
          try {
            const { value, provider } = await produceImage(plan.imagePrompt, plan.palette);
            kit.heroUrl = value;
            send({ type: "asset", key: "heroUrl", value, provider });
            send({ type: "log", agent: "image", message: "Rendered the hero product image." });
            send({ type: "status", agent: "image", status: "done", provider });
          } catch (err) {
            send({ type: "status", agent: "image", status: "error", note: errMsg(err) });
            send({ type: "log", agent: "image", message: `Failed: ${errMsg(err)}` });
          }
        })();

        const logoTask = (async () => {
          try {
            const { value, provider } = await produceLogo(
              plan.logoPrompt,
              plan.brand,
              plan.palette
            );
            kit.logoUrl = value;
            send({ type: "asset", key: "logoUrl", value, provider });
            send({ type: "log", agent: "logo", message: "Designed the logo mark." });
            send({ type: "status", agent: "logo", status: "done", provider });
          } catch (err) {
            send({ type: "status", agent: "logo", status: "error", note: errMsg(err) });
            send({ type: "log", agent: "logo", message: `Failed: ${errMsg(err)}` });
          }
        })();

        const voiceTask = (async () => {
          try {
            const { value, provider } = await produceVoice(plan.adScript);
            kit.audioUrl = value;
            send({ type: "asset", key: "audioUrl", value, provider });
            send({ type: "log", agent: "voice", message: "Recorded the voiceover ad." });
            send({ type: "status", agent: "voice", status: "done", provider });
          } catch (err) {
            send({ type: "status", agent: "voice", status: "error", note: errMsg(err) });
            send({ type: "log", agent: "voice", message: `Failed: ${errMsg(err)}` });
          }
        })();

        // Live music is correct but slow (~30-110s) and would dominate the run's
        // wall-clock. Default to instant mock; set GMI_LIVE_MUSIC=true to go live.
        const liveMusic = process.env.GMI_LIVE_MUSIC === "true";
        const musicTask = (async () => {
          try {
            const { value, provider } = await produceMusic(
              plan.musicPrompt,
              jingleLyrics(plan),
              { forceMock: !liveMusic }
            );
            kit.musicUrl = value;
            send({ type: "asset", key: "musicUrl", value, provider });
            send({ type: "log", agent: "music", message: "Composed the background jingle." });
            send({ type: "status", agent: "music", status: "done", provider });
          } catch (err) {
            send({ type: "status", agent: "music", status: "error", note: errMsg(err) });
            send({ type: "log", agent: "music", message: `Failed: ${errMsg(err)}` });
          }
        })();

        await Promise.allSettled([copyTask, imageTask, logoTask, voiceTask, musicTask]);

        // ── 3. Art Director critiques the assembled kit ──────────────────────
        send({ type: "status", agent: "critic", status: "working" });
        send({
          type: "log",
          agent: "critic",
          message: "Reviewing the kit for brand consistency…",
        });
        const firstCrit = await artDirector(kit);
        kit.critique = firstCrit.value;
        // Emit the FIRST score as an asset so the UI shows the low score before
        // the revision — the audience sees the jump, not just the final number.
        send({
          type: "asset",
          key: "critique",
          value: kit.critique,
          provider: firstCrit.provider,
        });
        send({
          type: "log",
          agent: "critic",
          message: `Score ${kit.critique.score}/100 — ${kit.critique.notes}`,
        });

        // ── 4. ONE revision round on the weakest asset (the innovation loop) ──
        if (
          kit.critique.score < REVISION_THRESHOLD &&
          kit.critique.revisedAsset
        ) {
          const target = kit.critique.revisedAsset;
          const notes = kit.critique.notes;
          send({
            type: "log",
            agent: "critic",
            message: `Sending the ${target} back for one revision…`,
          });
          const reviseAgent =
            target === "image" ? "image" : target === "logo" ? "logo" : "copy";
          send({ type: "status", agent: reviseAgent, status: "working", note: "revising" });

          try {
            if (target === "copy") {
              const { value, provider } = await copywriter(plan, notes);
              kit.headline = value.headline;
              kit.subhead = value.subhead;
              kit.body = value.body;
              kit.cta = value.cta;
              kit.social = value.social;
              send({ type: "asset", key: "headline", value: value.headline, provider });
              send({ type: "asset", key: "social", value: value.social, provider });
            } else if (target === "image") {
              const { value, provider } = await produceImage(
                `${plan.imagePrompt} — refined, premium. Note: ${notes}`,
                plan.palette
              );
              kit.heroUrl = value;
              send({ type: "asset", key: "heroUrl", value, provider });
            } else if (target === "logo") {
              const { value, provider } = await produceLogo(
                `${plan.logoPrompt} — refined. Note: ${notes}`,
                plan.brand,
                plan.palette
              );
              kit.logoUrl = value;
              send({ type: "asset", key: "logoUrl", value, provider });
            }
            send({
              type: "log",
              agent: reviseAgent,
              message: "Reworked the asset using the critique notes.",
            });
            send({ type: "status", agent: reviseAgent, status: "done", note: "revised ✦" });

            // Re-score so the UI can animate the jump.
            const second = await artDirector(kit, { revised: true });
            kit.critique = second.value;
            send({
              type: "asset",
              key: "critique",
              value: kit.critique,
              provider: second.provider,
            });
            send({
              type: "log",
              agent: "critic",
              message: `Revised score ${kit.critique.score}/100 — ${kit.critique.notes}`,
            });
          } catch (err) {
            send({ type: "log", agent: reviseAgent, message: `Revision failed: ${errMsg(err)}` });
          }
        }

        // critique asset already emitted (first + revised); just close out critic.
        send({
          type: "status",
          agent: "critic",
          status: "done",
          provider: firstCrit.provider,
          note: `score ${kit.critique.score}`,
        });

        // ── 5. Done ──────────────────────────────────────────────────────────
        send({ type: "done", kit });
      } catch (err) {
        send({ type: "error", message: errMsg(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "unknown error";
}
