# ID.me: security & deployment notes

This update implements server-side state storage for the ID.me OAuth flow, Redis-backed rate limiting, secure cookie attributes, and transactional credit granting on successful KYC.

Required environment variables (staging)
- IDME_CLIENT_ID
- IDME_CLIENT_SECRET
- NEXT_PUBLIC_BASE_URL
- DATABASE_URL
- REDIS_URL
- Note: Do NOT store secrets in the repo. Use GitHub Secrets or AWS Secrets Manager.

Security measures implemented
- OAuth state stored server-side in Redis (key: idme:state:<state>) with TTL (600s) to prevent CSRF.
- Short-lived HttpOnly Secure SameSite=Strict cookie for state as defense-in-depth.
- Rate limiting:
  - /api/idme/start: per-user Redis-backed limiter (10 requests/min by user)
  - /api/idme/callback: simple IP-based limiter (30 requests/min)
- DB persistence: ID.me payload stored in users.idme_payload (jsonb) and kyc_verified flag updated.
- One-time +1000 credits granted transactionally when kyc_verified transitions to true (checks credits_ledger for existing 'kyc_promo').

Further recommendations
- Use secure session/auth mechanism (Cognito or NextAuth) to reliably identify userId server-side. Currently the handler expects a cookie 'hendrix_user_id' as a placeholder — replace with your auth system.
- Encrypt idme_payload in DB at application layer if you store sensitive PII.
- Redact sensitive fields from logs and only store what is necessary for compliance.
- Use remote Terraform state (s3 + DynamoDB locks) and protected GitHub environment for infra deployments.
