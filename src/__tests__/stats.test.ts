import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))
vi.mock('../lib/supabase', () => ({ supabase: null }))

import { applyRemote, clearLocal, getItem, put } from '../lib/store'
import {
  bodyweightAt, e1rm, muscleSets, previousSets, weekStart, weekStreak, workoutPRs, workoutSetCount, workoutVolume,
} from '../lib/stats'
import type { Workout } from '../types'

const BENCH = 'b-supino-reto-barra'
const PULLUP = 'b-barra-fixa-pronada'

function workout(id: string, day: string, sets: [number, number][], extra: Partial<Workout> = {}): Workout {
  return {
    id, name: id, startedAt: `${day}T10:00:00.000Z`, endedAt: `${day}T11:00:00.000Z`,
    exercises: [{ id: id + 'e', exerciseId: BENCH, sets: sets.map(([weight, reps], i) => ({ id: `${id}s${i}`, type: 'normal', weight, reps, done: true })) }],
    ...extra,
  }
}

beforeEach(async () => { await clearLocal() })

describe('cálculos', () => {
  it('1RM estimado (Epley)', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1)
    expect(e1rm(0, 5)).toBe(0)
  })

  it('volume e séries ignoram aquecimento e séries não concluídas', () => {
    const w = workout('w1', '2026-10-01', [[100, 5], [100, 5]])
    w.exercises[0].sets.push({ id: 'wu', type: 'warmup', weight: 60, reps: 10, done: true })
    w.exercises[0].sets.push({ id: 'nd', type: 'normal', weight: 100, reps: 5, done: false })
    expect(workoutVolume(w)).toBe(1000)
    expect(workoutSetCount(w)).toBe(2)
  })

  it('série marcada como não válida não conta em volume, séries e recordes', () => {
    const w = workout('w1', '2026-10-01', [[100, 5]])
    w.exercises[0].sets.push({ id: 'nv', type: 'normal', valid: false, weight: 200, reps: 5, done: true })
    expect(workoutVolume(w)).toBe(500)
    expect(workoutSetCount(w)).toBe(1)
    put('workouts', workout('w0', '2026-09-01', [[100, 5]]))
    expect(workoutPRs(w)).toEqual([])
  })

  it('peso corporal entra no volume de exercício com peso corporal', () => {
    const w: Workout = {
      id: 'p', name: 'p', startedAt: '2026-10-01T10:00:00Z', endedAt: '2026-10-01T11:00:00Z', bodyweight: 80,
      exercises: [{ id: 'e', exerciseId: PULLUP, sets: [{ id: 's', type: 'normal', reps: 10, weight: 10, done: true }] }],
    }
    expect(workoutVolume(w)).toBe(900)
  })

  it('usa a medida mais recente quando o treino não tem peso', () => {
    put('measurements', { id: 'm1', date: '2026-09-01', weight: 82 })
    put('measurements', { id: 'm2', date: '2026-10-05', weight: 80 })
    expect(bodyweightAt({ startedAt: '2026-10-01T12:00:00Z' })).toBe(82)
    expect(bodyweightAt({ startedAt: '2026-10-06T12:00:00Z' })).toBe(80)
    expect(bodyweightAt({ startedAt: '2026-10-06T12:00:00Z', bodyweight: 79 })).toBe(79)
  })
})

describe('recordes e histórico', () => {
  it('detecta PR só quando supera o histórico anterior', () => {
    const w1 = workout('w1', '2026-10-01', [[100, 5]])
    const w2 = workout('w2', '2026-10-03', [[105, 5]])
    const w3 = workout('w3', '2026-10-05', [[90, 5]])
    ;[w1, w2, w3].forEach(w => put('workouts', w))
    expect(workoutPRs(w1)).toEqual([]) // primeira vez não conta
    expect(workoutPRs(w2).map(p => p.metric)).toContain('maxWeight')
    expect(workoutPRs(w3)).toEqual([])
  })

  it('"Anterior" vem do treino mais recente', () => {
    put('workouts', workout('w1', '2026-10-01', [[100, 5]]))
    put('workouts', workout('w2', '2026-10-03', [[105, 3]]))
    expect(previousSets(BENCH)[0].weight).toBe(105)
    expect(previousSets(BENCH, 'w2')[0].weight).toBe(100)
  })

  it('séries por músculo: secundário vale meia série', () => {
    put('workouts', workout('w1', new Date().toISOString().slice(0, 10), [[100, 5], [100, 5]]))
    const m = Object.fromEntries(muscleSets(7).map(x => [x.muscle, x.sets]))
    expect(m.peito).toBe(2)
    expect(m.triceps).toBe(1)
  })

  it('semana começa na segunda e sequência conta semanas seguidas', () => {
    expect(weekStart(new Date(2026, 9, 30)).getDay()).toBe(1) // sexta → segunda
    expect(weekStart(new Date(2026, 10, 1)).getDate()).toBe(26) // domingo pertence à semana anterior
    const now = new Date()
    const days = [0, 7, 14].map(d => { const x = new Date(now); x.setDate(x.getDate() - d); return x.toISOString() })
    days.forEach((d, i) => put('workouts', { ...workout('s' + i, '2026-01-01', [[50, 5]]), startedAt: d, endedAt: d }))
    expect(weekStreak()).toBe(3)
  })
})

describe('sincronização', () => {
  it('alteração local mais nova não é sobrescrita pela remota antiga', () => {
    put('routines', { id: 'r', name: 'Local', exercises: [], createdAt: '' })
    applyRemote({ collection: 'routines', id: 'r', data: { id: 'r', name: 'Remota' }, deleted: false, updated_at: '2020-01-01T00:00:00Z', server_updated_at: '' })
    expect(getItem('routines', 'r')?.name).toBe('Local')
  })

  it('remota mais nova vence e exclusões são aplicadas', () => {
    put('routines', { id: 'r', name: 'Local', exercises: [], createdAt: '' })
    applyRemote({ collection: 'routines', id: 'r', data: { id: 'r', name: 'Remota' }, deleted: false, updated_at: '2999-01-01T00:00:00Z', server_updated_at: '' })
    expect(getItem('routines', 'r')?.name).toBe('Remota')
    applyRemote({ collection: 'routines', id: 'r', data: null, deleted: true, updated_at: '2999-01-02T00:00:00Z', server_updated_at: '' })
    expect(getItem('routines', 'r')).toBeUndefined()
  })
})
