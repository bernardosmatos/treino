import { useSyncExternalStore } from 'react'

export interface Settings {
  defaultRest: number
  sound: boolean
  keepAwake: boolean
  askBodyweight: boolean
}

const KEY = 'treino-settings'
const DEFAULTS: Settings = { defaultRest: 90, sound: true, keepAwake: true, askBodyweight: true }

function read(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
}

let current = read()
const listeners = new Set<() => void>()

export const getSettings = () => current

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* modo privado */ }
  listeners.forEach(l => l())
}

export function useSettings() {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, getSettings)
}
