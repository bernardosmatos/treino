import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject, type TouchEvent as ReactTouchEvent,
} from 'react'
import { fmtNum } from '../lib/format'
import { getExercise, isValidSet, moveItem, previousSets } from '../lib/stats'
import { uid } from '../lib/store'
import { ExerciseDetail } from '../screens/Exercises'
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

// ---------- gestos (toque e mouse) ----------

interface Pt { x: number; y: number }
interface TrackHandlers {
  move: (p: Pt, prevent: () => void) => void
  end: (cancelled: boolean, prevent: () => void) => void
}
let lastTouchAt = 0

/**
 * Acompanha um toque/clique até soltar, com ouvintes na janela. O elemento tocado precisa
 * continuar montado: no iOS os eventos de toque seguem indo para ele.
 */
function track(e: ReactTouchEvent | ReactMouseEvent, h: TrackHandlers): Pt | null {
  if ('touches' in e) {
    if (e.touches.length > 1) return null
    lastTouchAt = Date.now()
    const t0 = e.touches[0]
    const id = t0.identifier
    const find = (ev: TouchEvent) => Array.from(ev.changedTouches).find(t => t.identifier === id)
    const mv = (ev: TouchEvent) => {
      const t = find(ev)
      if (t) h.move({ x: t.clientX, y: t.clientY }, () => { if (ev.cancelable) ev.preventDefault() })
    }
    const up = (ev: TouchEvent) => {
      if (!find(ev)) return
      off()
      h.end(ev.type === 'touchcancel', () => { if (ev.cancelable) ev.preventDefault() })
    }
    const off = () => {
      window.removeEventListener('touchmove', mv)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', up)
    }
    window.addEventListener('touchmove', mv, { passive: false })
    window.addEventListener('touchend', up, { passive: false })
    window.addEventListener('touchcancel', up)
    return { x: t0.clientX, y: t0.clientY }
  }
  if (e.button !== 0 || Date.now() - lastTouchAt < 800) return null // ignora o mouse simulado depois de um toque
  const mv = (ev: MouseEvent) => h.move({ x: ev.clientX, y: ev.clientY }, () => ev.preventDefault())
  const up = () => { off(); h.end(false, () => {}) }
  const off = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  window.addEventListener('mousemove', mv)
  window.addEventListener('mouseup', up)
  return { x: e.clientX, y: e.clientY }
}

const LONG_PRESS_MS = 380
const REORDER_ROW_H = 64

interface SsInfo { letter: string; color: string }

