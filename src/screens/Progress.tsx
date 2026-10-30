import { useState } from 'react'
import { ColumnChart, HBars, LineChart } from '../components/Charts'
import { Icon, NumInput, Sheet, TopBar, confirmDialog } from '../components/ui'
import { MUSCLE_LABEL } from '../data/exercises'
import { fmtDateShort, fmtKg, fmtLocalDate, fmtNum, fmtVolume, fromLocalDate, localDate } from '../lib/format'
import { pop, push } from '../lib/nav'
import { finishedWorkouts, measurementsSorted, muscleSets, weeklyAgg, workoutDays } from '../lib/stats'
import { put, remove, uid, useStoreVersion } from '../lib/store'
import type { Measurement } from '../types'

const RANGES = [
  { label: '30 dias', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '1 ano', days: 365 },
  { label: 'Tudo', days: 0 },
]

function RangeChips({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="chips">
      {RANGES.map(r => <button key={r.label} className={`chip ${value === r.days ? 'on' : ''}`} onClick={() => onChange(r.days)}>{r.label}</button>)}
    </div>
  )
}

const inRange = (date: string, days: number) => !days || fromLocalDate(date).getTime() >= Date.now() - days * 864e5

export function Progress() {
  useStoreVersion()
  const [bwRange, setBwRange] = useState(90)
  const [muscleDays, setMuscleDays] = useState(30)
  const [volMetric, setVolMetric] = useState<'volume' | 'workouts' | 'sets'>('volume')
  const workouts = finishedWorkouts()
  const weeks = weeklyAgg(12, workouts)
  const bw = measurementsSorted().filter(m => m.weight && inRange(m.date, bwRange)).map(m => ({ t: fromLocalDate(m.date).getTime(), y: m.weight! }))
  const muscles = muscleSets(muscleDays, workouts)

  return (
    <div className="screen">
      <div className="topbar"><h1 style={{ fontSize: 30, fontWeight: 800 }}>Progresso</h1></div>

      <div className="section-title">Calendário</div>
      <div className="card"><Calendar /></div>

      <div className="section-title">
        Peso corporal
        <button className="btn ghost sm" onClick={() => push({ name: 'measurements' })}>Medidas <Icon name="chevron" size={14} /></button>
      </div>
      <RangeChips value={bwRange} onChange={setBwRange} />
      <div className="card">
        <LineChart data={bw} format={v => fmtKg(+v.toFixed(1))} />
      </div>

      <div className="section-title">Últimas 12 semanas</div>
      <div className="chips">
        {([['volume', 'Volume'], ['workouts', 'Treinos'], ['sets', 'Séries']] as const).map(([k, l]) => (
          <button key={k} className={`chip ${volMetric === k ? 'on' : ''}`} onClick={() => setVolMetric(k)}>{l}</button>
        ))}
      </div>
      <div className="card">
        <ColumnChart
          data={weeks.map(w => ({ label: fmtDateShort(w.start), title: `Semana de ${fmtDateShort(w.start)}`, y: w[volMetric] }))}
          format={v => (volMetric === 'volume' ? fmtVolume(v) : volMetric === 'workouts' ? `${v} ${v === 1 ? 'treino' : 'treinos'}` : `${v} séries`)}
        />
      </div>

      <div className="section-title">Séries por músculo</div>
      <div className="chips">
        {[7, 30, 90].map(d => <button key={d} className={`chip ${muscleDays === d ? 'on' : ''}`} onClick={() => setMuscleDays(d)}>{d} dias</button>)}
      </div>
      <div className="card">
        {muscles.length
          ? <HBars data={muscles.map(m => ({ label: MUSCLE_LABEL[m.muscle], value: m.sets }))} format={v => fmtNum(v)} />
          : <div className="muted small center-text" style={{ padding: 16 }}>Sem treinos no período.</div>}
        <div className="small muted" style={{ marginTop: 8 }}>Músculo secundário conta meia série. Séries não válidas não contam.</div>
      </div>
    </div>
  )
}

function Calendar() {
  const [offset, setOffset] = useState(0)
  const days = workoutDays()
  const base = new Date()
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  const first = (month.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const today = localDate()
  const cells = Array.from({ length: Math.ceil((first + count) / 7) * 7 }, (_, i) => {
    const d = i - first + 1
    return d >= 1 && d <= count ? new Date(month.getFullYear(), month.getMonth(), d) : null
  })
  const m = month.toLocaleDateString('pt-BR', { month: 'long' })
  const monthName = `${m[0].toUpperCase()}${m.slice(1)} de ${month.getFullYear()}`
  const total = cells.filter(c => c && days.has(localDate(c))).length

  return (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="icon-btn" aria-label="Mês anterior" onClick={() => setOffset(o => o - 1)}><Icon name="back" /></button>
        <div className="grow center-text" style={{ fontWeight: 700 }}>
          {monthName}<div className="small muted" style={{ fontWeight: 500 }}>{total} {total === 1 ? 'dia treinado' : 'dias treinados'}</div>
        </div>
        <button className="icon-btn" aria-label="Próximo mês" disabled={offset >= 0} style={{ opacity: offset >= 0 ? 0.3 : 1 }}
          onClick={() => setOffset(o => Math.min(0, o + 1))}><Icon name="chevron" /></button>
      </div>
      <div className="cal">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <div key={i} className="dow">{d}</div>)}
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="day out" />
          const k = localDate(c)
          const ws = days.get(k)
          return (
            <button key={i} className={`day ${ws ? 'has' : ''} ${k === today ? 'today' : ''}`}
              aria-label={`${c.getDate()}${ws ? `: ${ws.length} treino(s)` : ''}`}
              onClick={() => ws && push({ name: 'workout', id: ws[0].id })}>{c.getDate()}</button>
          )
        })}
      </div>
    </>
  )
}

