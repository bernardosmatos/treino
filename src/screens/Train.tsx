import { useState } from 'react'
import { ExerciseBlocks } from '../components/ExerciseBlocks'
import { Empty, Icon, TopBar, actionSheet, confirmDialog, toast } from '../components/ui'
import { cloneExercises, pop, push, startWorkout } from '../lib/nav'
import { getExercise } from '../lib/stats'
import { getItem, list, put, remove, uid, useStoreVersion } from '../lib/store'
import type { Routine } from '../types'

export function Train() {
  useStoreVersion()
  const routines = [...list('routines')].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const menu = (r: Routine) => actionSheet([
    { label: 'Editar rotina', icon: 'edit', onSelect: () => push({ name: 'routine', id: r.id }) },
    {
      label: 'Duplicar', icon: 'copy', onSelect: () => {
        put('routines', { ...r, id: uid(), name: `${r.name} (cópia)`, createdAt: new Date().toISOString(), exercises: cloneExercises(r.exercises) })
        toast('Rotina duplicada')
      },
    },
    {
      label: 'Excluir rotina', icon: 'trash', danger: true, onSelect: async () => {
        if (await confirmDialog(`Excluir "${r.name}"?`, { message: 'Os treinos já feitos com ela continuam salvos.', ok: 'Excluir', danger: true })) remove('routines', r.id)
      },
    },
  ], r.name)

  return (
    <div className="screen">
      <div className="topbar"><h1 style={{ fontSize: 30, fontWeight: 800 }}>Treinar</h1></div>
      <button className="btn primary block" onClick={() => startWorkout()}><Icon name="plus" /> Começar treino vazio</button>

      <div className="section-title">
        Rotinas
        <button className="btn ghost sm" onClick={() => push({ name: 'routine' })}><Icon name="plus" size={16} /> Nova</button>
      </div>
      {routines.length === 0 && (
        <Empty icon="📋" title="Nenhuma rotina">
          <p>Rotinas são modelos de treino (ex.: "Peito e tríceps") para começar mais rápido.</p>
          <button className="btn" onClick={() => push({ name: 'routine' })}>Criar rotina</button>
        </Empty>
      )}
      {routines.map(r => (
        <div key={r.id} className="card">
          <div className="row">
            <h3 className="grow ellipsis" style={{ margin: 0 }}>{r.name}</h3>
            <button className="icon-btn" aria-label="Opções" onClick={() => menu(r)}><Icon name="more" /></button>
          </div>
          <div className="small text-2 ellipsis" style={{ margin: '2px 0 10px' }}>
            {r.exercises.map(e => getExercise(e.exerciseId).name).join(', ') || 'Sem exercícios'}
          </div>
          <button className="btn primary block" onClick={() => startWorkout(r)}><Icon name="play" size={16} /> Começar</button>
        </div>
      ))}
    </div>
  )
}

export function RoutineEditor({ id }: { id?: string }) {
  const existing = id ? getItem('routines', id) : undefined
  const [r, setR] = useState<Routine>(() => existing ? structuredClone(existing) : { id: uid(), name: '', exercises: [], createdAt: new Date().toISOString() })

  const save = () => {
    if (!r.name.trim()) { toast('Dê um nome à rotina'); return }
    if (!r.exercises.length) { toast('Adicione pelo menos um exercício'); return }
    put('routines', { ...r, name: r.name.trim() })
    toast(existing ? 'Rotina salva' : 'Rotina criada')
    pop()
  }

  return (
    <div className="screen">
      <TopBar onBack={pop} title={existing ? 'Editar rotina' : 'Nova rotina'} center right={<button className="btn primary sm" onClick={save}>Salvar</button>} />
      <input className="input plain" style={{ fontSize: 24, fontWeight: 800 }} placeholder="Nome da rotina" value={r.name}
        onChange={e => setR({ ...r, name: e.target.value })} autoFocus={!existing} />
      <textarea className="input plain text-2" rows={1} placeholder="Anotações…" value={r.notes ?? ''}
        onChange={e => setR({ ...r, notes: e.target.value })} style={{ margin: '4px 0 12px' }} />
      <p className="small muted" style={{ marginTop: 0 }}>Preencha as cargas e repetições alvo, se quiser. No treino elas já vêm preenchidas.</p>
      <ExerciseBlocks mode="template" exercises={r.exercises} onChange={exercises => setR({ ...r, exercises })} />
    </div>
  )
}