export function ExerciseBlocks({ exercises, onChange, mode, workoutId }: {
  exercises: WorkoutExercise[]
  onChange: (next: WorkoutExercise[]) => void
  mode: BlockMode
  workoutId?: string
}) {
  const [picker, setPicker] = useState<null | { replace?: string }>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [reorder, setReorder] = useState<null | { auto: boolean }>(null)
  const [drag, setDrag] = useState<null | { id: string; y: number }>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const latest = useRef(exercises)
  latest.current = exercises

  // letras de superset na ordem em que aparecem
  const ssIndex = useMemo(() => {
    const m = new Map<string, number>()
    exercises.forEach(e => { if (e.supersetId && !m.has(e.supersetId)) m.set(e.supersetId, m.size) })
    return m
  }, [exercises])
  const ssInfo = (e: WorkoutExercise): SsInfo | undefined => {
    const ss = e.supersetId ? ssIndex.get(e.supersetId)! : -1
    return ss >= 0 ? { letter: String.fromCharCode(65 + ss), color: `var(${SS_VARS[ss % SS_VARS.length]})` } : undefined
  }

  // ----- reordenar -----
  const targetIndex = (y: number) => {
    const top = listRef.current?.getBoundingClientRect().top
    if (top === undefined) return -1
    return Math.max(0, Math.min(latest.current.length - 1, Math.round((y - top - REORDER_ROW_H / 2) / REORDER_ROW_H)))
  }
  const dragRef = useRef(drag)
  const setDragBoth = (d: typeof drag) => { dragRef.current = d; setDrag(d) }
  const reorderRef = useRef(reorder)
  reorderRef.current = reorder

  const startDrag = (id: string, y: number, auto: boolean) => {
    navigator.vibrate?.(10)
    if (!reorderRef.current) setReorder({ auto })
    setDragBoth({ id, y })
  }
  const moveDrag = (y: number) => { if (dragRef.current) setDragBoth({ ...dragRef.current, y }) }
  const endDrag = (cancelled = false) => {
    const d = dragRef.current
    setDragBoth(null)
    if (!d) return
    if (!cancelled) {
      const from = latest.current.findIndex(e => e.id === d.id)
      const to = targetIndex(d.y)
      if (from >= 0 && to >= 0 && from !== to) onChange(moveItem(latest.current, from, to))
    }
    if (reorderRef.current?.auto) closeReorder(d.id)
  }
  const closeReorder = (focusId?: string) => {
    setReorder(null)
    if (focusId) setTimeout(() => document.querySelector(`[data-entry="${focusId}"]`)?.scrollIntoView({ block: 'nearest' }), 30)
  }

  const removeSet = (entryId: string, setId: string) => {
    const entry = latest.current.find(e => e.id === entryId)
    const idx = entry?.sets.findIndex(s => s.id === setId) ?? -1
    if (!entry || idx < 0 || entry.sets.length <= 1) return
    const removed = entry.sets[idx]
    onChange(latest.current.map(e => (e.id === entryId ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e)))
    toast('Série removida', {
      label: 'Desfazer',
      run: () => onChange(latest.current.map(e => {
        if (e.id !== entryId || e.sets.some(s => s.id === setId)) return e
        const sets = [...e.sets]
        sets.splice(Math.min(idx, sets.length), 0, removed)
        return { ...e, sets }
      })),
    })
  }

  // ----- remover (com desfazer) -----
  const removeEntry = (id: string) => {
    const cur = latest.current
    const idx = cur.findIndex(e => e.id === id)
    if (idx < 0) return
    const entry = cur[idx]
    onChange(cur.filter(e => e.id !== id))
    toast(`${getExercise(entry.exerciseId).name} removido`, {
      label: 'Desfazer',
      run: () => {
        const now = latest.current
        if (now.some(e => e.id === id)) return
        const next = [...now]
        next.splice(Math.min(idx, next.length), 0, entry)
        onChange(next)
      },
    })
  }

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

  const openMenu = (entry: WorkoutExercise) => {
    const others = exercises.filter(e => e.id !== entry.id && (!entry.supersetId || e.supersetId !== entry.supersetId))
    actionSheet([
      { label: 'Substituir exercício', icon: 'swap', onSelect: () => setPicker({ replace: entry.id }) },
      ...(others.length ? [{
        label: entry.supersetId ? 'Adicionar outro ao superset' : 'Fazer superset com…', icon: 'link',
        onSelect: () => actionSheet(others.map(o => ({ label: getExercise(o.exerciseId).name, onSelect: () => joinSuperset(entry, o) })), 'Superset com'),
      }] : []),
      ...(entry.supersetId ? [{ label: 'Remover do superset', icon: 'link', onSelect: () => leaveSuperset(entry) }] : []),
      { label: 'Ver histórico e progresso', icon: 'history', onSelect: () => setViewing(entry.exerciseId) },
      ...(exercises.length > 1 ? [{ label: 'Reordenar exercícios', icon: 'grip', onSelect: () => setReorder({ auto: false }) }] : []),
      { label: 'Remover exercício', icon: 'trash', danger: true, onSelect: () => removeEntry(entry.id) },
    ], getExercise(entry.exerciseId).name)
  }

  return (
    <>
      {exercises.length > 0 && (
        <div className="small muted" style={{ margin: '0 4px 8px' }}>
          {exercises.length > 1 ? 'Segure o nome para reordenar · ' : ''}deslize o nome para remover o exercício, ou uma série para remover só ela
        </div>
      )}
      {exercises.map(entry => (
        <ExerciseCard key={entry.id} entry={entry} mode={mode} workoutId={workoutId}
          superset={ssInfo(entry)}
          onChange={patch => update(entry.id, patch)}
          onMenu={() => openMenu(entry)}
          onOpenDetail={() => setViewing(entry.exerciseId)}
          onRemove={() => removeEntry(entry.id)}
          onRemoveSet={setId => removeSet(entry.id, setId)}
          drag={exercises.length > 1 ? {
            start: y => startDrag(entry.id, y, true), move: moveDrag, end: endDrag,
          } : undefined} />
      ))}
      <button className="btn primary block" onClick={() => setPicker({})}><Icon name="plus" /> Adicionar exercício</button>
      <ExercisePicker open={!!picker} multi={!picker?.replace} title={picker?.replace ? 'Substituir exercício' : undefined}
        onClose={() => setPicker(null)}
        onPick={ids => (picker?.replace ? replace(picker.replace, ids[0]) : addExercises(ids))} />
      {reorder && (
        <ReorderLayer exercises={exercises} ssInfo={ssInfo} drag={drag} listRef={listRef} targetIndex={targetIndex}
          onStartDrag={(id, y) => startDrag(id, y, false)} onMoveDrag={moveDrag} onEndDrag={endDrag}
          showDone={!reorder.auto} onDone={() => closeReorder()} />
      )}
      {viewing && (
        <div className="overlay detail-layer">
          <ExerciseDetail key={viewing} id={viewing} embedded onBack={() => setViewing(null)} />
        </div>
      )}
    </>
  )
}

