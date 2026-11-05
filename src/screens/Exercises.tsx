import { useMemo, useState } from 'react'
import { LineChart } from '../components/Charts'
import { ExerciseForm, ExerciseList, SearchAndFilter } from '../components/ExercisePicker'
import { Icon, TopBar, actionSheet, confirmDialog } from '../components/ui'
import { EQUIPMENT_LABEL, KIND_LABEL, MUSCLE_LABEL } from '../data/exercises'
import { fmtDate, fmtKg } from '../lib/format'
import { pop, push } from '../lib/nav'
import {
  EMPTY_METRICS, METRIC_LABEL, getExercise, isValidSet, mergeMetrics, metricsForKind, repRecords, sessionMetrics, sessionsFor, type Metrics,
} from '../lib/stats'
import { remove, useStoreVersion } from '../lib/store'
import type { ExerciseKind, Muscle, WorkoutExercise } from '../types'
import { fmtMetric, setText } from './WorkoutDetail'

export function Exercises() {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [creating, setCreating] = useState(false)
  return (
    <div className="screen">
      <div className="topbar">
        <h1 style={{ fontSize: 30, fontWeight: 800 }}>Exercícios</h1>
        <button className="btn ghost" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> Criar</button>
      </div>
      <SearchAndFilter query={query} setQuery={setQuery} muscle={muscle} setMuscle={setMuscle} />
      <ExerciseList query={query} muscle={muscle} onTap={e => push({ name: 'exercise', id: e.id })} />
      <ExerciseForm open={creating} onClose={() => setCreating(false)} initialName={query}
        onSaved={e => { setCreating(false); push({ name: 'exercise', id: e.id }) }} />
    </div>
  )
}

type DetailTab = 'summary' | 'history' | 'records'
const TAB_LABEL: Record<DetailTab, string> = { summary: 'Resumo', history: 'Histórico', records: 'Recordes' }

/**
 * embedded: aberto por cima de um treino/rotina em edição — não navega para outras telas
 * (isso esconderia o treino ou descartaria a edição).
 */
