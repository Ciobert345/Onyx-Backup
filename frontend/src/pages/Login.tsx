import Card from '../components/Card'
import { oauthLogin } from '../api'

export default function Login(){
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Card className="max-w-md w-full text-center">
        <h1 className="text-2xl mb-4">Accedi</h1>
        <p className="text-text-secondary mb-6">Autenticati con Google per continuare</p>
        <button onClick={()=>oauthLogin()} className="w-full py-3 rounded-md border border-border bg-surface-2 hover:shadow-glow">Login con Google</button>
      </Card>
    </div>
  )
}
