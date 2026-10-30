const nf = (max: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max })
const nf0 = nf(0), nf1 = nf(1), nf2 = nf(2)

export function fmtNum(n: number | undefined, digits = 1): string {
  if (n === undefined || !isFinite(n)) return ''
  return (digits === 0 ? nf0 : digits === 2 ? nf2 : nf1).format(n)
}

export function fmtKg(n: number | undefined) {
  return n === undefined ? '–' : `${fmtNum(n, 2)} kg`
}

export function fmtVolume(n: number) {
  return `${fmtNum(Math.round(n), 0)} kg`
}

/** Aceita "82,5" ou "82.5". Vazio/inválido → undefined. */
export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  return isFinite(n) ? n : undefined
}

export function fmtDuration(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60), m = totalMin % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function fmtRest(sec: number) {
  if (!sec) return 'Desligado'
  const m = Math.floor(sec / 60), s = sec % 60
  return m && s ? `${m}min ${s}s` : m ? `${m}min` : `${s}s`
}

export function fmtSeconds(sec: number | undefined) {
  if (!sec) return '–'
  const m = Math.floor(sec / 60), s = sec % 60
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

const dfLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
const dfYear = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
const dfShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const tf = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.getFullYear() === new Date().getFullYear() ? dfLong.format(d) : dfYear.format(d)
}
export const fmtDateShort = (d: Date | string) => dfShort.format(new Date(d))
export const fmtTime = (iso: string) => tf.format(new Date(iso))

/** Data local no formato AAAA-MM-DD. */
export function localDate(d: Date = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "2026-10-30" → Date às 00:00 locais (evita o fuso UTC do construtor). */
export function fromLocalDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function fmtLocalDate(s: string) {
  return fmtDate(fromLocalDate(s).toISOString())
}

/** Valor para <input type="datetime-local">. */
export function toDateTimeInput(iso: string) {
  const d = new Date(iso)
  return `${localDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
