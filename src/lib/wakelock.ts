import { getSettings } from './settings'

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
