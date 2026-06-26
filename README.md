# 🚀 Launch Studio

An AI agent you can **hire to launch a product**. Give it one sentence; a team of
specialist agents (Creative Director → Copywriter, Designer, Voice, Composer → Art
Director critic) autonomously produces a complete, on-brand launch kit and
self-corrects the weakest asset before handing it back. Built on **GMI Cloud** — one
key drives LLM, image, TTS, and music.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (MOCK mode with no key)
```

Leave `GMI_API_KEY` blank in `.env.local` to run fully in **mock mode** (zero keys,
high-quality canned assets) — this is also the guaranteed demo fallback. Paste a real
key to go live. Optional `NEBIUS_API_KEY` adds a text-only LLM fallback.

## API (the §5 contract)

| Route | Body | Returns |
|---|---|---|
| `POST /api/run` | `{ brief }` | **SSE** stream of `AgentEvent`s: plan → parallel assets → critique → revise → `done` |
| `POST /api/plan` | `{ brief }` | `{ plan, provider }` |
| `POST /api/copy` | `{ plan, note? }` | `{ copy, provider }` |
| `POST /api/image` | `{ prompt, palette? }` | `{ heroUrl, provider }` |
| `POST /api/logo` | `{ prompt, brand?, palette? }` | `{ logoUrl, provider }` |
| `POST /api/voice` | `{ script }` | `{ audioUrl, provider }` |
| `POST /api/music` | `{ prompt }` | `{ musicUrl, provider }` |
| `POST /api/critique` | `{ kit }` | `{ critique, provider }` |
| `GET /api/status` | — | `{ mock, gmiCalls, providers: { gmi, nebius } }` |

Every endpoint works in mock mode and reports `provider` (`"GMI" | "Nebius" | "mock"`).
Shared types live in [`src/lib/types.ts`](src/lib/types.ts).

## Architecture

- `src/lib/gmi.ts` — GMI client (LLM / image / TTS / music) + mock asset helpers + JSON extraction.
- `src/lib/nebius.ts` — OpenAI-compatible LLM fallback (text only).
- `src/lib/agents.ts` — Creative Director, Copywriter, Art Director critic + asset producers.
- `src/app/api/**` — route handlers; `/api/run` is the streaming orchestrator.

## Deploy (AgentBox)

```bash
npm run build                      # Next standalone output
docker build -t launch-studio .
docker run -p 3000:3000 -e GMI_API_KEY=... launch-studio
```

The `Dockerfile` produces a self-contained server (`output: "standalone"`). Set
`GMI_API_KEY` (and optional `NEBIUS_API_KEY`) as env in the AgentBox deploy wizard.
