import pool from '../../../packages/db'
import { getUserIdFromRequest } from '../../../packages/auth/cognito'
import { decryptString } from '../../../packages/kms'

export default async function handler(req, res){
  const userId = await getUserIdFromRequest(req)
  if (!userId) return res.status(401).json({error:'unauthenticated'})

  // ADMIN CHECK: replace with robust group/role validation
  // Example: verify JWT contains cognito groups and includes 'admin'

  const target = req.query.userId
  if (!target) return res.status(400).json({ error: 'userId required' })

  try{
    const q = await pool.query('SELECT idme_payload FROM users WHERE id = $1', [target])
    if (q.rows.length === 0) return res.status(404).json({ error: 'not found' })
    const encrypted = q.rows[0].idme_payload
    if (!encrypted) return res.status(404).json({ error: 'no payload' })
    const decrypted = await decryptString(encrypted)
    return res.status(200).json({ payload: JSON.parse(decrypted) })
  }catch(err){
    console.error(err)
    return res.status(500).json({ error: 'decryption failed' })
  }
}
