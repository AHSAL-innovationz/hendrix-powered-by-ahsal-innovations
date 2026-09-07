import Redis from '../../../packages/redis'
import crypto from 'crypto'
import { RateLimiterRedis } from 'rate-limiter-flexible'

// Rate limiter: 10 requests per minute per user/IP
const rateLimiter = new RateLimiterRedis({
  storeClient: Redis,
  points: 10,
  duration: 60,
  keyPrefix: 'rl_idme_start'
})

export default async function handler(req, res) {
  // Basic auth check placeholder: ensure user is authenticated before starting KYC
  // Integrate with your auth system: replace this with your session check.
  const userId = req.cookies?.hendrix_user_id || null
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: user session required' })
  }

  try {
    await rateLimiter.consume(userId)
  } catch (rejRes) {
    return res.status(429).json({ error: 'Too many requests, please try again later' })
  }

  const clientId = process.env.IDME_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/idme/callback`
  if (!clientId || !process.env.NEXT_PUBLIC_BASE_URL) {
    return res.status(500).json({ error: 'ID.me not configured' })
  }

  const state = crypto.randomBytes(16).toString('hex')
  // Store state -> userId mapping in Redis with TTL (server-side CSRF protection)
  await Redis.setex(`idme:state:${state}`, 600, userId)

  // Set a short-lived state cookie too (defense in depth)
  res.setHeader('Set-Cookie', `idme_oauth_state=${state}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=600`)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid name email dob',
    redirect_uri: redirectUri,
    state
  })
  const authorizeUrl = `https://api.id.me/oauth/authorize?${params.toString()}`
  res.writeHead(302, { Location: authorizeUrl })
  res.end()
}
