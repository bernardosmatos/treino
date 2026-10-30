import { useMemo, useState, type CSSProperties } from 'react'
import { fmtNum } from '../lib/format'
import { push } from '../lib/nav'
import { getExercise, isValidSet, previousSets } from '../lib/stats'
import { uid } from '../lib/store'
import type { ExerciseKind, SetType, WorkSet, WorkoutExercise } from '../types'
import { ExercisePicker } from './ExercisePicker'
import { Icon, NumInput, actionSheet, confirmDialog, toast } from './ui'

/**
 * live:     treino em andamento (marca séries concluídas)
 * edit:     editando treino já salvo
 * template: montando rotina (define quais séries são válidas; sem concluído/RPE)
 */
export type BlockMode = 'live' | 'edit' | 'template'

const SET_TYPE_SHORT: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' }
const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const SS_VARS = ['--ss-a', '--ss-b', '--ss-c', '--ss-d']

function prevLabel(s: WorkSet | undefined, kind: ExerciseKind) {
  if (!s) return '–'
  switch (kind) {
    case 'peso_reps': return s.reps ? `${fmtNum(s.weight ?? 0, 2)}kg × ${s.reps}` : '–'
    case 'peso_corporal': return s.reps ? `${s.weight ? `+${fmtNum(s.weight, 2)}kg × ` : ''}${s.reps}` : '–'
    case 'tempo': return s.seconds ? `${s.seconds}s` : '–'
    case 'distancia': return s.km ? `${fmtNum(s.km, 2)}km` : '–'
  }
}

export function ExerciseBlocks({ exercises, onChange, mode, workoutId }: {
  exercises: WorkoutExercise[]
  onChange: (next: WorkoutExercise[]) => void
  mode: BlockMode
  workoutId?: string
}) {
  const [picker, setPicker] = useState<null | { replace?: string }>(null)

  // letras de superset na ordem em que aparecem
  const ssIndex = useMemo(() => {
    const m = new Map<string, number>()
    exercises.forEach(e => { if (e.supersetId && !m.has(e.supersetId)) m.set(e.supersetId, m.size) })
    return m
  }, [exercises])

  const update = (id: string, patch: Partial<WorkoutExercise>) =>
    onChange(exercises.map(e => (e.id === id ? { ...e, ...patch } : e)))

  const addExercises = (ids: string[]) => {
    const added = ids.map(exerciseId => {
      const prev = mode === 'template' ? [] : previousSets(exerciseId, workoutId)
      const count = Math.max(1, Math.min(prev.filter(s => s.type !== 'warmup').length || 3, 8))
      return {
        id: uid(), exerciseId,
        sets: Array.from({ length: mode === 'template' ? 3 : count }, () => ({ id: uid(), type: 'normal' as SetType, done: mode === 'edit' })),
      }
    })
    onChange([...exercises, ...added])
  }

  const replace = (entryId: string, exerciseId: string) =>
    onChange(exercises.map(e => (e.id === entryId ? { ...e, exerciseId, sets: e.sets.map(s => ({ ...s, done: mode === 'edit' ? s.done : false })) } : e)))

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= exercises.length) return
    const next = [...exercises]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }

  const joinSuperset = (entry: WorkoutExercise, partner: WorkoutExercise) => {
    const group = entry.supersetId ?? partner.supersetId ?? uid()
    const without = exercises.filter(e => e.id !== partner.id)
    // posiciona o parceiro logo depois do último membro do grupo
    let at = without.findIndex(e => e.id === entry.id)
    while (at + 1 < without.length && without[at + 1].supersetId === group) at++
    without.splice(at + 1, 0, { ...partner, supersetId: group })
    onChange(without.map(e => (e.id === entry.id || (entry.supersetId && e.supersetId === entry.supersetId) ? { ...e, supersetId: group } : e)))
  }

  const leaveSuperset = (entry: WorkoutExercise) => {
    const group = entry.supersetId
    const remaining = exercises.filter(e => e.supersetId === group && e.id !== entry.id)
    onChange(exercises.map(e => {
      if (e.id === entry.id) return { ...e, supersetId: undefined }
      if (remaining.length === 1 && e.id === remaining[0].id) return { ...e, supersetId: undefined } // grupo de um só some
      return e
    }))
  }

  const openMenu = (entry: WorkoutExercise, idx: number) => {
    const others = exercises.filter(e => e.id !== entry.id && (!entry.supersetId || e.supersetId !== entry.supersetId))
    actionSheet([
      { label: 'Substituir exercício', icon: 'swap', onSelect: () => setPicker({ replace: entry.id }) },
      ...(others.length ? [{
        label: entry.supersetId ? 'Adicionar outro ao superset' : 'Fazer superset com…', icon: 'link',
        onSelect: () => actionSheet(others.map(o => ({ label: getExercise(o.exerciseId).name, onSelect: () => joinSuperset(entry, o) })), 'Superset com'),
      }] : []),
      ...(entry.supersetId ? [{ label: 'Remover do superset', icon: 'link', onSelect: () => leaveSuperset(entry) }] : []),
      ...(idx > 0 ? [{ label: 'Mover para cima', icon: 'up', onSelect: () => move(idx, -1) }] : []),
      ...(idx < exercises.length - 1 ? [{ label: 'Mover para baixo', icon: 'down', onSelect: () => move(idx, 1) }] : []),
      { label: 'Remover exercício', icon: 'trash', danger: true, onSelect: () => onChange(exercises.filter(e => e.id !== entry.id)) },
    ], getExercise(entry.exerciseId).name)
  }

  return (
    <>
      {exercises.map((entry, idx) => {
        const ss = entry.supersetId ? ssIndex.get(entry.supersetId)! : -1
        return (
          <ExerciseCard key={entry.id} entry={entry} mode={mode} workoutId={workoutId}
            superset={ss >= 0 ? { letter: String.fromCharCode(65 + ss), color: `var(${SS_VARS[ss % SS_VARS.length]})` } : undefined}
            onChange={patch => update(entry.id, patch)}
            onMenu={() => openMenu(entry, idx)} />
        )
      })}
      <button className="btn primary block" onClick={() => setPicker({})}><Icon name="plus" /> Adicionar exercício</button>
      <ExercisePicker open={!!picker} multi={!picker?.replace} title={picker?.replace ? 'Substituir exercício' : undefined}
        onClose={() => setPicker(null)}
        onPick={ids => (picker?.replace ? replace(picker.replace, ids[0]) : addExercises(ids))} />
    </>
  )
}

