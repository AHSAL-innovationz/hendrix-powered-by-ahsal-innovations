import pool from '../../../packages/db'
import { getUserIdFromRequest } from '../../../packages/auth/cognito'

export default async function handler(req, res){
  const userId = await getUserIdFromRequest(req)
  if (!userId) return res.status(401).json({error:'unauthenticated'})

  // Check admin group/claim - placeholder: check Cognito groups via token claims in getUserIdFromRequest
  // Implement your RBAC: e.g., check "cognito:groups" claim contains "admin"

  // For now, allow if userId present (replace with real admin check)
  try{
    const q = await pool.query('SELECT id as user_id, kyc_verified, idme_verified_at FROM users ORDER BY idme_verified_at DESC LIMIT 100')
    return res.status(200).json({ rows: q.rows })
  }catch(err){
    console.error(err)
    return res.status(500).json({ error: 'db error' })
  }
}
