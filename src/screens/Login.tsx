import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setMsg(null)
    const res = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (res.error) {
      setMsg(res.error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : res.error.message)
    } else if (mode === 'up' && !res.data.session) {
      setMsg('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre aqui.')
      setMode('in')
    }
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
      <img src="icon.svg" alt="" width={72} height={72} style={{ borderRadius: 18, margin: '0 auto 12px' }} />
      <div className="large-title center-text">Treino</div>
      <form className="card" onSubmit={submit}>
        <label className="field"><span>E-mail</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field"><span>Senha</span>
          <input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6}
            value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {msg && <p className="small" style={{ color: 'var(--text-2)' }}>{msg}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}</button>
      </form>
      <button className="btn ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
        {mode === 'in' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta'}
      </button>
    </div>
  )
}
