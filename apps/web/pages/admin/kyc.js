import useSWR from 'swr'
import { useState } from 'react'

const fetcher = (url) => fetch(url, {credentials:'include'}).then(r=>r.json())

export default function KYCAdmin(){
  const { data, error } = useSWR('/api/admin/kyc', fetcher)
  const [selected, setSelected] = useState(null)

  if (error) return <div>Error loading</div>
  if (!data) return <div>Loading...</div>

  return (
    <div style={{padding:20}}>
      <h2>KYC Admin</h2>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr><th>User ID</th><th>KYC Verified</th><th>Verified At</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {data.rows.map(r=> (
            <tr key={r.user_id} style={{borderTop:'1px solid #eee'}}>
              <td>{r.user_id}</td>
              <td>{r.kyc_verified ? 'yes' : 'no'}</td>
              <td>{r.idme_verified_at}</td>
              <td>
                <button onClick={() => setSelected(r.user_id)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div style={{marginTop:20}}>
          <h3>Decrypt payload for {selected}</h3>
          <button onClick={async()=>{
            const resp = await fetch('/api/admin/decrypt?userId='+selected, {credentials:'include'})
            const json = await resp.json()
            alert(JSON.stringify(json, null, 2))
          }}>Decrypt (admin only)</button>
        </div>
      )}
    </div>
  )
}
