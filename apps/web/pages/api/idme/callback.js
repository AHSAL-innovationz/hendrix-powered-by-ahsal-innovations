import Redis from '../../../packages/redis'
import pool from '../../../packages/db'
import fetch from 'node-fetch'

export default async function handler(req, res) {
  // Rate limiting per IP for callback (to mitigate abuse)
  // For simplicity use Redis INCR with expiry
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    const key = `idme:cb:ip:${ip}`
    const count = await Redis.incr(key)
    if (count === 1) {
      await Redis.expire(key, 60) // 1 minute window
    }
    if (count > 30) {
      return res.status(429).send('Too many requests')
    }
  } catch (err) {
    console.warn('Rate limiter failed', err)
  }

  const { code, state } = req.query
  if (!code || !state) {
    return res.status(400).send('Missing code or state')
  }

  // Retrieve userId from Redis mapping
  const userId = await Redis.get(`idme:state:${state}`)
  if (!userId) {
    return res.status(400).send('Invalid or expired state')
  }

  // Exchange code for token
  const tokenUrl = 'https://api.id.me/oauth/token'
  const clientId = process.env.IDME_CLIENT_ID
  const clientSecret = process.env.IDME_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/idme/callback`
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'ID.me not configured' })
  }

  try {
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    })
    const tokenData = await tokenResp.json()
    if (!tokenData.access_token) {
      console.error('Token exchange failed', tokenData)
      return res.status(500).json({ error: 'Failed to get access token' })
    }

    // Fetch user attributes
    const userResp = await fetch('https://api.id.me/api/public/v3/attributes.json', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userData = await userResp.json()

    // Compute age verification (example: >= 18). Adjust per requirements.
    const dob = userData?.attributes?.dob || null
    let ageVerified = false
    if (dob) {
      const birth = new Date(dob)
      const age = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      if (age >= 18) ageVerified = true
    }

    // Persist to DB and grant one-time credits transactionally
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // Upsert idme payload and kyc flag for the user
      await client.query(
        `UPDATE users SET kyc_verified = $1, idme_payload = $2, idme_verified_at = now() WHERE id = $3`,
        [ageVerified, userData, userId]
      )

      // Ensure credits_ledger exists; grant promo if not already granted
      const promoCheck = await client.query('SELECT count(1) AS cnt FROM credits_ledger WHERE user_id = $1 AND reason = $2', [userId, 'kyc_promo'])
      if (ageVerified && promoCheck.rows[0].cnt == 0) {
        // Fetch current balance
        const balRes = await client.query('SELECT credits FROM users WHERE id = $1', [userId])
        const current = balRes.rows[0]?.credits || 0
        const newBal = current + 1000
        await client.query('INSERT INTO credits_ledger(id, user_id, delta, reason, balance_after) VALUES (gen_random_uuid(), $1, $2, $3, $4)', [userId, 1000, 'kyc_promo', newBal])
        await client.query('UPDATE users SET credits = $1 WHERE id = $2', [newBal, userId])
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('DB transaction failed', err)
      return res.status(500).json({ error: 'DB update failed' })
    } finally {
      client.release()
    }

    // Cleanup state
    await Redis.del(`idme:state:${state}`)

    // Clear state cookie
    res.setHeader('Set-Cookie', 'idme_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0')

    return res.status(200).json({ message: 'KYC completed', ageVerified, idme_profile: userData })
  } catch (err) {
    console.error('ID.me callback error', err)
    return res.status(500).json({ error: 'ID.me callback failed' })
  }
}
