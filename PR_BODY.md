PR title: infra(staging) + secure ID.me KYC: staging TF, PKCE, KMS, RBAC

---
Summary:
- Adds staging Terraform scaffold (us-west-1) and secure ID.me OAuth KYC flow (PKCE, server state in Redis, secure cookies).
- Adds KMS encryption for ID.me payloads and transactional one-time credits.
- Adds DB migration for KYC fields + credits_ledger.
- Adds admin UI + decrypt API (RBAC enforced via Cognito group "admin" by default).
- Adds CI security-scan (Semgrep + dependency audit) and Dependabot; adds remote state backend placeholder.

Security controls implemented:
- PKCE + single-use server-side state with TTL
- HttpOnly; Secure; SameSite=Strict cookies
- Rate limiting (Redis + simple IP limiter)
- KMS encryption for stored PII
- Transactional DB updates and one-time promo safeguard
- Admin decrypt audited and gated by admin group

Optional features I want to add (screenshot below):

![Optional features screenshot](https://github.com/user-attachments/assets/981183e3-bbad-4da2-b04b-54d1826736b6)

Required secrets (DO NOT COMMIT; add to GitHub environment named “staging”):
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- KMS_KEY_ID
- IDME_CLIENT_ID, IDME_CLIENT_SECRET
- NEXT_PUBLIC_BASE_URL (staging URL) — register redirect: <BASE_URL>/api/idme/callback
- DATABASE_URL (or let TF provision RDS and supply db_password)
- REDIS_URL
- COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID
- NEXTAUTH_SECRET or JWT secret
- STRIPE keys (optional for later)

Merge criteria:
- At least one security review
- CI: security-scan and dependency-scan pass
- Secrets added to GitHub “staging” environment and remote Terraform state configured
- Admin RBAC requirements confirmed and configured

Testing checklist (post-merge):
- Add secrets and remote state
- Run Terraform apply in protected environment (manual dispatch)
- Run DB migrations
- Deploy Next.js staging and validate ID.me end-to-end (sandbox)
- Verify KMS-encrypted payload stored; admin decrypt logs correctly
- Verify one-time +1000 credits granted once

Notes:
- ADMIN_GROUP_NAME env var supported (defaults to "admin") — ensure Cognito group "admin" is configured and admin users are members before using admin decrypt UI.
- infra/terraform/staging/backend.tf contains placeholders — update it with your S3 bucket and DynamoDB lock table names before running terraform init/apply.
