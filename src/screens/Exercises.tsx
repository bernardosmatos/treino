import { useMemo, useState } from 'react'
import { LineChart } from '../components/Charts'
import { ExerciseForm, ExerciseList, SearchAndFilter } from '../components/ExercisePicker'
import { Icon, TopBar, actionSheet, confirmDialog } from '../components/ui'
import { EQUIPMENT_LABEL, KIND_LABEL, MUSCLE_LABEL } from '../data/exercises'
import { fmtDate } from '../lib/format'
import { pop, push } from '../lib/nav'
import {
  EMPTY_METRICS, METRIC_LABEL, getExercise, mergeMetrics, metricsForKind, sessionMetrics, sessionsFor, type Metrics,
} from '../lib/stats'
import { remove, useStoreVersion } from '../lib/store'
import type { Muscle } from '../types'
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

export function ExerciseDetail({ id }: { id: string }) {
  useStoreVersion()
  const ex = getExercise(id)
  const sessions = sessionsFor(id)
  const metricKeys = metricsForKind(ex.kind)
  const [metric, setMetric] = useState<keyof Metrics>(metricKeys[0])
  const [editing, setEditing] = useState(false)

  const perSession = useMemo(() => sessions.map(s => ({ s, m: sessionMetrics(s.entry, ex.kind, s.bodyweight) })), [sessions, ex.kind])
  const best = perSession.reduce((acc, x) => mergeMetrics(acc, x.m), { ...EMPTY_METRICS })
  const points = perSession.filter(x => x.m[metric] > 0).map(x => ({ t: Date.parse(x.s.workout.startedAt), y: x.m[metric] }))

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
      <TopBar onBack={pop} title="" right={ex.custom ? <button className="icon-btn" onClick={menu} aria-label="Opções"><Icon name="more" /></button> : undefined} />
      <div className="large-title" style={{ marginBottom: 2 }}>{ex.name}</div>
      <div className="small muted">
        {MUSCLE_LABEL[ex.primary]}{ex.secondary.length ? ` (+ ${ex.secondary.map(m => MUSCLE_LABEL[m]).join(', ')})` : ''} · {EQUIPMENT_LABEL[ex.equipment]} · {KIND_LABEL[ex.kind]}
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}><p className="muted" style={{ margin: 0 }}>Você ainda não fez este exercício. Os gráficos e recordes aparecem depois do primeiro treino.</p></div>
      ) : (
        <>
          <div className="chips" style={{ marginTop: 16 }}>
            {metricKeys.map(k => <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{METRIC_LABEL[k]}</button>)}
          </div>
          <div className="card">
            <LineChart data={points} format={v => fmtMetric({ metric, value: v })} />
          </div>

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

          <div className="section-title">Histórico</div>
          {[...sessions].reverse().slice(0, 30).map((s, i) => (
            <button key={i} className="card tap" onClick={() => push({ name: 'workout', id: s.workout.id })}>
              <div className="row" style={{ marginBottom: 4 }}>
                <b className="grow ellipsis">{s.workout.name}</b>
                <span className="small muted">{fmtDate(s.workout.startedAt)}</span>
              </div>
              {s.entry.sets.map((set, j) => (
                <div key={j} className="small num text-2" style={{ padding: '1px 0', color: set.type === 'warmup' ? 'var(--muted)' : undefined }}>
                  {set.type === 'warmup' ? 'W · ' : ''}{setText(set, ex.kind)}
                </div>
              ))}
            </button>
          ))}
        </>
      )}
      <ExerciseForm open={editing} onClose={() => setEditing(false)} initial={ex} onSaved={() => setEditing(false)} />
    </div>
  )
}