// ---------- lista compacta para reordenar (estilo arrastar e soltar) ----------

function ReorderLayer({ exercises, ssInfo, drag, listRef, targetIndex, onStartDrag, onMoveDrag, onEndDrag, showDone, onDone }: {
  exercises: WorkoutExercise[]
  ssInfo: (e: WorkoutExercise) => SsInfo | undefined
  drag: { id: string; y: number } | null
  listRef: RefObject<HTMLDivElement>
  targetIndex: (y: number) => number
  onStartDrag: (id: string, y: number) => void
  onMoveDrag: (y: number) => void
  onEndDrag: (cancelled?: boolean) => void
  showDone: boolean
  onDone: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [, rerender] = useState(0)
  const yRef = useRef<number | null>(null)
  yRef.current = drag?.y ?? null

  // mede a lista assim que ela aparece (as posições dependem do topo dela)
  useLayoutEffect(() => { rerender(n => n + 1) }, [])

  // rola sozinho quando o dedo chega perto das bordas
  useEffect(() => {
    if (!drag) return
    let raf = 0
    const tick = () => {
      const y = yRef.current, el = rootRef.current
      if (y !== null && el) {
        const edge = 80
        const dy = y < edge ? -Math.ceil((edge - y) / 6) : y > window.innerHeight - edge ? Math.ceil((y - window.innerHeight + edge) / 6) : 0
        if (dy) { el.scrollTop += dy; rerender(n => n + 1) }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [!!drag])

  const top = listRef.current?.getBoundingClientRect().top
  const from = drag ? exercises.findIndex(e => e.id === drag.id) : -1
  const to = drag && top !== undefined ? targetIndex(drag.y) : -1
  const H = REORDER_ROW_H

  return (
    <div ref={rootRef} className="reorder-layer" onScroll={() => rerender(n => n + 1)}>
      <div className="screen">
        <div className="topbar">
          <h1>Reordenar</h1>
          {showDone && <button className="btn primary sm" onClick={onDone}>Concluído</button>}
        </div>
        <div className="small muted" style={{ margin: '0 4px 12px' }}>
          {showDone ? 'Arraste os exercícios para mudar a ordem.' : 'Solte na posição desejada.'}
        </div>
        <div ref={listRef} style={{ position: 'relative', height: exercises.length * H }}>
          {exercises.map((e, j) => {
            const dragging = drag?.id === e.id
            let y = j * H
            if (dragging && top !== undefined) y = Math.max(-H / 2, Math.min((exercises.length - 1) * H + H / 2, drag!.y - top - H / 2))
            else if (from >= 0 && to >= 0) {
              if (from < j && j <= to) y -= H
              else if (to <= j && j < from) y += H
            }
            const ss = ssInfo(e)
            const done = e.sets.filter(s => s.done).length
            return (
              <div key={e.id} className={`reorder-row ${dragging ? 'dragging' : ''}`}
                style={{ transform: `translateY(${y}px)`, ...(ss ? ({ '--ss': ss.color } as CSSProperties) : {}) }}
                onContextMenu={ev => ev.preventDefault()}
                onTouchStart={ev => startRowDrag(ev, e.id)} onMouseDown={ev => startRowDrag(ev, e.id)}>
                {ss && <span className="ss-dot" aria-label={`Superset ${ss.letter}`}>{ss.letter}</span>}
                <span className="grow">
                  <span className="ellipsis" style={{ display: 'block', fontWeight: 700 }}>{getExercise(e.exerciseId).name}</span>
                  <small className="muted">{e.sets.length} {e.sets.length === 1 ? 'série' : 'séries'}{done ? ` · ${done} feitas` : ''}</small>
                </span>
                <Icon name="grip" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  function startRowDrag(ev: ReactTouchEvent | ReactMouseEvent, id: string) {
    const p = track(ev, {
      move: (pt, prevent) => { prevent(); onMoveDrag(pt.y) },
      end: (cancelled, prevent) => { prevent(); onEndDrag(cancelled) },
    })
    if (p) onStartDrag(id, p.y)
  }
}

// ---------- card do exercício ----------

function ExerciseCard({ entry, mode, workoutId, superset, onChange, onMenu, onOpenDetail, onRemove, onRemoveSet, drag }: {
  entry: WorkoutExercise
  mode: BlockMode
  workoutId?: string
  superset?: SsInfo
  onChange: (patch: Partial<WorkoutExercise>) => void
  onMenu: () => void
  onOpenDetail: () => void
  onRemove: () => void
  onRemoveSet: (setId: string) => void
  drag?: { start: (y: number) => void; move: (y: number) => void; end: (cancelled?: boolean) => void }
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  // deslize do exercício inteiro (pela faixa do nome, para qualquer lado)
  const [dx, setDx] = useState(0)
  const [swiping, setSwiping] = useState(false)
  // deslize de uma série (pela linha, para a esquerda)
  const [setSwipe, setSetSwipe] = useState<null | { id: string; dx: number; top: number; height: number; live: boolean }>(null)
  const suppressClick = useRef(false)
  const width = wrapRef.current?.offsetWidth ?? 320
  const swipeArmed = Math.abs(dx) > width * 0.4
  const setArmed = !!setSwipe && setSwipe.dx < -width * 0.4

  const onGestureStart = (e: ReactTouchEvent | ReactMouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('textarea') || target === document.activeElement) return
    if (!('touches' in e) && target.closest('input, select, button:not(.name)')) return
    suppressClick.current = false
    const inHeader = !!target.closest('.ex-title')
    const row = target.closest<HTMLElement>('tr[data-set]')
    if (!inHeader && !row) return // resto do card (botões, anotação) não desliza
    const setId = row?.dataset.set
    let phase: 'pending' | 'swipe' | 'drag' | 'none' = 'pending'
    let curDx = 0, start: Pt = { x: 0, y: 0 }, lastY = 0
    const timer = inHeader && drag ? setTimeout(() => {
      if (phase !== 'pending') return
      phase = 'drag'
      suppressClick.current = true
      drag.start(lastY)
    }, LONG_PRESS_MS) : undefined

    const rowBox = () => {
      const r = row!.getBoundingClientRect(), c = cardRef.current!.getBoundingClientRect()
      return { top: r.top - c.top, height: r.height }
    }

    const p = track(e, {
      move: (pt, prevent) => {
        lastY = pt.y
        const ddx = pt.x - start.x, ddy = pt.y - start.y
        if (phase === 'pending') {
          const horizontal = Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.3
          if (horizontal && (inHeader || ddx < 0)) {
            phase = 'swipe'; clearTimeout(timer)
            if (inHeader) setSwiping(true)
            else setSetSwipe({ id: setId!, dx: 0, ...rowBox(), live: true })
          } else if (Math.hypot(ddx, ddy) > 10) { phase = 'none'; clearTimeout(timer) }
        }
        if (phase === 'swipe') {
          prevent()
          if (inHeader) { curDx = ddx; setDx(curDx) }
          else { curDx = Math.min(0, ddx); setSetSwipe(s => (s ? { ...s, dx: curDx } : s)) }
        } else if (phase === 'drag') { prevent(); drag?.move(pt.y) }
      },
      end: (cancelled, prevent) => {
        clearTimeout(timer)
        if (phase === 'swipe') {
          prevent()
          suppressClick.current = true
          const w = wrapRef.current?.offsetWidth ?? 320
          const past = !cancelled && Math.abs(curDx) > w * 0.4
          if (inHeader) {
            setSwiping(false)
            if (past) { setDx(Math.sign(curDx) * w * 1.1); setTimeout(onRemove, 180) }
            else setDx(0)
          } else if (past && entry.sets.length > 1) {
            setSetSwipe(s => (s ? { ...s, dx: -w * 1.1, live: false } : s))
            setTimeout(() => { setSetSwipe(null); onRemoveSet(setId!) }, 160)
          } else {
            if (past) toast('Para remover o exercício, deslize o nome dele')
            setSetSwipe(s => (s ? { ...s, dx: 0, live: false } : s))
            setTimeout(() => setSetSwipe(null), 180)
          }
        } else if (phase === 'drag') {
          prevent()
          drag?.end(cancelled)
        }
      },
    })
    if (!p) { clearTimeout(timer); return }
    start = p
    lastY = p.y
  }
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
    <div ref={wrapRef} className="ex-wrap" data-entry={entry.id}
      onTouchStart={onGestureStart} onMouseDown={onGestureStart}
      onClickCapture={e => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false } }}>
      <div className={`ex-swipe-bg ${swipeArmed ? 'armed' : ''} ${dx > 0 ? 'left' : ''}`} style={{ opacity: dx ? 1 : 0 }} aria-hidden="true">
        <Icon name="trash" /> Remover exercício
      </div>
    <div ref={cardRef} className={`ex-card ${superset ? 'ss' : ''}`}
      style={{
        ...(superset ? ({ '--ss': superset.color } as CSSProperties) : {}),
        transform: dx ? `translateX(${dx}px)` : undefined,
        transition: swiping ? 'none' : 'transform .18s ease-out',
      }}>
      <div className="ex-title" onContextMenu={e => e.preventDefault()}>
        <button className="name ellipsis" onClick={onOpenDetail}>{ex.name}</button>
        <button className="icon-btn" aria-label="Anotação" onClick={() => setShowNotes(v => !v)}><Icon name="note" size={20} /></button>
        <button className="icon-btn" aria-label="Opções" onClick={onMenu}><Icon name="more" /></button>
      </div>
      {superset && <div className="ss-label" style={{ padding: '0 4px' }}><i /> Superset {superset.letter}</div>}
      {showNotes && (
        <textarea className="input plain small" rows={1} placeholder="Anotação…" value={entry.notes ?? ''}
          onChange={e => onChange({ notes: e.target.value })} style={{ padding: '4px', marginTop: 2 }} />
      )}
      {setSwipe && (
        <div className={`set-swipe-bg ${setArmed ? 'armed' : ''}`} style={{ top: setSwipe.top, height: setSwipe.height }} aria-hidden="true">
          <Icon name="trash" size={18} /> Remover série
        </div>
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
              <tr key={s.id} data-set={s.id}
                className={`${s.done && showDone ? 'done' : ''} ${valid ? 'valid' : 'not-valid'} ${setSwipe?.id === s.id ? 'swiping' : ''}`}
                style={setSwipe?.id === s.id ? ({ '--dx': `${setSwipe.dx}px`, '--sw-t': setSwipe.live ? 'none' : 'transform .16s ease-out' } as CSSProperties) : undefined}>
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
    </div>
  )
}
