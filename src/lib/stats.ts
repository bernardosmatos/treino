import { BUILTIN_EXERCISES } from '../data/exercises'
import type { Exercise, ExerciseKind, Measurement, Muscle, WorkSet, Workout, WorkoutExercise } from '../types'
import { localDate } from './format'
import { list } from './store'

// ---------- exercícios ----------

let exCache: { src: unknown; map: Map<string, Exercise> } | null = null

export function exerciseMap(): Map<string, Exercise> {
  const custom = list('exercises')
  if (exCache?.src === custom) return exCache.map
  const map = new Map<string, Exercise>()
  BUILTIN_EXERCISES.forEach(e => map.set(e.id, e))
  custom.forEach(e => map.set(e.id, e))
  exCache = { src: custom, map }
  return map
}

export function getExercise(id: string): Exercise {
  return exerciseMap().get(id) ?? {
    id, name: 'Exercício removido', primary: 'corpo', secondary: [], equipment: 'outro', kind: 'peso_reps',
  }
}

export function allExercises(): Exercise[] {
  return [...exerciseMap().values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

// ---------- séries e volume ----------

export const isValidSet = (s: WorkSet) => s.type !== 'warmup' && s.valid !== false
export const isWorkingSet = (s: WorkSet) => isValidSet(s) && s.done !== false

/** 1RM estimado (Epley). */
export function e1rm(weight: number, reps: number) {
  if (!weight || !reps) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

export function setVolume(s: WorkSet, kind: ExerciseKind, bodyweight = 0) {
  if (!isWorkingSet(s) || !s.reps) return 0
  if (kind === 'peso_reps') return (s.weight ?? 0) * s.reps
  if (kind === 'peso_corporal') return (bodyweight + (s.weight ?? 0)) * s.reps
  return 0
}

export function finishedWorkouts(): Workout[] {
  return list('workouts').filter(w => w.endedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export function measurementsSorted(): Measurement[] {
  return [...list('measurements')].sort((a, b) => a.date.localeCompare(b.date))
}

/** Peso corporal registrado no treino ou, se não houver, a última medida até aquela data. */
export function bodyweightAt(w: Pick<Workout, 'bodyweight' | 'startedAt'>): number | undefined {
  if (w.bodyweight) return w.bodyweight
  const day = localDate(new Date(w.startedAt))
  let best: number | undefined
  for (const m of measurementsSorted()) {
    if (m.date > day) break
    if (m.weight) best = m.weight
  }
  return best
}

export function latestBodyweight(): number | undefined {
  const ms = measurementsSorted()
  for (let i = ms.length - 1; i >= 0; i--) if (ms[i].weight) return ms[i].weight
  return undefined
}

export function workoutVolume(w: Workout) {
  const bw = bodyweightAt(w) ?? 0
  return w.exercises.reduce((t, we) => {
    const kind = getExercise(we.exerciseId).kind
    return t + we.sets.reduce((s, set) => s + setVolume(set, kind, bw), 0)
  }, 0)
}

export function workoutSetCount(w: Workout) {
  return w.exercises.reduce((t, we) => t + we.sets.filter(isWorkingSet).length, 0)
}

export function workoutDurationMs(w: Workout) {
  return w.endedAt ? Date.parse(w.endedAt) - Date.parse(w.startedAt) : Date.now() - Date.parse(w.startedAt)
}

// ---------- histórico por exercício ----------

export interface Session {
  workout: Workout
  entry: WorkoutExercise
  bodyweight: number
}

/** Sessões (mais antiga primeiro) em que o exercício foi feito. */
export function sessionsFor(exerciseId: string, workouts = finishedWorkouts()): Session[] {
  const out: Session[] = []
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i]
    const bw = bodyweightAt(w) ?? 0
    w.exercises.forEach(entry => {
      if (entry.exerciseId === exerciseId && entry.sets.some(isWorkingSet)) out.push({ workout: w, entry, bodyweight: bw })
    })
  }
  return out
}

export interface Metrics {
  maxWeight: number
  best1rm: number
  bestSetVolume: number
  volume: number
  maxReps: number
  maxSeconds: number
  maxKm: number
}

export const EMPTY_METRICS: Metrics = { maxWeight: 0, best1rm: 0, bestSetVolume: 0, volume: 0, maxReps: 0, maxSeconds: 0, maxKm: 0 }

export function sessionMetrics(entry: WorkoutExercise, kind: ExerciseKind, bodyweight: number): Metrics {
  const m = { ...EMPTY_METRICS }
  for (const s of entry.sets) {
    if (!isWorkingSet(s)) continue
    const w = s.weight ?? 0, r = s.reps ?? 0
    const load = kind === 'peso_corporal' ? bodyweight + w : w
    const v = setVolume(s, kind, bodyweight)
    m.volume += v
    m.bestSetVolume = Math.max(m.bestSetVolume, v)
    m.maxReps = Math.max(m.maxReps, r)
    m.maxSeconds = Math.max(m.maxSeconds, s.seconds ?? 0)
    m.maxKm = Math.max(m.maxKm, s.km ?? 0)
    if (r > 0) {
      m.maxWeight = Math.max(m.maxWeight, w)
      if (kind === 'peso_reps' || (kind === 'peso_corporal' && w > 0)) m.best1rm = Math.max(m.best1rm, e1rm(load, r))
    }
  }
  return m
}

export function mergeMetrics(a: Metrics, b: Metrics): Metrics {
  return {
    maxWeight: Math.max(a.maxWeight, b.maxWeight),
    best1rm: Math.max(a.best1rm, b.best1rm),
    bestSetVolume: Math.max(a.bestSetVolume, b.bestSetVolume),
    volume: Math.max(a.volume, b.volume), // melhor volume em uma sessão
    maxReps: Math.max(a.maxReps, b.maxReps),
    maxSeconds: Math.max(a.maxSeconds, b.maxSeconds),
    maxKm: Math.max(a.maxKm, b.maxKm),
  }
}

export function bestMetrics(exerciseId: string, beforeIso?: string, excludeId?: string): { metrics: Metrics; count: number } {
  const kind = getExercise(exerciseId).kind
  let metrics = { ...EMPTY_METRICS }, count = 0
  for (const s of sessionsFor(exerciseId)) {
    if (excludeId && s.workout.id === excludeId) continue
    if (beforeIso && s.workout.startedAt >= beforeIso) continue
    metrics = mergeMetrics(metrics, sessionMetrics(s.entry, kind, s.bodyweight))
    count++
  }
  return { metrics, count }
}

export const METRIC_LABEL: Record<keyof Metrics, string> = {
  maxWeight: 'Maior carga',
  best1rm: '1RM estimado',
  bestSetVolume: 'Melhor série (volume)',
  volume: 'Volume na sessão',
  maxReps: 'Mais repetições',
  maxSeconds: 'Maior duração',
  maxKm: 'Maior distância',
}

export function metricsForKind(kind: ExerciseKind): (keyof Metrics)[] {
  switch (kind) {
    case 'peso_reps': return ['best1rm', 'maxWeight', 'bestSetVolume', 'volume', 'maxReps']
    case 'peso_corporal': return ['maxReps', 'maxWeight', 'volume']
    case 'tempo': return ['maxSeconds']
    case 'distancia': return ['maxKm', 'maxSeconds']
  }
}

export interface PR { exerciseId: string; metric: keyof Metrics; value: number }

/** Recordes batidos no treino, comparando com tudo que veio antes (precisa de histórico anterior). */
export function workoutPRs(w: Workout): PR[] {
  const prs: PR[] = []
  const bw = bodyweightAt(w) ?? 0
  const seen = new Set<string>()
  for (const entry of w.exercises) {
    if (seen.has(entry.exerciseId)) continue
    seen.add(entry.exerciseId)
    const ex = getExercise(entry.exerciseId)
    const prev = bestMetrics(entry.exerciseId, w.startedAt, w.id)
    if (!prev.count) continue
    const merged = w.exercises.filter(e => e.exerciseId === entry.exerciseId)
      .map(e => sessionMetrics(e, ex.kind, bw)).reduce(mergeMetrics, { ...EMPTY_METRICS })
    for (const k of metricsForKind(ex.kind)) {
      if (k === 'volume') continue
      if (merged[k] > 0 && merged[k] > prev.metrics[k] + 1e-9) prs.push({ exerciseId: entry.exerciseId, metric: k, value: merged[k] })
    }
  }
  return prs
}

/** Séries da última vez que o exercício foi feito (para mostrar na coluna "Anterior"). */
export function previousSets(exerciseId: string, excludeWorkoutId?: string): WorkSet[] {
  for (const w of finishedWorkouts()) {
    if (w.id === excludeWorkoutId) continue
    const entry = w.exercises.find(e => e.exerciseId === exerciseId && e.sets.length)
    if (entry) return entry.sets
  }
  return []
}

// ---------- agregados de calendário ----------

export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7 // segunda = 0
  x.setDate(x.getDate() - dow)
  return x
}

export interface WeekAgg { start: Date; volume: number; workouts: number; sets: number; minutes: number }

export function weeklyAgg(weeks: number, workouts = finishedWorkouts()): WeekAgg[] {
  const first = weekStart(new Date())
  first.setDate(first.getDate() - 7 * (weeks - 1))
  const out: WeekAgg[] = Array.from({ length: weeks }, (_, i) => {
    const s = new Date(first); s.setDate(first.getDate() + 7 * i)
    return { start: s, volume: 0, workouts: 0, sets: 0, minutes: 0 }
  })
  for (const w of workouts) {
    const idx = Math.floor((weekStart(new Date(w.startedAt)).getTime() - first.getTime()) / (7 * 864e5) + 0.5)
    if (idx < 0 || idx >= weeks) continue
    out[idx].volume += workoutVolume(w)
    out[idx].workouts++
    out[idx].sets += workoutSetCount(w)
    out[idx].minutes += workoutDurationMs(w) / 60000
  }
  return out
}

/** Semanas seguidas (até a atual) com pelo menos um treino. */
export function weekStreak(workouts = finishedWorkouts()) {
  const weeks = new Set(workouts.map(w => weekStart(new Date(w.startedAt)).getTime()))
  let cur = weekStart(new Date())
  if (!weeks.has(cur.getTime())) cur.setDate(cur.getDate() - 7) // semana atual ainda pode estar em aberto
  let n = 0
  while (weeks.has(cur.getTime())) { n++; cur = new Date(cur); cur.setDate(cur.getDate() - 7) }
  return n
}

/** Séries por músculo nos últimos `days` dias (secundário conta meia série). */
export function muscleSets(days: number, workouts = finishedWorkouts()): { muscle: Muscle; sets: number }[] {
  const since = Date.now() - days * 864e5
  const acc = new Map<Muscle, number>()
  for (const w of workouts) {
    if (Date.parse(w.startedAt) < since) continue
    for (const entry of w.exercises) {
      const ex = getExercise(entry.exerciseId)
      const n = entry.sets.filter(isWorkingSet).length
      if (!n) continue
      acc.set(ex.primary, (acc.get(ex.primary) ?? 0) + n)
      ex.secondary.forEach(m => acc.set(m, (acc.get(m) ?? 0) + n / 2))
    }
  }
  return [...acc.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets)
}

export function workoutDays(workouts = finishedWorkouts()) {
  const m = new Map<string, Workout[]>()
  workouts.forEach(w => {
    const k = localDate(new Date(w.startedAt))
    m.set(k, [...(m.get(k) ?? []), w])
  })
  return m
}

