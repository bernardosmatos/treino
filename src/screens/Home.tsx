import { useState } from 'react'
import { Empty, Icon } from '../components/ui'
import { fmtDate, fmtDuration, fmtVolume } from '../lib/format'
import { push, setTab } from '../lib/nav'
import {
  finishedWorkouts, getExercise, weekStreak, weeklyAgg, workoutDurationMs, workoutPRs, workoutSetCount, workoutVolume,
} from '../lib/stats'
import { getSyncInfo, useStoreVersion } from '../lib/store'
import type { Workout } from '../types'

export function SyncBadge() {
  const s = getSyncInfo()
  if (s.state === 'off') return null
  const label = s.state === 'syncing' ? 'Sincronizando' : s.state === 'error' ? 'Erro ao sincronizar' : s.state === 'offline' ? 'Offline' : s.pending ? `${s.pending} pendente(s)` : 'Sincronizado'
  const bad = s.state === 'error' || s.state === 'offline'
  return (
    <button className="icon-btn" aria-label={label} title={label} onClick={() => push({ name: 'settings' })}
      style={{ color: bad ? 'var(--warn)' : 'var(--muted)' }}>
      <Icon name={bad ? 'cloudOff' : 'cloud'} size={20} />
    </button>
  )
}

export function WorkoutCard({ w }: { w: Workout }) {
  const prs = workoutPRs(w)
  return (
    <button className="card tap" onClick={() => push({ name: 'workout', id: w.id })}>
      <div className="row">
        <h3 className="grow ellipsis">{w.name}</h3>
        {prs.length > 0 && <span className="badge gold"><Icon name="trophy" size={12} /> {prs.length}</span>}
      </div>
      <div className="muted small">{fmtDate(w.startedAt)}</div>
      <div className="stats">
        <div className="stat"><div className="label">Duração</div><div className="value">{fmtDuration(workoutDurationMs(w))}</div></div>
        <div className="stat"><div className="label">Volume</div><div className="value">{fmtVolume(workoutVolume(w))}</div></div>
        <div className="stat"><div className="label">Séries</div><div className="value">{workoutSetCount(w)}</div></div>
      </div>
      <div className="small text-2" style={{ marginTop: 6 }}>
        {w.exercises.slice(0, 4).map(e => (
          <div key={e.id} className="ellipsis">{e.sets.length} × {getExercise(e.exerciseId).name}</div>
        ))}
        {w.exercises.length > 4 && <div className="muted">+ {w.exercises.length - 4} exercícios</div>}
      </div>
    </button>
  )
}

export function Home() {
  useStoreVersion()
  const [limit, setLimit] = useState(20)
  const workouts = finishedWorkouts()
  const week = weeklyAgg(1, workouts)[0]
  const streak = weekStreak(workouts)

  return (
    <div className="screen">
      <div className="topbar">
        <h1 style={{ fontSize: 30, fontWeight: 800 }}>Início</h1>
        <SyncBadge />
        <button className="icon-btn" aria-label="Configurações" onClick={() => push({ name: 'settings' })}><Icon name="gear" /></button>
      </div>

      <div className="card">
        <div className="small muted" style={{ fontWeight: 700 }}>Esta semana</div>
        <div className="stats">
          <div className="stat"><div className="label">Treinos</div><div className="value">{week.workouts}</div></div>
          <div className="stat"><div className="label">Volume</div><div className="value">{fmtVolume(week.volume)}</div></div>
          <div className="stat"><div className="label">Sequência</div><div className="value">{streak} {streak === 1 ? 'semana' : 'semanas'}</div></div>
        </div>
      </div>

      <div className="section-title">Histórico</div>
      {workouts.length === 0 ? (
        <Empty icon="🏋️" title="Nenhum treino ainda">
          <p>Comece um treino vazio ou monte uma rotina.</p>
          <button className="btn primary" onClick={() => setTab('train')}>Ir para Treinar</button>
        </Empty>
      ) : (
        <>
          {workouts.slice(0, limit).map(w => <WorkoutCard key={w.id} w={w} />)}
          {workouts.length > limit && <button className="btn block" onClick={() => setLimit(l => l + 20)}>Carregar mais</button>}
        </>
      )}
    </div>
  )
}
