import Card from '../components/Card'
import { api, oauthLogin } from '../api'

export default function Settings(){
  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="mb-4">Account Google</h2>
        <button onClick={()=>oauthLogin()} className="px-4 py-2 rounded border border-border bg-surface-2">Collega / Ricollega</button>
      </Card>
      <Card>
        <h2 className="mb-4">Opzioni avanzate</h2>
        <div className="text-sm text-text-secondary">Configurazioni aggiuntive (watch mode, quiet time) da implementare.</div>
      </Card>
    </div>
  )
}
