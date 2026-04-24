# SECRETS — PANTHÉON

Required GitHub Actions repository secrets. Deploy workflow (`/.github/workflows/deploy.yml`) will fail silently (or verbosely) until these are provisioned. No secrets are embedded anywhere in source; this document lists what the user must add.

## Required for deploy

| Secret | Purpose | How to obtain |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Auth for Cloudflare Pages deploy | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template (or minimal Pages-only scope) |
| `CLOUDFLARE_ACCOUNT_ID` | Target account | Cloudflare dashboard → right sidebar on any zone page |

## Optional runtime observability

| Secret | Purpose |
|---|---|
| `VITE_SENTRY_DSN` | Sentry browser SDK DSN. If unset, Sentry is disabled at runtime (no requests issued). |
| `VITE_PLAUSIBLE_DOMAIN` | Plausible analytics domain. If unset, Plausible is disabled. |

## Optional for CI source maps

| Secret | Purpose |
|---|---|
| `SENTRY_AUTH_TOKEN` | Uploads source maps to Sentry at build time |
| `SENTRY_ORG` | Sentry org slug |
| `SENTRY_PROJECT` | Sentry project slug |

## How to add secrets

1. GitHub repo → Settings → Secrets and variables → Actions → New repository secret
2. Add each key above with its value
3. Re-run the failed deploy workflow from the Actions tab (or push any commit to `main`)

## Local development

For `npm run dev` and `npm run build` locally, none of these secrets are required. Observability just stays off. Copy `.env.example` to `.env.local` and fill values if you want to test Sentry/Plausible locally.

## Hard-stop note

The autonomous build will complete all other Phase 1–4 work, but **will not attempt to deploy** until at least `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are provisioned. Orchestrator flags this as a HARD STOP per the autonomous-mode rules.
