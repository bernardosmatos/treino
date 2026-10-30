import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { fmtDateShort } from '../lib/format'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) { min -= 1; max += 1 }
  const span = max - min
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? 10 * mag
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6))
  return ticks
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const tickFmt = (v: number, max: number) => (max >= 10000 ? compact.format(v) : plain.format(v))

export interface Point { t: number; y: number }

/** Linha de uma série; tocar/arrastar mostra o valor do ponto no cabeçalho. */
export function LineChart({ data, format, height = 180, title }: {
  data: Point[]
  format: (y: number) => string
  height?: number
  title?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [sel, setSel] = useState<number | null>(null)
  if (!data.length) return <div className="muted small" style={{ padding: '24px 0', textAlign: 'center' }}>Sem dados ainda.</div>

  const padL = 40, padR = 12, padT = 10, padB = 24
  const ys = data.map(d => d.y)
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys))
  const yMin = ticks[0], yMax = ticks[ticks.length - 1]
  const tMin = data[0].t, tMax = data[data.length - 1].t
  const x = (t: number) => (tMax === tMin ? (padL + width - padR) / 2 : padL + ((t - tMin) / (tMax - tMin)) * (width - padL - padR))
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (height - padT - padB)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d.y).toFixed(1)}`).join('')
  const area = `${path}L${x(tMax)},${y(yMin)}L${x(tMin)},${y(yMin)}Z`
  const shown = sel ?? data.length - 1
  const p = data[shown]
  const first = data[0]

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    let best = 0, bd = Infinity
    data.forEach((d, i) => { const dd = Math.abs(x(d.t) - px); if (dd < bd) { bd = dd; best = i } })
    setSel(best)
  }

  const xLabels = data.length === 1 ? [first] : [first, data[data.length - 1]]

  return (
    <div ref={ref}>
      <div className="chart-head">
        <span className="v">{format(p.y)}</span>
        <span className="d">{fmtDateShort(new Date(p.t))}{title ? ` · ${title}` : ''}</span>
        {sel === null && data.length > 1 && (
          <span className="d" style={{ marginLeft: 'auto' }}>
            {p.y - first.y >= 0 ? '+' : '−'}{format(Math.abs(p.y - first.y))} no período
          </span>
        )}
      </div>
      <svg className="chart" width={width} height={height} role="img"
        aria-label={`Gráfico: último valor ${format(data[data.length - 1].y)}`}
        onPointerDown={pick} onPointerMove={e => e.buttons && pick(e)}>
        {ticks.map(t => (
          <g key={t}>
            <line className="grid" x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={padL - 6} y={y(t) + 4} textAnchor="end">{tickFmt(t, yMax)}</text>
          </g>
        ))}
        {xLabels.map((d, i) => (
          <text key={i} className="axis-text" x={x(d.t)} y={height - 6}
            textAnchor={xLabels.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}>{fmtDateShort(new Date(d.t))}</text>
        ))}
        {data.length > 1 && <path className="area" d={area} />}
        <path className="line" d={path} />
        {sel !== null && <line className="cross" x1={x(p.t)} x2={x(p.t)} y1={padT} y2={height - padB} />}
        {data.length <= 40 && data.map((d, i) => i !== shown && <circle key={i} className="dot" cx={x(d.t)} cy={y(d.y)} r={3} />)}
        <circle className="dot" cx={x(p.t)} cy={y(p.y)} r={5} />
      </svg>
    </div>
  )
}

/** Colunas verticais (ex.: volume por semana). */
export function ColumnChart({ data, format, height = 170 }: {
  data: { label: string; y: number; title?: string }[]
  format: (y: number) => string
  height?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [sel, setSel] = useState<number | null>(null)
  const padL = 40, padR = 4, padT = 10, padB = 24
  const ticks = niceTicks(0, Math.max(1, ...data.map(d => d.y)))
  const yMax = ticks[ticks.length - 1]
  const band = (width - padL - padR) / data.length
  const bw = Math.min(24, band * 0.6)
  const y = (v: number) => padT + (1 - v / yMax) * (height - padT - padB)
  const shown = sel ?? data.length - 1
  const r = 4

  const barPath = (x0: number, v: number) => {
    const top = y(v), base = y(0)
    if (base - top < 0.5) return ''
    const rr = Math.min(r, base - top, bw / 2)
    return `M${x0},${base}V${top + rr}Q${x0},${top} ${x0 + rr},${top}H${x0 + bw - rr}Q${x0 + bw},${top} ${x0 + bw},${top + rr}V${base}Z`
  }

  return (
    <div ref={ref}>
      <div className="chart-head">
        <span className="v">{format(data[shown]?.y ?? 0)}</span>
        <span className="d">{data[shown]?.title ?? data[shown]?.label}</span>
      </div>
      <svg className="chart" width={width} height={height} role="img" aria-label="Gráfico de colunas">
        {ticks.map(t => (
          <g key={t}>
            <line className="grid" x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={padL - 6} y={y(t) + 4} textAnchor="end">{tickFmt(t, yMax)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = padL + band * i + (band - bw) / 2
          return (
            <g key={i} onPointerDown={() => setSel(i)}>
              <rect x={padL + band * i} y={padT} width={band} height={height - padT} fill="transparent" />
              <path className={`bar ${i === shown ? '' : 'dim'}`} d={barPath(x0, d.y)} />
              {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                <text className="axis-text" x={x0 + bw / 2} y={height - 6} textAnchor="middle">{d.label}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Barras horizontais com rótulo e valor (ex.: séries por músculo). */
export function HBars({ data, format = v => plain.format(v) }: { data: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div>
      {data.map(d => (
        <div className="hbar" key={d.label}>
          <span className="ellipsis text-2">{d.label}</span>
          <div className="track"><div className="fill" style={{ width: `${(d.value / max) * 100}%` }} /></div>
          <span className="n">{format(d.value)}</span>
        </div>
      ))}
    </div>
  )
}
