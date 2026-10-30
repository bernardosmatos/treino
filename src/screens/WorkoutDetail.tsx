import { useState } from 'react'
import { ExerciseBlocks } from '../components/ExerciseBlocks'
import { Icon, NumInput, TopBar, actionSheet, confirmDialog, toast } from '../components/ui'
import { fmtDate, fmtDuration, fmtKg, fmtNum, fmtSeconds, fmtTime, fmtVolume, toDateTimeInput } from '../lib/format'
import { cloneExercises, pop, push, startWorkout } from '../lib/nav'
import {
  METRIC_LABEL, bodyweightAt, getExercise, isValidSet, workoutDurationMs, workoutPRs, workoutSetCount, workoutVolume, type PR,
} from '../lib/stats'
import { getItem, put, remove, uid, useStoreVersion } from '../lib/store'
import type { ExerciseKind, WorkSet, Workout } from '../types'

export function fmtMetric(pr: Pick<PR, 'metric' | 'value'>) {
  switch (pr.metric) {
    case 'maxReps': return `${pr.value} reps`
    case 'maxSeconds': return fmtSeconds(pr.value)
    case 'maxKm': return `${fmtNum(pr.value, 2)} km`
    default: return fmtKg(+pr.value.toFixed(1))
  }
}

export function setText(s: WorkSet, kind: ExerciseKind) {
  const rpe = s.rpe ? ` @${fmtNum(s.rpe)}` : ''
  switch (kind) {
    case 'peso_reps': return `${fmtNum(s.weight ?? 0, 2)} kg × ${s.reps ?? 0}${rpe}`
    case 'peso_corporal': return `${s.weight ? `+${fmtNum(s.weight, 2)} kg × ` : ''}${s.reps ?? 0} reps${rpe}`
    case 'tempo': return fmtSeconds(s.seconds)
    case 'distancia': return `${fmtNum(s.km ?? 0, 2)} km${s.seconds ? ` · ${fmtSeconds(s.seconds)}` : ''}`
  }
}

const TYPE_TAG: Record<string, string> = { warmup: 'W', drop: 'D', failure: 'F' }

