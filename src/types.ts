export type Muscle =
  | 'peito' | 'costas' | 'ombros' | 'biceps' | 'triceps' | 'antebraco'
  | 'abdomen' | 'lombar' | 'trapezio' | 'quadriceps' | 'posteriores'
  | 'gluteos' | 'panturrilhas' | 'adutores' | 'abdutores' | 'cardio' | 'corpo'

export type Equipment =
  | 'barra' | 'halter' | 'maquina' | 'cabo' | 'peso_corporal' | 'kettlebell'
  | 'smith' | 'elastico' | 'outro'

/**
 * peso_reps:      carga × repetições
 * peso_corporal:  repetições com carga extra opcional (o peso corporal entra no volume)
 * tempo:          duração (prancha, etc.)
 * distancia:      distância + duração (corrida, bike)
 */
export type ExerciseKind = 'peso_reps' | 'peso_corporal' | 'tempo' | 'distancia'

export interface Exercise {
  id: string
  name: string
  primary: Muscle
  secondary: Muscle[]
  equipment: Equipment
  kind: ExerciseKind
  custom?: boolean
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure'

export interface WorkSet {
  id: string
  type: SetType
  /** false = série de aquecimento/preparação; soma volume, mas não vira recorde. Ausente = válida. */
  valid?: boolean
  weight?: number
  reps?: number
  rpe?: number
  seconds?: number
  km?: number
  done?: boolean
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  supersetId?: string
  notes?: string
  sets: WorkSet[]
}

export interface Routine {
  id: string
  name: string
  notes?: string
  exercises: WorkoutExercise[]
  createdAt: string
}

export interface Workout {
  id: string
  name: string
  routineId?: string
  startedAt: string
  endedAt?: string
  bodyweight?: number
  notes?: string
  exercises: WorkoutExercise[]
}

export interface Measurement {
  id: string
  date: string // AAAA-MM-DD
  weight?: number
  bodyFat?: number
  neck?: number
  chest?: number
  waist?: number
  hip?: number
  arm?: number
  thigh?: number
  calf?: number
}

export interface Collections {
  exercises: Exercise
  routines: Routine
  workouts: Workout
  measurements: Measurement
}
export type CollectionName = keyof Collections
