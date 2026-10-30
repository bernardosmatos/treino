import { useEffect, useState } from 'react'
import { Icon, UIHost } from './components/ui'
import { fmtClock } from './lib/format'
import { beginWorkout, cancelStart, openActive, setTab, useNav, type Tab } from './lib/nav'
import { latestBodyweight } from './lib/stats'
import { getActive, loadStore, scheduleSync, syncNow, useStoreVersion } from './lib/store'
import { supabase } from './lib/supabase'
import { ActiveWorkout, BodyweightSheet } from './screens/ActiveWorkout'
import { ExerciseDetail, Exercises } from './screens/Exercises'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Measurements, Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { RoutineEditor, Train } from './screens/Train'
import { EditWorkout, WorkoutDetail } from './screens/WorkoutDetail'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Início', icon: 'home' },
  { id: 'train', label: 'Treinar', icon: 'dumbbell' },
  { id: 'exercises', label: 'Exercícios', icon: 'list' },
  { id: 'progress', label: 'Progresso', icon: 'chart' },
]

type Auth = 'loading' | 'in' | 'out'

export function App() {
  const [loaded, setLoaded] = useState(false)
  const [auth, setAuth] = useState<Auth>(supabase ? 'loading' : 'in')

  useEffect(() => { loadStore().then(() => setLoaded(true)) }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setAuth(data.session ? 'in' : 'out'))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuth(session ? 'in' : 'out')
      if (session) scheduleSync(0)
    })
    const onFocus = () => { if (document.visibilityState === 'visible') syncNow() }
    const onOnline = () => syncNow()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('online', onOnline)
    const t = setInterval(() => syncNow(), 60_000)
    return () => {
      data.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('online', onOnline)
      clearInterval(t)
    }
  }, [])

  if (!loaded || auth === 'loading') return null
  if (auth === 'out') return <><Login /><UIHost /></>
  return <Main />
}

function Main() {
  useStoreVersion()
  const nav = useNav()
  const active = getActive()
  const top = nav.stack[nav.stack.length - 1]

  let screen
  if (top) {
    switch (top.name) {
      case 'workout': screen = <WorkoutDetail key={top.id} id={top.id} />; break
      case 'edit-workout': screen = <EditWorkout key={top.id} id={top.id} />; break
      case 'exercise': screen = <ExerciseDetail key={top.id} id={top.id} />; break
      case 'routine': screen = <RoutineEditor key={top.id ?? 'new'} id={top.id} />; break
      case 'measurements': screen = <Measurements />; break
      case 'settings': screen = <Settings />; break
    }
  } else {
    screen = { home: <Home />, train: <Train />, exercises: <Exercises />, progress: <Progress /> }[nav.tab]
  }

  return (
    <div className="app">
      {screen}
      {active && !nav.activeOpen && <ActiveBar startedAt={active.startedAt} name={active.name} />}
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={nav.tab === t.id && !top ? 'on' : ''} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={24} /> {t.label}
          </button>
        ))}
      </nav>
      {active && nav.activeOpen && <ActiveWorkout />}
      <BodyweightSheet
        open={!!nav.pendingStart}
        onClose={cancelStart}
        title="Antes de começar"
        intro="Qual é o seu peso hoje? Ele fica salvo nas medidas e no gráfico de peso corporal."
        initial={latestBodyweight()}
        skipLabel="Pular"
        saveLabel="Começar treino"
        onSave={v => beginWorkout(nav.pendingStart?.template, v)}
      />
      <UIHost />
    </div>
  )
}

function ActiveBar({ startedAt, name }: { startedAt: string; name: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return (
    <button className="active-bar" onClick={openActive}>
      <Icon name="dumbbell" />
      <span className="grow">
        <span className="ellipsis" style={{ display: 'block' }}>{name}</span>
        <small>Treino em andamento · {fmtClock(now - Date.parse(startedAt))}</small>
      </span>
      <Icon name="chevron" />
    </button>
  )
}