export function WorkoutDetail({ id }: { id: string }) {
  useStoreVersion()
  const w = getItem('workouts', id)
  if (!w) return <div className="screen"><TopBar onBack={pop} title="Treino" /><p className="muted">Treino não encontrado.</p></div>
  const prs = workoutPRs(w)
  const bw = bodyweightAt(w)

  const menu = () => actionSheet([
    { label: 'Editar treino', icon: 'edit', onSelect: () => push({ name: 'edit-workout', id }) },
    { label: 'Repetir este treino', icon: 'play', onSelect: () => startWorkout(w) },
    {
      label: 'Salvar como rotina', icon: 'copy', onSelect: () => {
        const rid = uid()
        put('routines', {
          id: rid, name: w.name, createdAt: new Date().toISOString(),
          exercises: cloneExercises(w.exercises).map(e => ({ ...e, sets: e.sets.map(({ done: _d, rpe: _r, ...s }) => s) })),
        })
        toast('Rotina criada')
      },
    },
    {
      label: 'Excluir treino', icon: 'trash', danger: true, onSelect: async () => {
        if (await confirmDialog('Excluir treino?', { message: 'Essa ação não pode ser desfeita.', ok: 'Excluir', danger: true })) {
          remove('workouts', id); pop()
        }
      },
    },
  ])

  return (
    <div className="screen">
      <TopBar onBack={pop} title="" right={<button className="icon-btn" onClick={menu} aria-label="Opções"><Icon name="more" /></button>} />
      <div className="large-title" style={{ marginBottom: 2 }}>{w.name}</div>
      <div className="muted small">{fmtDate(w.startedAt)} · {fmtTime(w.startedAt)}</div>
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat"><div className="label">Duração</div><div className="value">{fmtDuration(workoutDurationMs(w))}</div></div>
        <div className="stat"><div className="label">Volume</div><div className="value">{fmtVolume(workoutVolume(w))}</div></div>
        <div className="stat"><div className="label">Séries</div><div className="value">{workoutSetCount(w)}</div></div>
      </div>
      {bw && <div className="small text-2" style={{ marginTop: 4 }}>Peso corporal: <b>{fmtKg(bw)}</b></div>}
      {w.notes && <p className="text-2" style={{ whiteSpace: 'pre-wrap' }}>{w.notes}</p>}

      {prs.length > 0 && (
        <div className="card" style={{ marginTop: 14, background: 'var(--gold-soft)' }}>
          <div className="row" style={{ color: 'var(--gold)', fontWeight: 800, marginBottom: 6 }}><Icon name="trophy" /> {prs.length} {prs.length === 1 ? 'recorde' : 'recordes'}</div>
          {prs.map((p, i) => (
            <div key={i} className="small" style={{ margin: '2px 0' }}>
              <b>{getExercise(p.exerciseId).name}</b> · {METRIC_LABEL[p.metric]}: {fmtMetric(p)}
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Exercícios</div>
      {w.exercises.map(e => {
        const ex = getExercise(e.exerciseId)
        let n = 0
        return (
          <button key={e.id} className="card tap" onClick={() => push({ name: 'exercise', id: ex.id })}>
            <div className="row" style={{ marginBottom: 6 }}>
              <span className="grow" style={{ fontWeight: 700, color: 'var(--accent)' }}>{ex.name}</span>
              {prs.some(p => p.exerciseId === ex.id) && <span className="badge gold"><Icon name="trophy" size={12} /> PR</span>}
            </div>
            {e.notes && <div className="small muted" style={{ marginBottom: 4 }}>{e.notes}</div>}
            {e.sets.map(s => {
              const valid = isValidSet(s)
              if (valid) n++
              return (
                <div key={s.id} className="row small num" style={{ padding: '3px 0', opacity: valid ? 1 : 0.55 }}>
                  <span style={{ width: 22, fontWeight: 800, color: s.type !== 'normal' ? 'var(--warn)' : valid ? 'var(--accent)' : 'var(--muted)' }}>{s.type !== 'normal' ? TYPE_TAG[s.type] : valid ? n : '•'}</span>
                  <span>{setText(s, ex.kind)}</span>
                </div>
              )
            })}
          </button>
        )
      })}
    </div>
  )
}

export function EditWorkout({ id }: { id: string }) {
  const original = getItem('workouts', id)
  const [w, setW] = useState<Workout | undefined>(original && structuredClone(original))
  if (!w || !original) return <div className="screen"><TopBar onBack={pop} title="Treino" /></div>
  const duration = Math.round(workoutDurationMs(w) / 60000)

  const save = () => {
    put('workouts', {
      ...w,
      exercises: w.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.done !== false) })).filter(e => e.sets.length),
    })
    toast('Treino atualizado')
    pop()
  }

  return (
    <div className="screen">
      <TopBar onBack={pop} title="Editar treino" center right={<button className="btn primary sm" onClick={save}>Salvar</button>} />
      <label className="field"><span>Nome</span>
        <input className="input" value={w.name} onChange={e => setW({ ...w, name: e.target.value })} />
      </label>
      <div className="row" style={{ gap: 10 }}>
        <label className="field grow"><span>Início</span>
          <input className="input" type="datetime-local" value={toDateTimeInput(w.startedAt)}
            onChange={e => {
              if (!e.target.value) return
              const start = new Date(e.target.value)
              setW({ ...w, startedAt: start.toISOString(), endedAt: new Date(start.getTime() + duration * 60000).toISOString() })
            }} />
        </label>
        <label className="field" style={{ width: 110 }}><span>Duração (min)</span>
          <NumInput className="input" decimal={false} value={duration}
            onChange={v => v && setW({ ...w, endedAt: new Date(Date.parse(w.startedAt) + v * 60000).toISOString() })} />
        </label>
      </div>
      <label className="field"><span>Peso corporal (kg)</span>
        <NumInput className="input" value={w.bodyweight} onChange={v => setW({ ...w, bodyweight: v })} />
      </label>
      <label className="field"><span>Anotações</span>
        <textarea className="input" rows={2} value={w.notes ?? ''} onChange={e => setW({ ...w, notes: e.target.value })} />
      </label>
      <div className="small muted" style={{ margin: '0 2px 10px' }}>Séries desmarcadas são removidas ao salvar.</div>
      <ExerciseBlocks mode="edit" workoutId={w.id} exercises={w.exercises} onChange={exercises => setW({ ...w, exercises })} />
    </div>
  )
}
