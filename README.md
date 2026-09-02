# A Million Ways to Die in Medieval — online edition

A social-deduction card game where every player secretly runs a medieval trade, earns gold for that trade on a public board, and quietly arranges accidents for the neighbors. This repository holds the rulebook, the product/tech docs, the card art pipeline, and the multiplayer web app (InsForge backend).

- **Live app:** https://nmah6d87.insforge.site
- **Rules:** `rules/RULES.md` (also served in-app at `/rules`)
- **Docs:** `docs/PRD.md`, `docs/TECH_SPEC.md`

## Layout

```
web/            Vite + React + Tailwind SPA; web/src/engine is the pure rules engine
functions/      InsForge edge function `game` (server-authoritative), bundled by esbuild
migrations/     InsForge SQL migrations (tables, realtime channels, RLS)
tests/          engine simulation test (node tests/sim.test.ts)
art/            Ludo.ai generator scripts + card originals; web/public/cards has the downscaled set
rules/, docs/   rulebook, PRD, tech spec
```

## Develop

```bash
npm install && (cd web && npm install)
npm run test:engine                     # 60 random games, invariants, determinism
cd web && npm run dev                   # http://localhost:5173  (/dev = local harness, no account needed)
```

The web app needs `web/.env` with `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY` (see `web/.env.example`; get the anon key with `npx -y @insforge/cli secrets get ANON_KEY`).

## Deploy

```bash
npx -y @insforge/cli db migrations up --all        # schema
npm run deploy:function                             # bundle + deploy the `game` edge function
cd web && npm run build && npx -y @insforge/cli deployments deploy .   # frontend
```

Deployment env vars are stored with `npx -y @insforge/cli deployments env set …`.
