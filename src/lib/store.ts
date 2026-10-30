import { get, set, del } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import type { CollectionName, Collections, Workout } from '../types'
import { supabase } from './supabase'

/**
 * Armazenamento offline-first.
 * Tudo vive em memória + IndexedDB; registros alterados ficam marcados como "dirty"
 * e são enviados para a tabela `records` do Supabase quando há conexão.
 * Conflitos: vence a alteração mais recente (updatedAt), garantido também no servidor.
 */

export interface Rec {
  collection: CollectionName
  id: string
  data: unknown
  deleted: boolean
  updatedAt: string
}

interface Persisted {
  records: Rec[]
  dirty: string[]
  cursor: string | null
  lastSync: string | null
  active: Workout | null
}

const DB_KEY = 'treino-db-v1'
const keyOf = (c: string, id: string) => `${c}/${id}`

const records = new Map<string, Rec>()
const dirty = new Set<string>()
let cursor: string | null = null
let lastSync: string | null = null
let active: Workout | null = null

let version = 0
const listeners = new Set<() => void>()
const cache = new Map<string, { v: number; list: unknown[] }>()

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline'
let syncState: SyncState = supabase ? 'idle' : 'off'
let syncError = ''

function emit() {
  version++
  listeners.forEach(l => l())
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, 300)
}
async function persist() {
  const data: Persisted = { records: [...records.values()], dirty: [...dirty], cursor, lastSync, active }
  try { await set(DB_KEY, data) } catch (e) { console.error('Falha ao salvar localmente', e) }
}

export async function loadStore() {
  const data = (await get(DB_KEY)) as Persisted | undefined
  if (data) {
    data.records.forEach(r => records.set(keyOf(r.collection, r.id), r))
    data.dirty.forEach(k => dirty.add(k))
    cursor = data.cursor
    lastSync = data.lastSync
    active = data.active
  }
  emit()
}

// Garante gravação ao sair/ir para segundo plano (iOS pode encerrar o app sem aviso).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(saveTimer); persist() }
  })
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
const getVersion = () => version

/** Re-renderiza o componente a cada mudança no armazenamento. */
export function useStoreVersion() {
  return useSyncExternalStore(subscribe, getVersion)
}

export function list<C extends CollectionName>(c: C): Collections[C][] {
  const hit = cache.get(c)
  if (hit && hit.v === version) return hit.list as Collections[C][]
  const out: Collections[C][] = []
  for (const r of records.values()) if (r.collection === c && !r.deleted) out.push(r.data as Collections[C])
  cache.set(c, { v: version, list: out })
  return out
}

export function getItem<C extends CollectionName>(c: C, id: string): Collections[C] | undefined {
  const r = records.get(keyOf(c, id))
  return r && !r.deleted ? (r.data as Collections[C]) : undefined
}

function write(c: CollectionName, id: string, data: unknown, deleted: boolean) {
  const k = keyOf(c, id)
  records.set(k, { collection: c, id, data, deleted, updatedAt: new Date().toISOString() })
  dirty.add(k)
  emit()
  scheduleSave()
  scheduleSync()
}

export function put<C extends CollectionName>(c: C, item: Collections[C]) {
  write(c, item.id, item, false)
}

export function remove(c: CollectionName, id: string) {
  write(c, id, null, true)
}

// ---------- treino em andamento (só local) ----------

export function getActive() { return active }
export function setActive(w: Workout | null) {
  active = w
  emit()
  scheduleSave()
}

// ---------- sincronização ----------

export function getSyncInfo() {
  return { state: syncState, error: syncError, lastSync, pending: dirty.size }
}

function setSync(s: SyncState, err = '') {
  syncState = s
  syncError = err
  emit()
}

let syncTimer: ReturnType<typeof setTimeout> | undefined
export function scheduleSync(delay = 1500) {
  if (!supabase) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => { syncNow() }, delay)
}