function ExerciseCard({ entry, mode, workoutId, superset, onChange, onMenu }: {
  entry: WorkoutExercise
  mode: BlockMode
  workoutId?: string
  superset?: { letter: string; color: string }
  onChange: (patch: Partial<WorkoutExercise>) => void
  onMenu: () => void
}) {
  const ex = getExercise(entry.exerciseId)
  const prev = useMemo(() => (mode === 'template' ? [] : previousSets(entry.exerciseId, workoutId)), [entry.exerciseId, workoutId, mode])
  const [showNotes, setShowNotes] = useState(!!entry.notes)
  const showRpe = mode !== 'template' && (ex.kind === 'peso_reps' || ex.kind === 'peso_corporal')
  const showDone = mode !== 'template'

  const setSets = (sets: WorkSet[]) => onChange({ sets })
  const updSet = (id: string, patch: Partial<WorkSet>) => setSets(entry.sets.map(s => (s.id === id ? { ...s, ...patch } : s)))

  // série válida casa com válida e não válida com não válida, na mesma ordem
  const prevMatch = (i: number) => {
    const valid = isValidSet(entry.sets[i])
    const k = entry.sets.slice(0, i).filter(x => isValidSet(x) === valid).length
    return prev.filter(x => isValidSet(x) === valid)[k]
  }

  const toggleDone = (s: WorkSet, i: number) => {
    if (s.done) { updSet(s.id, { done: false }); return }
    const p = prevMatch(i)
    const filled: WorkSet = {
      ...s,
      weight: s.weight ?? p?.weight,
      reps: s.reps ?? p?.reps,
      seconds: s.seconds ?? p?.seconds,
      km: s.km ?? p?.km,
      done: true,
    }
    const missing =
      (ex.kind === 'peso_reps' || ex.kind === 'peso_corporal') ? !filled.reps
        : ex.kind === 'tempo' ? !filled.seconds : !filled.km && !filled.seconds
    if (missing) { toast('Preencha a série antes de concluir'); return }
    updSet(s.id, filled)
  }

  const addSet = () => {
    const last = entry.sets[entry.sets.length - 1]
    setSets([...entry.sets, {
      id: uid(), type: last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal'),
      valid: last?.type === 'warmup' ? undefined : last?.valid,
      weight: last?.weight, reps: last?.reps, seconds: last?.seconds, km: last?.km, done: mode === 'edit',
    }])
  }

  const removeLastSet = async () => {
    const last = entry.sets[entry.sets.length - 1]
    if (entry.sets.length <= 1) return
    if (mode !== 'template' && last.done && !(await confirmDialog('Remover a última série?', { message: 'Ela já foi concluída.', ok: 'Remover', danger: true }))) return
    setSets(entry.sets.slice(0, -1))
  }

  let n = 0
  const cols = ex.kind === 'peso_reps' ? ['KG', 'REPS'] : ex.kind === 'peso_corporal' ? ['+KG', 'REPS'] : ex.kind === 'tempo' ? ['SEG'] : ['KM', 'MIN']

  return (
    <div className={`ex-card ${superset ? 'ss' : ''}`} style={superset ? ({ '--ss': superset.color } as CSSProperties) : undefined}>
      <div className="ex-title">
        <button className="name ellipsis" onClick={() => push({ name: 'exercise', id: ex.id })}>{ex.name}</button>
        <button className="icon-btn" aria-label="Anotação" onClick={() => setShowNotes(v => !v)}><Icon name="note" size={20} /></button>
        <button className="icon-btn" aria-label="Opções" onClick={onMenu}><Icon name="more" /></button>
      </div>
      {superset && <div className="ss-label" style={{ padding: '0 4px' }}><i /> Superset {superset.letter}</div>}
      {showNotes && (
        <textarea className="input plain small" rows={1} placeholder="Anotação…" value={entry.notes ?? ''}
          onChange={e => onChange({ notes: e.target.value })} style={{ padding: '4px', marginTop: 2 }} />
      )}
      <table className="sets">
        <thead>
          <tr>
            <th style={{ width: 36 }}>Série</th>
            {mode !== 'template' && <th>Anterior</th>}
            {cols.map(c => <th key={c} style={{ width: cols.length === 1 ? 110 : 62 }}>{c}</th>)}
            {showRpe && <th style={{ width: 44 }}>RPE</th>}
            {mode === 'template' && <th style={{ width: 56 }}>Válida</th>}
            {showDone && <th style={{ width: 40 }}><Icon name="check" size={14} stroke={3} /></th>}
          </tr>
        </thead>
        <tbody>
          {entry.sets.map((s, i) => {
            const valid = isValidSet(s)
            if (valid) n++
            const p = prevMatch(i)
            const label = s.type !== 'normal' ? SET_TYPE_SHORT[s.type] : valid ? String(n) : '•'
            return (
              <tr key={s.id} className={`${s.done && showDone ? 'done' : ''} ${valid ? 'valid' : 'not-valid'}`}>
                <td>
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    <span className={`set-type ${s.type}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{label}</span>
                    <select aria-label="Tipo de série" value={s.type}
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%' }}
                      onChange={e => {
                        const v = e.target.value
                        if (v === 'remove') setSets(entry.sets.filter(x => x.id !== s.id))
                        else updSet(s.id, { type: v as SetType })
                      }}>
                      <option value="normal">Série normal</option>
                      <option value="warmup">Aquecimento (W)</option>
                      <option value="drop">Drop set (D)</option>
                      <option value="failure">Até a falha (F)</option>
                      <option value="remove">Remover série</option>
                    </select>
                  </span>
                </td>
                {mode !== 'template' && <td className="prev">{prevLabel(p, ex.kind)}</td>}
                {ex.kind === 'peso_reps' || ex.kind === 'peso_corporal' ? (
                  <>
                    <td><NumInput ariaLabel="Carga" value={s.weight} placeholder={p?.weight !== undefined ? fmtNum(p.weight, 2) : ex.kind === 'peso_corporal' ? '0' : ''} onChange={v => updSet(s.id, { weight: v })} /></td>
                    <td><NumInput ariaLabel="Repetições" decimal={false} value={s.reps} placeholder={p?.reps !== undefined ? String(p.reps) : ''} onChange={v => updSet(s.id, { reps: v })} /></td>
                  </>
                ) : ex.kind === 'tempo' ? (
                  <td><NumInput ariaLabel="Segundos" decimal={false} value={s.seconds} placeholder={p?.seconds ? String(p.seconds) : ''} onChange={v => updSet(s.id, { seconds: v })} /></td>
                ) : (
                  <>
                    <td><NumInput ariaLabel="Distância em km" value={s.km} placeholder={p?.km ? fmtNum(p.km, 2) : ''} onChange={v => updSet(s.id, { km: v })} /></td>
                    <td><NumInput ariaLabel="Minutos" value={s.seconds !== undefined ? +(s.seconds / 60).toFixed(2) : undefined}
                      placeholder={p?.seconds ? fmtNum(p.seconds / 60) : ''} onChange={v => updSet(s.id, { seconds: v === undefined ? undefined : Math.round(v * 60) })} /></td>
                  </>
                )}
                {showRpe && (
                  <td>
                    <select className="rpe-sel" aria-label="RPE" value={s.rpe ?? ''}
                      onChange={e => updSet(s.id, { rpe: e.target.value ? Number(e.target.value) : undefined })}>
                      <option value="">–</option>
                      {RPE_OPTIONS.map(r => <option key={r} value={r}>{fmtNum(r)}</option>)}
                    </select>
                  </td>
                )}
                {mode === 'template' && (
                  <td>
                    <button className={`valid-btn ${valid ? 'on' : ''}`} role="switch" aria-checked={valid} aria-label="Série válida"
                      disabled={s.type === 'warmup'} onClick={() => updSet(s.id, { valid: valid ? false : undefined })}>
                      <Icon name="star" size={18} />
                    </button>
                  </td>
                )}
                {showDone && (
                  <td>
                    <button className={`done-btn ${s.done ? 'on' : ''}`} aria-label="Concluir série" onClick={() => toggleDone(s, i)}>
                      <Icon name="check" size={18} stroke={3} />
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 6, gap: 6 }}>
        <button className="btn sm" style={{ flex: 1 }} disabled={entry.sets.length <= 1} onClick={removeLastSet}>– Remover série</button>
        <button className="btn sm" style={{ flex: 1 }} onClick={addSet}><Icon name="plus" size={16} /> Adicionar série</button>
      </div>
    </div>
  )
}
