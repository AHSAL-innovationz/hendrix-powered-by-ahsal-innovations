# RBAC & Admin notes

This repo includes an admin UI and API for viewing and decrypting ID.me KYC payloads. The current implementation includes placeholders for RBAC checks. Before using in production, ensure the following:

- Use Cognito groups or your auth provider's group/role claims to gate admin endpoints.
- Do NOT rely on userId presence alone; verify 'admin' group membership in the JWT claims.
- Audit all decrypt actions: log who performed the decryption, when, and why. Store audit logs in a tamper-resistant store (CloudWatch Logs + S3).
- Limit the ability to decrypt to a small set of admin users.