let running: Promise<void> | null = null
export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (running) return running
  running = doSync().finally(() => { running = null })
  return running
}

interface Row {
  collection: CollectionName
  id: string
  data: unknown
  deleted: boolean
  updated_at: string
  server_updated_at: string
}

async function doSync() {
  const sb = supabase!
  if (!navigator.onLine) { setSync('offline'); return }
  const { data: sess } = await sb.auth.getSession()
  const user = sess.session?.user
  if (!user) return
  setSync('syncing')
  try {
    // 1) envia alterações locais
    const pendingKeys = [...dirty]
    for (let i = 0; i < pendingKeys.length; i += 500) {
      const chunk = pendingKeys.slice(i, i + 500)
        .map(k => records.get(k))
        .filter((r): r is Rec => !!r)
      if (!chunk.length) continue
      const { error } = await sb.from('records').upsert(
        chunk.map(r => ({
          user_id: user.id, collection: r.collection, id: r.id,
          data: r.data, deleted: r.deleted, updated_at: r.updatedAt,
        })),
        { onConflict: 'user_id,collection,id' },
      )
      if (error) throw error
      // só limpa se não houve nova edição durante o envio
      chunk.forEach(sent => {
        const k = keyOf(sent.collection, sent.id)
        if (records.get(k)?.updatedAt === sent.updatedAt) dirty.delete(k)
      })
    }

    // 2) baixa alterações do servidor
    let newCursor = cursor
    for (let from = 0; ; from += 1000) {
      let q = sb.from('records')
        .select('collection,id,data,deleted,updated_at,server_updated_at')
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (cursor) q = q.gt('server_updated_at', cursor)
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as Row[]
      rows.forEach(applyRemote)
      if (rows.length) newCursor = rows[rows.length - 1].server_updated_at
      if (rows.length < 1000) break
    }
    cursor = newCursor
    lastSync = new Date().toISOString()
    scheduleSave()
    setSync('idle')
  } catch (e) {
    console.error('Erro de sincronização', e)
    setSync(navigator.onLine ? 'error' : 'offline', e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
  }
}

export function applyRemote(row: Row) {
  const k = keyOf(row.collection, row.id)
  const local = records.get(k)
  if (local && dirty.has(k) && Date.parse(local.updatedAt) > Date.parse(row.updated_at)) return
  records.set(k, {
    collection: row.collection, id: row.id, data: row.data,
    deleted: row.deleted, updatedAt: row.updated_at,
  })
  dirty.delete(k)
}

/** Esquece o cursor e baixa tudo de novo do servidor. */
export async function resyncAll() {
  cursor = null
  await syncNow()
}

/** Apaga todos os dados locais (usado ao sair da conta). */
export async function clearLocal() {
  records.clear(); dirty.clear(); cursor = null; lastSync = null; active = null
  await del(DB_KEY)
  emit()
}

// ---------- backup ----------

export function exportBackup() {
  const out: Record<string, unknown[]> = {}
  for (const r of records.values()) {
    if (r.deleted) continue
    ;(out[r.collection] ??= []).push(r.data)
  }
  return { app: 'treino', version: 1, exportedAt: new Date().toISOString(), data: out }
}

export function importBackup(json: unknown): number {
  const b = json as { app?: string; data?: Record<string, { id: string }[]> }
  if (b?.app !== 'treino' || !b.data) throw new Error('Arquivo de backup inválido')
  let n = 0
  const valid: CollectionName[] = ['exercises', 'routines', 'workouts', 'measurements']
  for (const c of valid) {
    for (const item of b.data[c] ?? []) {
      if (!item?.id) continue
      const k = keyOf(c, item.id)
      records.set(k, { collection: c, id: item.id, data: item, deleted: false, updatedAt: new Date().toISOString() })
      dirty.add(k)
      n++
    }
  }
  emit(); scheduleSave(); scheduleSync(0)
  return n
}

export function uid() {
  // randomUUID só existe em contexto seguro (https); em http na rede local cai no fallback
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
