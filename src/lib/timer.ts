import { useSyncExternalStore } from 'react'
import { getSettings } from './settings'

/**
 * Timer de descanso baseado em horário de término, então continua certo
 * mesmo se o iPhone pausar o app em segundo plano.
 */

interface RestState { endsAt: number; total: number }
let state: RestState | null = null
const listeners = new Set<() => void>()
let tick: ReturnType<typeof setInterval> | undefined
let audio: AudioContext | null = null

function emit() { listeners.forEach(l => l()) }

/** Precisa ser chamado dentro de um toque do usuário para o iOS liberar o som. */
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audio ??= new Ctor()
    if (audio.state === 'suspended') audio.resume()
  } catch { /* sem áudio */ }
}

function beep() {
  if (!audio || !getSettings().sound) return
  const t0 = audio.currentTime
  ;[0, 0.25, 0.5].forEach((dt, i) => {
    const o = audio!.createOscillator(), g = audio!.createGain()
    o.frequency.value = i === 2 ? 1320 : 880
    g.gain.setValueAtTime(0.0001, t0 + dt)
    g.gain.exponentialRampToValueAtTime(0.4, t0 + dt + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18)
    o.connect(g).connect(audio!.destination)
    o.start(t0 + dt); o.stop(t0 + dt + 0.2)
  })
}

function loop() {
  clearInterval(tick)
  tick = setInterval(() => {
    if (!state) { clearInterval(tick); return }
    if (Date.now() >= state.endsAt) {
      state = null
      beep()
      clearInterval(tick)
    }
    emit()
  }, 250)
}

export function startRest(seconds: number) {
  if (seconds <= 0) return
  unlockAudio()
  state = { endsAt: Date.now() + seconds * 1000, total: seconds }
  loop(); emit()
}

export function adjustRest(delta: number) {
  if (!state) return
  state = { endsAt: state.endsAt + delta * 1000, total: Math.max(1, state.total + delta) }
  if (state.endsAt <= Date.now()) state = null
  emit()
}

export function stopRest() { state = null; emit() }

const snapshot = () => state
export function useRest() {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, snapshot)
}

// ---------- manter a tela ligada durante o treino ----------

let lock: { release(): Promise<void> } | null = null
export async function keepAwake(on: boolean) {
  const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
  try {
    if (on && !lock && nav.wakeLock && getSettings().keepAwake) lock = await nav.wakeLock.request('screen')
    if (!on && lock) { await lock.release(); lock = null }
  } catch { lock = null }
}
document.addEventListener('visibilitychange', () => {
  // o iOS solta o wake lock ao sair do app; pede de novo ao voltar
  if (document.visibilityState === 'visible' && lock) { lock = null; keepAwake(true) }
})
