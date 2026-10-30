import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

// ---------- ícones ----------

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5 10 17.5 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5 8 12l7 7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.7l6.2-.9z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  cloud: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z',
  cloudOff: 'M3 3l18 18M8.5 8.4A5 5 0 0 0 7 18h10M15 7a6 6 0 0 1 4 3 4 4 0 0 1 1.6 7',
  scale: 'M5 20h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1zM8 9a4 4 0 0 1 8 0zM12 9l1.5-2',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  play: 'M7 4v16l13-8z',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6',
  chevron: 'M9 5l7 7-7 7',
  ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
}

export function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  const filled = name === 'play'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

// ---------- topo ----------

export function TopBar({ title, onBack, right, center }: { title?: ReactNode; onBack?: () => void; right?: ReactNode; center?: boolean }) {
  return (
    <div className="topbar">
      {onBack && <button className="icon-btn" onClick={onBack} aria-label="Voltar"><Icon name="back" /></button>}
      {center ? <div className="center ellipsis">{title}</div> : <h1>{title}</h1>}
      {right}
      {center && !right && onBack && <span style={{ width: 40 }} />}
    </div>
  )
}

// ---------- sheet ----------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

// ---------- diálogos imperativos ----------

export interface MenuAction { label: string; icon?: string; danger?: boolean; onSelect: () => void }

type Dialog =
  | { kind: 'confirm'; title: string; message?: string; ok: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: 'menu'; title?: string; actions: MenuAction[] }

let dialog: Dialog | null = null
let toastMsg: string | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach(s => s())
const sub = (l: () => void) => { subs.add(l); return () => { subs.delete(l) } }

export function confirmDialog(title: string, opts: { message?: string; ok?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise(resolve => {
    dialog = { kind: 'confirm', title, message: opts.message, ok: opts.ok ?? 'Confirmar', danger: opts.danger, resolve }
    emit()
  })
}

export function actionSheet(actions: MenuAction[], title?: string) {
  dialog = { kind: 'menu', title, actions }
  emit()
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(msg: string) {
  toastMsg = msg
  emit()
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg = null; emit() }, 2600)
}

export function UIHost() {
  const d = useSyncExternalStore(sub, () => dialog)
  const t = useSyncExternalStore(sub, () => toastMsg)
  const close = () => { dialog = null; emit() }
  return (
    <>
      {t && <div className="toast" role="status">{t}</div>}
      {d?.kind === 'confirm' && (
        <Sheet open onClose={() => { d.resolve(false); close() }} title={d.title}>
          {d.message && <p className="text-2" style={{ marginTop: 0 }}>{d.message}</p>}
          <div className="stack">
            <button className="btn block primary"
              style={d.danger ? { background: 'var(--danger)' } : undefined}
              onClick={() => { d.resolve(true); close() }}>{d.ok}</button>
            <button className="btn block" onClick={() => { d.resolve(false); close() }}>Cancelar</button>
          </div>
        </Sheet>
      )}
      {d?.kind === 'menu' && (
        <Sheet open onClose={close} title={d.title}>
          {d.actions.map(a => (
            <button key={a.label} className={`menu-item ${a.danger ? 'danger' : ''}`} onClick={() => { close(); a.onSelect() }}>
              {a.icon && <Icon name={a.icon} />} {a.label}
            </button>
          ))}
          <button className="btn block" style={{ marginTop: 10 }} onClick={close}>Cancelar</button>
        </Sheet>
      )}
    </>
  )
}

// ---------- entrada numérica ----------

/** Campo numérico que aceita vírgula e só confirma o valor ao sair ou digitar. */
export function NumInput({ value, onChange, placeholder, className = 'cell-input', decimal = true, ariaLabel, autoFocus }: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  className?: string
  decimal?: boolean
  ariaLabel?: string
  autoFocus?: boolean
}) {
  const fmt = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(fmt(value)) }, [value, focused])
  return (
    <input
      className={className}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      onFocus={e => { setFocused(true); e.currentTarget.select() }}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const raw = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '')
        setText(raw)
        const n = Number(raw.replace(',', '.'))
        onChange(raw === '' || !isFinite(n) ? undefined : n)
      }}
    />
  )
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}
