import { useMemo, useState } from 'react'
import { EQUIPMENT_LABEL, KIND_LABEL, MUSCLE_LABEL } from '../data/exercises'
import { allExercises, finishedWorkouts } from '../lib/stats'
import { put, uid, useStoreVersion } from '../lib/store'
import type { Equipment, Exercise, ExerciseKind, Muscle } from '../types'
import { Icon, Sheet, TopBar, toast } from './ui'

const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[]

export function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function initials(name: string) {
  return name.split(/\s+/).filter(w => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || name[0]
}

export function ExerciseList({ query, muscle, onTap, selected }: {
  query: string
  muscle: Muscle | null
  onTap: (e: Exercise) => void
  selected?: Set<string>
}) {
  useStoreVersion()
  const all = allExercises()
  const recent = useMemo(() => {
    const ids: string[] = []
    for (const w of finishedWorkouts()) {
      for (const e of w.exercises) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId)
      if (ids.length >= 8) break
    }
    return ids.slice(0, 8)
  }, [all])
  const q = normalize(query.trim())
  const filtered = all.filter(e =>
    (!muscle || e.primary === muscle || e.secondary.includes(muscle)) &&
    (!q || q.split(/\s+/).every(part => normalize(e.name).includes(part))))
  const showRecent = !q && !muscle && recent.length > 0
  const byId = new Map(all.map(e => [e.id, e]))

  const row = (e: Exercise) => (
    <button key={e.id} className="list-item" onClick={() => onTap(e)}>
      <span className="avatar">{initials(e.name)}</span>
      <span className="grow">
        <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>{e.name}</span>
        <span className="small muted">{MUSCLE_LABEL[e.primary]} · {EQUIPMENT_LABEL[e.equipment]}{e.custom ? ' · personalizado' : ''}</span>
      </span>
      {selected && <span className={`check ${selected.has(e.id) ? 'on' : ''}`}>{selected.has(e.id) && <Icon name="check" size={16} stroke={3} />}</span>}
    </button>
  )

  return (
    <>
      {showRecent && (
        <>
          <div className="section-title">Recentes</div>
          <div className="card" style={{ padding: '0 12px' }}>{recent.map(id => byId.get(id)).filter(Boolean).map(e => row(e!))}</div>
        </>
      )}
      <div className="section-title">{muscle ? MUSCLE_LABEL[muscle] : 'Todos'} <span>{filtered.length}</span></div>
      <div className="card" style={{ padding: '0 12px' }}>
        {filtered.length ? filtered.map(row) : <div className="empty small">Nenhum exercício encontrado.</div>}
      </div>
    </>
  )
}

export function SearchAndFilter({ query, setQuery, muscle, setMuscle }: {
  query: string; setQuery: (s: string) => void; muscle: Muscle | null; setMuscle: (m: Muscle | null) => void
}) {
  return (
    <>
      <div className="row" style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 12, color: 'var(--muted)', display: 'flex' }}><Icon name="search" size={18} /></span>
        <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar exercício" value={query}
          onChange={e => setQuery(e.target.value)} type="search" />
      </div>
      <div className="chips all">
        <button className={`chip ${!muscle ? 'on' : ''}`} onClick={() => setMuscle(null)}>Todos</button>
        {MUSCLES.map(m => (
          <button key={m} className={`chip ${muscle === m ? 'on' : ''}`} onClick={() => setMuscle(muscle === m ? null : m)}>{MUSCLE_LABEL[m]}</button>
        ))}
      </div>
    </>
  )
}

/** Tela cheia para escolher um ou vários exercícios. */
export function ExercisePicker({ open, onClose, onPick, multi = true, title = 'Adicionar exercícios' }: {
  open: boolean
  onClose: () => void
  onPick: (ids: string[]) => void
  multi?: boolean
  title?: string
}) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  if (!open) return null

  const done = (ids: string[]) => { onPick(ids); setSel([]); setQuery(''); setMuscle(null); onClose() }
  const tap = (e: Exercise) => {
    if (!multi) return done([e.id])
    setSel(s => (s.includes(e.id) ? s.filter(x => x !== e.id) : [...s, e.id]))
  }

  return (
    <div className="overlay" style={{ zIndex: 45 }}>
      <div className="screen">
        <TopBar title={title} center onBack={() => { setSel([]); onClose() }}
          right={<button className="btn ghost" onClick={() => setCreating(true)}>Criar</button>} />
        <SearchAndFilter query={query} setQuery={setQuery} muscle={muscle} setMuscle={setMuscle} />
        <ExerciseList query={query} muscle={muscle} onTap={tap} selected={multi ? new Set(sel) : undefined} />
      </div>
      {multi && sel.length > 0 && (
        <div className="bottom-bar">
          <button className="btn primary block" onClick={() => done(sel)}>
            Adicionar {sel.length} {sel.length === 1 ? 'exercício' : 'exercícios'}
          </button>
        </div>
      )}
      <ExerciseForm open={creating} onClose={() => setCreating(false)} initialName={query}
        onSaved={e => { setCreating(false); if (multi) setSel(s => [...s, e.id]); else done([e.id]) }} />
    </div>
  )
}

/** Criar/editar exercício personalizado. */
export function ExerciseForm({ open, onClose, onSaved, initial, initialName = '' }: {
  open: boolean
  onClose: () => void
  onSaved?: (e: Exercise) => void
  initial?: Exercise
  initialName?: string
}) {
  return (
    <Sheet open={open} onClose={onClose} title={initial ? 'Editar exercício' : 'Novo exercício'}>
      {open && <ExerciseFormBody initial={initial} initialName={initialName} onSaved={e => onSaved?.(e)} />}
    </Sheet>
  )
}

function ExerciseFormBody({ initial, initialName, onSaved }: { initial?: Exercise; initialName: string; onSaved: (e: Exercise) => void }) {
  const [name, setName] = useState(initial?.name ?? initialName)
  const [primary, setPrimary] = useState<Muscle>(initial?.primary ?? 'peito')
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondary ?? [])
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'barra')
  const [kind, setKind] = useState<ExerciseKind>(initial?.kind ?? 'peso_reps')

  const save = () => {
    if (!name.trim()) { toast('Dê um nome ao exercício'); return }
    const e: Exercise = {
      id: initial?.id ?? uid(), name: name.trim(), primary,
      secondary: secondary.filter(m => m !== primary), equipment, kind, custom: true,
    }
    put('exercises', e)
    onSaved(e)
  }

  return (
    <>
      <label className="field"><span>Nome</span>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Supino com pausa" />
      </label>
      <label className="field"><span>Tipo de registro</span>
        <select className="input" value={kind} onChange={e => setKind(e.target.value as ExerciseKind)}>
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="field"><span>Músculo principal</span>
        <select className="input" value={primary} onChange={e => setPrimary(e.target.value as Muscle)}>
          {MUSCLES.map(m => <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>)}
        </select>
      </label>
      <div className="field"><span>Músculos secundários</span>
        <div className="row wrap" style={{ gap: 6 }}>
          {MUSCLES.filter(m => m !== primary).map(m => (
            <button key={m} className={`chip ${secondary.includes(m) ? 'on' : ''}`}
              onClick={() => setSecondary(s => (s.includes(m) ? s.filter(x => x !== m) : [...s, m]))}>{MUSCLE_LABEL[m]}</button>
          ))}
        </div>
      </div>
      <label className="field"><span>Equipamento</span>
        <select className="input" value={equipment} onChange={e => setEquipment(e.target.value as Equipment)}>
          {Object.entries(EQUIPMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <button className="btn primary block" onClick={save}>Salvar</button>
    </>
  )
}