export function ExerciseDetail({ id, onBack = pop, embedded = false, initialTab = 'summary' }: {
  id: string
  onBack?: () => void
  embedded?: boolean
  initialTab?: DetailTab
}) {
  useStoreVersion()
  const ex = getExercise(id)
  const sessions = sessionsFor(id)
  const metricKeys = metricsForKind(ex.kind)
  const [metric, setMetric] = useState<keyof Metrics>(metricKeys[0])
  const [tab, setTab] = useState<DetailTab>(initialTab)
  const [historyLimit, setHistoryLimit] = useState(20)
  const [editing, setEditing] = useState(false)

  const perSession = useMemo(() => sessions.map(s => ({ s, m: sessionMetrics(s.entry, ex.kind, s.bodyweight) })), [sessions, ex.kind])
  const best = perSession.reduce((acc, x) => mergeMetrics(acc, x.m), { ...EMPTY_METRICS })
  const points = perSession.filter(x => x.m[metric] > 0).map(x => ({ t: Date.parse(x.s.workout.startedAt), y: x.m[metric] }))
  const reps = ex.kind === 'peso_reps' ? repRecords(id) : []
  const last = perSession[perSession.length - 1]
  const openWorkout = (wid: string) => { if (!embedded) push({ name: 'workout', id: wid }) }
  const HistoryCard = embedded ? 'div' : 'button'

  const menu = () => actionSheet([
    { label: 'Editar exercício', icon: 'edit', onSelect: () => setEditing(true) },
    {
      label: 'Excluir exercício', icon: 'trash', danger: true, onSelect: async () => {
        if (await confirmDialog(`Excluir "${ex.name}"?`, { message: 'Ele continuará aparecendo nos treinos antigos como "Exercício removido".', ok: 'Excluir', danger: true })) {
          remove('exercises', id); pop()
        }
      },
    },
  ])

  return (
    <div className="screen">
      <TopBar onBack={onBack} title="" right={ex.custom && !embedded ? <button className="icon-btn" onClick={menu} aria-label="Opções"><Icon name="more" /></button> : undefined} />
      <div className="large-title" style={{ marginBottom: 2 }}>{ex.name}</div>
      <div className="small muted">
        {MUSCLE_LABEL[ex.primary]}{ex.secondary.length ? ` (+ ${ex.secondary.map(m => MUSCLE_LABEL[m]).join(', ')})` : ''} · {EQUIPMENT_LABEL[ex.equipment]} · {KIND_LABEL[ex.kind]}
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}><p className="muted" style={{ margin: 0 }}>Você ainda não fez este exercício. Os gráficos e recordes aparecem depois do primeiro treino.</p></div>
      ) : (
        <>
          <div className="segmented" role="tablist" style={{ marginTop: 16 }}>
            {(Object.keys(TAB_LABEL) as DetailTab[]).map(t => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>
            ))}
          </div>

          {tab === 'summary' && (
            <>
              <div className="chips">
                {metricKeys.map(k => <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{METRIC_LABEL[k]}</button>)}
              </div>
              <div className="card">
                <LineChart data={points} format={v => fmtMetric({ metric, value: v })} />
              </div>
              <div className="stats">
                <div className="stat"><div className="label">Sessões</div><div className="value num">{sessions.length}</div></div>
                <div className="stat"><div className="label">Recorde</div><div className="value num">{best[metric] > 0 ? fmtMetric({ metric, value: best[metric] }) : '–'}</div></div>
                <div className="stat"><div className="label">Última vez</div><div className="value num">{last && last.m[metric] > 0 ? fmtMetric({ metric, value: last.m[metric] }) : '–'}</div></div>
              </div>
              {last && (
                <>
                  <div className="section-title">Última sessão · {fmtDate(last.s.workout.startedAt)}</div>
                  <SessionSets entry={last.s.entry} kind={ex.kind} />
                </>
              )}
            </>
          )}

          {tab === 'history' && (
            <>
              {[...perSession].reverse().slice(0, historyLimit).map(({ s, m }, i) => (
                <HistoryCard key={i} className={`card ${embedded ? '' : 'tap'}`} onClick={() => openWorkout(s.workout.id)}>
                  <div className="row" style={{ marginBottom: 2 }}>
                    <b className="grow ellipsis">{s.workout.name}</b>
                    <span className="small muted">{fmtDate(s.workout.startedAt)}</span>
                  </div>
                  <div className="small muted" style={{ marginBottom: 6 }}>
                    {metricKeys.filter(k => k !== 'maxReps' || ex.kind === 'peso_corporal').slice(0, 2).filter(k => m[k] > 0)
                      .map(k => `${METRIC_LABEL[k]}: ${fmtMetric({ metric: k, value: m[k] })}`).join(' · ')}
                  </div>
                  <SessionSets entry={s.entry} kind={ex.kind} plain />
                  {s.entry.notes && <div className="small muted" style={{ marginTop: 4, fontStyle: 'italic' }}>{s.entry.notes}</div>}
                </HistoryCard>
              ))}
              {perSession.length > historyLimit && (
                <button className="btn block" onClick={() => setHistoryLimit(n => n + 20)}>Mostrar mais</button>
              )}
            </>
          )}

          {tab === 'records' && (
            <>
              <div className="section-title">Recordes pessoais</div>
              <div className="card">
                {metricKeys.filter(k => best[k] > 0).map(k => (
                  <div key={k} className="row" style={{ padding: '6px 0' }}>
                    <span className="grow text-2">{METRIC_LABEL[k]}</span>
                    <b className="num">{fmtMetric({ metric: k, value: best[k] })}</b>
                  </div>
                ))}
                <div className="row" style={{ padding: '6px 0' }}>
                  <span className="grow text-2">Sessões</span><b>{sessions.length}</b>
                </div>
              </div>
              {reps.length > 0 && (
                <>
                  <div className="section-title">Maior carga por repetições</div>
                  <div className="card">
                    {reps.map(r => (
                      <div key={r.reps} className="row num" style={{ padding: '6px 0' }}>
                        <span style={{ width: 70 }} className="text-2">{r.reps} {r.reps === 1 ? 'rep' : 'reps'}</span>
                        <b className="grow">{fmtKg(r.weight)}</b>
                        <span className="small muted">{fmtDate(r.date)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
      <ExerciseForm open={editing} onClose={() => setEditing(false)} initial={ex} onSaved={() => setEditing(false)} />
    </div>
  )
}

function SessionSets({ entry, kind, plain }: { entry: WorkoutExercise; kind: ExerciseKind; plain?: boolean }) {
  let n = 0
  const body = entry.sets.map((set, j) => {
    const valid = isValidSet(set)
    if (valid) n++
    return (
      <div key={j} className="row small num" style={{ padding: '2px 0', opacity: valid ? 1 : 0.55 }}>
        <span style={{ width: 22, fontWeight: 800, color: set.type !== 'normal' ? 'var(--warn)' : valid ? 'var(--accent)' : 'var(--muted)' }}>
          {set.type === 'warmup' ? 'W' : set.type === 'drop' ? 'D' : set.type === 'failure' ? 'F' : valid ? n : '•'}
        </span>
        <span className="text-2">{setText(set, kind)}</span>
      </div>
    )
  })
  return plain ? <>{body}</> : <div className="card">{body}</div>
}
