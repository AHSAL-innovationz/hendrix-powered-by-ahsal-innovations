# ARCHITECTURE: Hendrix — Powered by AHSAL innovations

Summary
- Product: Hendrix — persona-driven AI expert with advanced self-hosted intelligence, voice, avatar marketplace, blueprints export, and credits/billing. Web-first with Expo-managed mobile.
- Constraints: Apache-2.0 license, no sexual visual content, age-gated (ID.me), profanity editable, Stripe payments + Stripe Connect, public repo (read-only).

High-level architecture
- Clients:
  - Web: Next.js (marketing, web chat, admin dashboard)
  - Mobile: Expo-managed React Native (tabbed UI)
- API & Orchestration (Next.js API routes + ECS Fargate for background jobs):
  - Auth: AWS Cognito
  - LLM Orchestrator: self-hosted model servers (GPU-backed containers)
  - Voice: STT/TTS server-side orchestration
  - Payments: Stripe + Stripe Connect webhooks
  - KYC/Age gate: ID.me integration flow
- Data:
  - Postgres (Amazon RDS / Aurora)
  - Redis (Elasticache)
  - Vector DB (Milvus/Weaviate self-hosted)
  - S3 for assets/exports
  - Secrets: AWS Secrets Manager

Monorepo structure (scaffolded)
- apps/web — Next.js app (marketing + web chat + admin + API routes)
- apps/mobile — Expo React Native app (tabbed UI: Chat, Blueprints, Voice, Marketplace, Account)
- packages/ui — shared UI components / design tokens
- packages/sdk — client SDK for API calls
- infra/terraform — Terraform modules & placeholders for AWS us-west-1
- .github/workflows — CI placeholders

Security & compliance
- Do NOT commit API keys, model weights, or credentials.
- Use AWS Secrets Manager and GitHub Actions secrets for CI/CD.
- Age-gated features require ID.me verification before unlocking adult persona voice or age-limited marketplace entries.
- Profanity toggle: user-editable per-account setting. Hendrix persona configurable server-side.
- No sexual visual content. Textual adult content is gated and subject to moderation.

Persona & features (engineered)
- Hendrix persona: human-like avatar, sneaker enthusiast (Jordans, Nikes), dressing marketplace (paid skins), witty old-saying charm (but not full old-personality). Tone and profanity editable.
- Voice profiles: selectable voices. "Deepening" voice effect as user upgrades (controlled, safe ranges). All TTS done server-side.
- First 1,000 credits promo: per-user one-time credit grant at signup once KYC approved.

Billing & credits
- Stripe for subscriptions, one-time purchases, and Stripe Connect for marketplace payouts.
- Credit ledger stored in Postgres; server enforces credit cost per action.

Dev & deployment notes
- Local dev: use pnpm workspace, turborepo (optional) for task orchestration.
- CI: GitHub Actions for lint/test/build. Deployments orchestrated via Terraform and ECS Fargate.
- LLM hosting: GPU-backed EC2 instances or managed containers — ensure model licensing compliance.

Roadmap (MVP -> Full)
- MVP: Chat persona, voice input/output, basic blueprints export, Stripe billing, ID.me gating, basic avatar marketplace.
- Full: Avatar VR/Video chat, full marketplace with Stripe Connect payouts, advanced self-hosted LLM fine-tuning pipelines, admin moderation tools.

Operational hygiene
- Monitoring: CloudWatch + Sentry for errors
- Logs: stored in private S3/CloudWatch only
- Backups & DR: automated RDS snapshots, S3 lifecycle rules

For detailed OpenAPI endpoints, infra templates, and setup steps see OPENAPI.yaml and infra/terraform/README.md

Footer: "Hendrix — Powered by AHSAL innovations"
