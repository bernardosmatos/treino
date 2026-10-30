import { useEffect, useRef, useState } from 'react'
import { Icon, TopBar, confirmDialog, toast } from '../components/ui'
import { fmtDate, fmtTime } from '../lib/format'
import { pop } from '../lib/nav'
import { updateSettings, useSettings } from '../lib/settings'
import { clearLocal, exportBackup, getSyncInfo, importBackup, resyncAll, syncNow, useStoreVersion } from '../lib/store'
import { supabase } from '../lib/supabase'

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="list-item" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="grow"><span style={{ display: 'block' }}>{label}</span>{hint && <span className="small muted">{hint}</span>}</span>
      <span style={{
        width: 46, height: 28, borderRadius: 14, background: on ? 'var(--good)' : 'var(--surface-2)', position: 'relative', flexShrink: 0, transition: 'background .15s',
      }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgb(0 0 0 / .3)' }} />
      </span>
    </button>
  )
}

export function Settings() {
  useStoreVersion()
  const s = useSettings()
  const sync = getSyncInfo()
  const [email, setEmail] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)) }, [])

  const download = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `treino-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const onImport = async (f: File) => {
    try {
      const n = importBackup(JSON.parse(await f.text()))
      toast(`${n} registros importados`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha ao importar')
    }
  }

  const logout = async () => {
    const msg = sync.pending ? `Há ${sync.pending} alteração(ões) ainda não enviadas para a nuvem e elas serão perdidas.` : 'Os dados locais deste aparelho serão apagados (continuam salvos na nuvem).'
    if (!(await confirmDialog('Sair da conta?', { message: msg, ok: 'Sair', danger: true }))) return
    await supabase?.auth.signOut()
    await clearLocal()
  }

  const stateLabel = {
    off: 'Desativada (app compilado sem Supabase)',
    idle: sync.pending ? `${sync.pending} alteração(ões) aguardando envio` : 'Tudo sincronizado',
    syncing: 'Sincronizando…',
    error: `Erro: ${sync.error}`,
    offline: 'Sem internet; envia quando voltar',
  }[sync.state]

  return (
    <div className="screen">
      <TopBar onBack={pop} title="Configurações" center />

      <div className="section-title">Treino</div>
      <div className="card" style={{ padding: '0 12px' }}>
        <Toggle label="Perguntar peso ao iniciar treino" hint="Alimenta o gráfico de peso corporal" on={s.askBodyweight} onChange={v => updateSettings({ askBodyweight: v })} />
        <Toggle label="Manter tela ligada no treino" on={s.keepAwake} onChange={v => updateSettings({ keepAwake: v })} />
      </div>

      <div className="section-title">Nuvem</div>
      <div className="card">
        {email && <div className="small muted" style={{ marginBottom: 4 }}>Conta: {email}</div>}
        <div className="row"><Icon name={sync.state === 'error' || sync.state === 'offline' ? 'cloudOff' : 'cloud'} size={18} /><span className="grow">{stateLabel}</span></div>
        {sync.lastSync && <div className="small muted" style={{ marginTop: 4 }}>Última sincronização: {fmtDate(sync.lastSync)}, {fmtTime(sync.lastSync)}</div>}
        {supabase && (
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn sm" onClick={() => syncNow().then(() => toast('Sincronizado'))}>Sincronizar agora</button>
            <button className="btn sm" onClick={() => resyncAll().then(() => toast('Dados baixados novamente'))}>Baixar tudo de novo</button>
          </div>
        )}
      </div>

      <div className="section-title">Backup</div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>Arquivo com todos os treinos, rotinas, exercícios e medidas.</p>
        <button className="btn block" onClick={download}>Exportar backup (.json)</button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>Importar backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
      </div>

      {supabase && email && <button className="btn danger block" style={{ marginTop: 20 }} onClick={logout}>Sair da conta</button>}
      <p className="small muted center-text" style={{ marginTop: 24 }}>Treino · uso pessoal</p>
    </div>
  )
}
