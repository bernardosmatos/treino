import { useSyncExternalStore } from 'react'
import type { Routine, Workout, WorkoutExercise } from '../types'
import { getActive, setActive, uid, put, getItem, list } from './store'
import { confirmDialog } from '../components/ui'
import { localDate } from './format'
import { keepAwake, stopRest } from './timer'
import { getSettings } from './settings'

export type Tab = 'home' | 'train' | 'exercises' | 'progress'

export type Route =
  | { name: 'workout'; id: string }
  | { name: 'edit-workout'; id: string }
  | { name: 'exercise'; id: string }
  | { name: 'routine'; id?: string; fromWorkoutId?: string }
  | { name: 'measurements' }
  | { name: 'settings' }

interface NavState {
  tab: Tab
  stack: Route[]
  activeOpen: boolean
  pendingStart: { template?: { name: string; routineId?: string; exercises: WorkoutExercise[] } } | null
}

let state: NavState = { tab: 'home', stack: [], activeOpen: false, pendingStart: null }
const subs = new Set<() => void>()
function set(patch: Partial<NavState>) {
  state = { ...state, ...patch }
  subs.forEach(s => s())
  if (patch.stack || patch.activeOpen !== undefined || patch.tab) window.scrollTo(0, 0)
}

export function useNav() {
  return useSyncExternalStore(l => { subs.add(l); return () => { subs.delete(l) } }, () => state)
}

export const setTab = (tab: Tab) => set({ tab, stack: [] })
export const push = (r: Route) => set({ stack: [...state.stack, r] })
export const pop = () => set({ stack: state.stack.slice(0, -1) })
export const replaceTop = (r: Route) => set({ stack: [...state.stack.slice(0, -1), r] })
export const openActive = () => set({ activeOpen: true })
export const closeActive = () => set({ activeOpen: false })

/** Copia exercícios de uma rotina/treino com novos ids e séries não concluídas. */
export function cloneExercises(src: WorkoutExercise[]): WorkoutExercise[] {
  const ssMap = new Map<string, string>()
  const ss = (id?: string) => {
    if (!id) return undefined
    if (!ssMap.has(id)) ssMap.set(id, uid())
    return ssMap.get(id)
  }
  return src.map(e => ({
    ...e,
    id: uid(),
    supersetId: ss(e.supersetId),
    sets: e.sets.map(s => ({ ...s, id: uid(), done: false })),
  }))
}

/** Inicia um treino (vazio, de rotina ou repetindo um anterior). Pergunta o peso antes. */
export async function startWorkout(from?: Routine | Workout) {
  if (getActive()) {
    const ok = await confirmDialog('Já existe um treino em andamento', {
      message: 'Deseja descartá-lo e começar outro?', ok: 'Descartar e começar', danger: true,
    })
    if (!ok) { openActive(); return }
    discardActive()
  }
  const template = from
    ? { name: from.name, routineId: 'createdAt' in from ? from.id : from.routineId, exercises: from.exercises }
    : undefined
  if (getSettings().askBodyweight) set({ pendingStart: { template } })
  else beginWorkout(template, undefined)
}

export function cancelStart() { set({ pendingStart: null }) }

export function beginWorkout(template: NonNullable<NavState['pendingStart']>['template'], bodyweight: number | undefined) {
  if (bodyweight) recordBodyweight(bodyweight)
  const w: Workout = {
    id: uid(),
    name: template?.name ?? defaultName(),
    routineId: template?.routineId,
    startedAt: new Date().toISOString(),
    bodyweight,
    exercises: template ? cloneExercises(template.exercises) : [],
  }
  setActive(w)
  keepAwake(true)
  set({ pendingStart: null, activeOpen: true })
}

/** Salva o peso do dia nas medidas (atualiza se já houver registro hoje). */
export function recordBodyweight(weight: number, date = localDate()) {
  const existing = list('measurements').find(m => m.date === date)
  put('measurements', existing ? { ...existing, weight } : { id: uid(), date, weight })
}

export function discardActive() {
  setActive(null)
  stopRest()
  keepAwake(false)
  set({ activeOpen: false })
}

function defaultName() {
  const h = new Date().getHours()
  return h < 12 ? 'Treino da manhã' : h < 18 ? 'Treino da tarde' : 'Treino da noite'
}

export function routineExists(id?: string) {
  return !!id && !!getItem('routines', id)
}