// ---------- medidas ----------

const FIELDS: { key: keyof Omit<Measurement, 'id' | 'date'>; label: string; unit: string }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'bodyFat', label: 'Gordura corporal', unit: '%' },
  { key: 'waist', label: 'Cintura', unit: 'cm' },
  { key: 'chest', label: 'Peitoral', unit: 'cm' },
  { key: 'arm', label: 'Braço', unit: 'cm' },
  { key: 'thigh', label: 'Coxa', unit: 'cm' },
  { key: 'hip', label: 'Quadril', unit: 'cm' },
  { key: 'neck', label: 'Pescoço', unit: 'cm' },
  { key: 'calf', label: 'Panturrilha', unit: 'cm' },
]

export function Measurements() {
  useStoreVersion()
  const all = measurementsSorted()
  const [field, setField] = useState<(typeof FIELDS)[number]['key']>('weight')
  const [range, setRange] = useState(0)
  const [editing, setEditing] = useState<Measurement | null>(null)
  const f = FIELDS.find(x => x.key === field)!
  const points = all.filter(m => m[field] && inRange(m.date, range)).map(m => ({ t: fromLocalDate(m.date).getTime(), y: m[field]! }))
  const used = FIELDS.filter(x => all.some(m => m[x.key]))

  return (
    <div className="screen">
      <TopBar onBack={pop} title="Medidas" center
        right={<button className="icon-btn" aria-label="Nova medida" onClick={() => setEditing({ id: uid(), date: localDate() })}><Icon name="plus" /></button>} />
      <div className="chips">
        {(used.length ? used : FIELDS.slice(0, 1)).map(x => (
          <button key={x.key} className={`chip ${field === x.key ? 'on' : ''}`} onClick={() => setField(x.key)}>{x.label}</button>
        ))}
      </div>
      <RangeChips value={range} onChange={setRange} />
      <div className="card"><LineChart data={points} format={v => `${fmtNum(v)} ${f.unit}`} /></div>

      <button className="btn primary block" onClick={() => setEditing({ id: uid(), date: localDate() })}><Icon name="plus" /> Registrar medidas</button>

      <div className="section-title">Registros</div>
      {[...all].reverse().map(m => (
        <button key={m.id} className="card tap" onClick={() => setEditing(m)}>
          <div style={{ fontWeight: 700 }}>{fmtLocalDate(m.date)}</div>
          <div className="small text-2">
            {FIELDS.filter(x => m[x.key]).map(x => `${x.label}: ${fmtNum(m[x.key])} ${x.unit}`).join(' · ') || 'Sem valores'}
          </div>
        </button>
      ))}
      {editing && <MeasurementSheet m={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function MeasurementSheet({ m, onClose }: { m: Measurement; onClose: () => void }) {
  const [v, setV] = useState<Measurement>(m)
  const isNew = !measurementsSorted().some(x => x.id === m.id)
  const save = () => {
    // um registro por dia: mescla com o existente
    const sameDay = measurementsSorted().find(x => x.date === v.date && x.id !== v.id)
    if (sameDay) {
      const merged = { ...sameDay }
      FIELDS.forEach(f => { if (v[f.key] !== undefined) merged[f.key] = v[f.key] })
      put('measurements', merged)
      if (!isNew) remove('measurements', v.id)
    } else put('measurements', v)
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Registrar medidas' : 'Editar medidas'}>
      <label className="field"><span>Data</span>
        <input className="input" type="date" value={v.date} max={localDate()} onChange={e => e.target.value && setV({ ...v, date: e.target.value })} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
        {FIELDS.map(f => (
          <label key={f.key} className="field"><span>{f.label} ({f.unit})</span>
            <NumInput className="input" value={v[f.key]} onChange={n => setV({ ...v, [f.key]: n })} />
          </label>
        ))}
      </div>
      <div className="stack">
        <button className="btn primary block" onClick={save}>Salvar</button>
        {!isNew && (
          <button className="btn danger block" onClick={async () => {
            if (await confirmDialog('Excluir este registro?', { ok: 'Excluir', danger: true })) { remove('measurements', m.id); onClose() }
          }}>Excluir registro</button>
        )}
      </div>
    </Sheet>
  )
}
