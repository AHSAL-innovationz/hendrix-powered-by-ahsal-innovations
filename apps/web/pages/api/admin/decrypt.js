import pool from '../../../packages/db'
import { getUserIdFromRequest } from '../../../packages/auth/cognito'
import { decryptString } from '../../../packages/kms'
import Redis from '../../../packages/redis'
import { RateLimiterRedis } from 'rate-limiter-flexible'
import crypto from 'crypto'

// Rate limiters
const adminRateLimiter = new RateLimiterRedis({
  storeClient: Redis,
  keyPrefix: 'rl_admin_decrypt',
  points: 60, // 60 requests
  duration: 60 * 60 // per hour
})
const ipRateLimiter = new RateLimiterRedis({
  storeClient: Redis,
  keyPrefix: 'rl_admin_decrypt_ip',
  points: 100, // 100 requests
  duration: 24 * 60 * 60 // per day
})

async function isAdmin(req, userId) {
  // Primary: check a header injected by upstream auth proxy (e.g. Cognito groups)
  // e.g. set X-User-Groups: "admin,ops"
  const groupsHeader = req.headers['x-user-groups'] || req.headers['x-user-group']
  const adminGroup = process.env.ADMIN_GROUP || 'admin'
  if (groupsHeader && typeof groupsHeader === 'string') {
    const groups = groupsHeader.split(',').map(s => s.trim())
    if (groups.includes(adminGroup)) return true
  }

  // Fallback: allow a configured list of admin user IDs via ADMIN_IDS env var
  if (process.env.ADMIN_IDS) {
    const ids = process.env.ADMIN_IDS.split(',').map(s => s.trim())
    if (ids.includes(userId)) return true
  }

  // If you have a richer auth helper that returns claims, prefer using that.
  return false
}

function redactPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const copy = JSON.parse(JSON.stringify(payload))
  const sensitiveKeys = ['ssn', 'ssn_last4', 'drivers_license_number', 'passport_number', 'dob', 'date_of_birth', 'address', 'phone']
  function deepRedact(obj) {
    if (!obj || typeof obj !== 'object') return
    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase()
      if (sensitiveKeys.includes(lk) || sensitiveKeys.some(sk => lk.includes(sk))) {
        obj[k] = '[REDACTED]'
      } else if (typeof obj[k] === 'object') {
        deepRedact(obj[k])
      }
    }
  }
  deepRedact(copy)
  return copy
}

export default async function handler(req, res){
  // Authenticate caller
  const callerUserId = await getUserIdFromRequest(req)
  if (!callerUserId) return res.status(401).json({ error: 'unauthenticated' })

  // Authorization: verify admin
  try {
    const ok = await isAdmin(req, callerUserId)
    if (!ok) return res.status(403).json({ error: 'forbidden' })
  } catch (err) {
    console.error('Admin check failed', err)
    return res.status(500).json({ error: 'authorization check failed' })
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
  try {
    await adminRateLimiter.consume(callerUserId)
    await ipRateLimiter.consume(ip)
  } catch (rlRejected) {
    return res.status(429).json({ error: 'rate_limited' })
  }

  // Require target userId and a reason for decrypt
  const target = req.query.userId || (req.body && req.body.userId)
  const reason = (req.body && req.body.reason) || req.query.reason
  if (!target) return res.status(400).json({ error: 'userId required' })
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) return res.status(400).json({ error: 'reason required (min 5 chars)' })

  // Fetch encrypted payload
  try {
    const q = await pool.query('SELECT idme_payload FROM users WHERE id = $1', [target])
    if (q.rows.length === 0) return res.status(404).json({ error: 'not found' })
    const encrypted = q.rows[0].idme_payload
    if (!encrypted) return res.status(404).json({ error: 'no payload' })

    // Decrypt
    let decryptedRaw
    try {
      decryptedRaw = await decryptString(encrypted)
    } catch (err) {
      console.error('Decryption failed', err)
      // Audit failure below, then return
      const auditId = crypto.randomUUID()
      try {
        await pool.query(
          `INSERT INTO admin_audit(id, actor_id, target_user_id, action, reason, outcome, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())`,
          [auditId, callerUserId, target, 'decrypt', reason, 'failure']
        )
      } catch (e) {
        // best-effort: continue
        console.warn('Failed recording audit', e)
      }
      return res.status(500).json({ error: 'decryption_failed', auditId })
    }

    let payload
    try {
      payload = JSON.parse(decryptedRaw)
    } catch (err) {
      // If payload is not JSON, return the raw string but still audit
      payload = { raw: decryptedRaw }
    }

    // Redact sensitive fields before returning to client
    const redacted = redactPayload(payload)

    // Record audit (best-effort). Prefer an immutable/auditable store in production.
    const auditId = crypto.randomUUID()
    try {
      await pool.query(
        `INSERT INTO admin_audit(id, actor_id, target_user_id, action, reason, outcome, created_at) VALUES ($1,$2,$3,$4,$5,$6,now())`,
        [auditId, callerUserId, target, 'decrypt', reason, 'success']
      )
    } catch (e) {
      // do not block the response for audit failures, but log them
      console.warn('Failed recording audit', e)
    }

    // Return minimal response: auditId + redacted payload
    return res.status(200).json({ auditId, payload: redacted })
  } catch (err) {
    console.error('admin/decrypt error', err)
    return res.status(500).json({ error: 'internal_error' })
  }
}
