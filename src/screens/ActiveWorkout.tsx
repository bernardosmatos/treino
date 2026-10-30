import { useEffect, useState } from 'react'
import { ExerciseBlocks } from '../components/ExerciseBlocks'
import { Icon, NumInput, Sheet, TopBar, confirmDialog, toast } from '../components/ui'
import { fmtClock, fmtKg, fmtVolume, fmtNum } from '../lib/format'
import { closeActive, cloneExercises, discardActive, push, recordBodyweight, setTab } from '../lib/nav'
import { workoutSetCount, workoutVolume } from '../lib/stats'
import { getActive, getItem, put, setActive, useStoreVersion } from '../lib/store'
import { adjustRest, keepAwake, stopRest, useRest } from '../lib/timer'
import type { Workout } from '../types'

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

export function ActiveWorkout() {
  useStoreVersion()
  const w = getActive()
  const now = useNow()
  const [bwOpen, setBwOpen] = useState(false)
  useEffect(() => { keepAwake(true) }, [])
  if (!w) return null

  const update = (patch: Partial<Workout>) => setActive({ ...getActive()!, ...patch })

  const finish = async () => {
    const pending = w.exercises.reduce((t, e) => t + e.sets.filter(s => !s.done).length, 0)
    const doneSets = w.exercises.reduce((t, e) => t + e.sets.filter(s => s.done).length, 0)
    if (!doneSets) {
      const ok = await confirmDialog('Nenhuma série concluída', { message: 'Marque as séries feitas antes de concluir. Quer descartar o treino?', ok: 'Descartar treino', danger: true })
      if (ok) discardActive()
      return
    }
    if (pending && !(await confirmDialog('Concluir treino?', {
      message: `${pending} ${pending === 1 ? 'série não marcada será descartada' : 'séries não marcadas serão descartadas'}.`, ok: 'Concluir',
    }))) return
    if (!pending && !(await confirmDialog('Concluir treino?', { ok: 'Concluir' }))) return

    const saved: Workout = {
      ...w,
      name: w.name.trim() || 'Treino',
      endedAt: new Date().toISOString(),
      exercises: w.exercises
        .map(e => ({ ...e, sets: e.sets.filter(s => s.done).map(s => ({ ...s, done: true })) }))
        .filter(e => e.sets.length),
    }
    put('workouts', saved)
    discardActive()
    setTab('home')
    push({ name: 'workout', id: saved.id })
    toast('Treino salvo 💪')

    const routine = saved.routineId ? getItem('routines', saved.routineId) : undefined
    if (routine && await confirmDialog('Atualizar a rotina?', {
      message: `Salvar as cargas, séries e exercícios deste treino em "${routine.name}"?`, ok: 'Atualizar rotina',
    })) {
      put('routines', { ...routine, exercises: cloneExercises(saved.exercises).map(e => ({ ...e, sets: e.sets.map(({ done: _d, rpe: _r, ...s }) => s) })) })
      toast('Rotina atualizada')
    }
  }

  const discard = async () => {
    if (await confirmDialog('Descartar treino?', { message: 'Tudo o que foi registrado neste treino será perdido.', ok: 'Descartar', danger: true })) discardActive()
  }

  return (
    <div className="overlay">
      <div className="screen">
        <TopBar
          title={<span className="num">{fmtClock(now - Date.parse(w.startedAt))}</span>}
          center
          onBack={closeActive}
          right={<button className="btn good sm" onClick={finish}>Concluir</button>}
        />
        <input className="input plain" style={{ fontSize: 24, fontWeight: 800 }} value={w.name}
          onChange={e => update({ name: e.target.value })} aria-label="Nome do treino" />
        <div className="stats">
          <div className="stat"><div className="label">Volume</div><div className="value num">{fmtVolume(workoutVolume(w))}</div></div>
          <div className="stat"><div className="label">Séries</div><div className="value num">{workoutSetCount(w)}</div></div>
          <button className="stat" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setBwOpen(true)}>
            <div className="label">Peso corporal</div>
            <div className="value num" style={{ color: 'var(--accent)' }}>{w.bodyweight ? fmtKg(w.bodyweight) : 'Informar'}</div>
          </button>
        </div>
        <textarea className="input plain text-2" rows={1} placeholder="Anotações do treino…" value={w.notes ?? ''}
          onChange={e => update({ notes: e.target.value })} style={{ margin: '4px 0 12px' }} />

        <ExerciseBlocks mode="live" workoutId={w.id} exercises={w.exercises} onChange={exercises => update({ exercises })} />
        <button className="btn danger block" style={{ marginTop: 16 }} onClick={discard}>Descartar treino</button>
      </div>
      <RestBar />
      <BodyweightSheet open={bwOpen} onClose={() => setBwOpen(false)} initial={w.bodyweight}
        onSave={v => { update({ bodyweight: v }); if (v) recordBodyweight(v); setBwOpen(false) }} />
    </div>
  )
}

function RestBar() {
  const rest = useRest()
  useNow(250)
  if (!rest) return null
  const left = Math.max(0, rest.endsAt - Date.now())
  return (
    <div className="rest-bar" role="timer" aria-label="Descanso">
      <div className="track"><div className="fill" style={{ width: `${Math.min(100, (left / (rest.total * 1000)) * 100)}%` }} /></div>
      <div className="row">
        <button className="btn sm" onClick={() => adjustRest(-15)}>−15</button>
        <div className="time">{fmtClock(left)}</div>
        <button className="btn sm" onClick={() => adjustRest(15)}>+15</button>
        <button className="btn sm primary" onClick={stopRest}>Pular</button>
      </div>
    </div>
  )
}

export function BodyweightSheet({ open, onClose, onSave, initial, title = 'Peso corporal', intro, skipLabel, saveLabel = 'Salvar' }: {
  open: boolean
  onClose: () => void
  onSave: (v: number | undefined) => void
  initial?: number
  title?: string
  intro?: string
  skipLabel?: string
  saveLabel?: string
}) {
  const [v, setV] = useState<number | undefined>(initial)
  useEffect(() => { if (open) setV(initial) }, [open, initial])
  const step = (d: number) => setV(x => Math.max(0, +((x ?? initial ?? 70) + d).toFixed(1)))
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {intro && <p className="text-2" style={{ marginTop: 0 }}>{intro}</p>}
      <div className="row" style={{ justifyContent: 'center', gap: 12, margin: '8px 0 18px' }}>
        <button className="btn" aria-label="Diminuir 0,1 kg" onClick={() => step(-0.1)}>−</button>
        <div style={{ width: 140 }}>
          <NumInput className="input center-text" value={v} onChange={setV} ariaLabel="Peso em kg" placeholder={initial ? fmtNum(initial) : '0,0'} />
        </div>
        <span className="muted" style={{ fontWeight: 700 }}>kg</span>
        <button className="btn" aria-label="Aumentar 0,1 kg" onClick={() => step(0.1)}>+</button>
      </div>
      <div className="stack">
        <button className="btn primary block" disabled={!v} onClick={() => onSave(v)}><Icon name="check" /> {saveLabel}</button>
        {skipLabel && <button className="btn block" onClick={() => onSave(undefined)}>{skipLabel}</button>}
      </div>
    </Sheet>
  )
}
