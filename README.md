# Neuma monorepo

Aplicação Next.js (`apps/web`) + Agent LangGraph/FastAPI (`apps/agent`).

**Deploy Vercel:** Root Directory do projeto deve ser `apps/web` (ou, em fallback, a pasta `public/` na raiz espelha `apps/web/public` para logos/ícones). O modelo experimental `services` foi desativado temporariamente porque partia assets estáticos e login.

## Desenvolvimento

```bash
# Web (porta 3001)
npm run dev

# Agent (porta 8765) — num segundo terminal
cd apps/agent && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # preencher keys
uvicorn main:app --host 127.0.0.1 --port 8765 --reload
```

Ou `vercel dev -L` na raiz para os dois serviços com binding.

## Scripts úteis

```bash
node apps/web/scripts/wipe-library.mjs            # dry-run
node apps/web/scripts/wipe-library.mjs --confirm  # limpa biblioteca
node apps/web/scripts/seed-marcio-eduardo.mjs     # briefs + propostas Percurso Márcio/Eduardo
```

## Env

Ver `apps/web/.env.example` e `apps/agent/.env.example`.

### Tally webhook (onboarding / check-in)

Endpoint: `POST /api/tally/webhook`

- Produção: `https://neuma-app-topaz.vercel.app/api/tally/webhook` (ou o domínio custom)
- Localhost **não** recebe webhooks do Tally — usa um tunnel (ngrok/cloudflared) ou aponta o webhook para produção
- Configura em Tally → form `44RJrA` (onboarding) → Integrations → Webhooks
- Signing secret (opcional): `TALLY_WEBHOOK_SECRET` / `TALLY_ONBOARDING_WEBHOOK_SECRET` / `TALLY_CHECKIN_WEBHOOK_SECRET`
