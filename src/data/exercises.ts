import type { Equipment, Exercise, ExerciseKind, Muscle } from '../types'

export const MUSCLE_LABEL: Record<Muscle, string> = {
  peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps',
  antebraco: 'Antebraço', abdomen: 'Abdômen', lombar: 'Lombar', trapezio: 'Trapézio',
  quadriceps: 'Quadríceps', posteriores: 'Posteriores', gluteos: 'Glúteos',
  panturrilhas: 'Panturrilhas', adutores: 'Adutores', abdutores: 'Abdutores',
  cardio: 'Cardio', corpo: 'Corpo inteiro',
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barra: 'Barra', halter: 'Halter', maquina: 'Máquina', cabo: 'Cabo/Polia',
  peso_corporal: 'Peso corporal', kettlebell: 'Kettlebell', smith: 'Smith',
  elastico: 'Elástico', outro: 'Outro',
}

export const KIND_LABEL: Record<ExerciseKind, string> = {
  peso_reps: 'Carga e repetições',
  peso_corporal: 'Peso corporal (+ carga opcional)',
  tempo: 'Duração',
  distancia: 'Distância e duração',
}

type Row = [name: string, primary: Muscle, secondary: Muscle[], equipment: Equipment, kind?: ExerciseKind]

const ROWS: Row[] = [
  // Peito
  ['Supino reto (barra)', 'peito', ['triceps', 'ombros'], 'barra'],
  ['Supino reto (halter)', 'peito', ['triceps', 'ombros'], 'halter'],
  ['Supino inclinado (barra)', 'peito', ['ombros', 'triceps'], 'barra'],
  ['Supino inclinado (halter)', 'peito', ['ombros', 'triceps'], 'halter'],
  ['Supino declinado (barra)', 'peito', ['triceps'], 'barra'],
  ['Supino reto (Smith)', 'peito', ['triceps', 'ombros'], 'smith'],
  ['Supino inclinado (Smith)', 'peito', ['ombros', 'triceps'], 'smith'],
  ['Supino máquina', 'peito', ['triceps', 'ombros'], 'maquina'],
  ['Crucifixo reto (halter)', 'peito', [], 'halter'],
  ['Crucifixo inclinado (halter)', 'peito', ['ombros'], 'halter'],
  ['Crucifixo máquina (peck deck)', 'peito', [], 'maquina'],
  ['Crossover (polia alta)', 'peito', [], 'cabo'],
  ['Crossover (polia baixa)', 'peito', ['ombros'], 'cabo'],
  ['Flexão de braço', 'peito', ['triceps', 'ombros'], 'peso_corporal', 'peso_corporal'],
  ['Paralelas (peito)', 'peito', ['triceps', 'ombros'], 'peso_corporal', 'peso_corporal'],
  ['Pullover (halter)', 'peito', ['costas'], 'halter'],
  // Costas
  ['Barra fixa (pronada)', 'costas', ['biceps'], 'peso_corporal', 'peso_corporal'],
  ['Barra fixa (supinada)', 'costas', ['biceps'], 'peso_corporal', 'peso_corporal'],
  ['Puxada frontal (polia)', 'costas', ['biceps'], 'cabo'],
  ['Puxada triângulo (polia)', 'costas', ['biceps'], 'cabo'],
  ['Puxada supinada (polia)', 'costas', ['biceps'], 'cabo'],
  ['Remada curvada (barra)', 'costas', ['biceps', 'lombar'], 'barra'],
  ['Remada unilateral (halter)', 'costas', ['biceps'], 'halter'],
  ['Remada baixa (polia)', 'costas', ['biceps'], 'cabo'],
  ['Remada cavalinho (T-bar)', 'costas', ['biceps'], 'barra'],
  ['Remada máquina', 'costas', ['biceps'], 'maquina'],
  ['Remada articulada', 'costas', ['biceps'], 'maquina'],
  ['Pulldown braços estendidos (polia)', 'costas', [], 'cabo'],
  ['Levantamento terra', 'costas', ['posteriores', 'gluteos', 'lombar', 'trapezio'], 'barra'],
  ['Levantamento terra sumô', 'gluteos', ['quadriceps', 'posteriores', 'costas'], 'barra'],
  ['Hiperextensão lombar', 'lombar', ['gluteos', 'posteriores'], 'peso_corporal', 'peso_corporal'],
  ['Good morning (barra)', 'posteriores', ['lombar', 'gluteos'], 'barra'],
  // Ombros
  ['Desenvolvimento (barra)', 'ombros', ['triceps'], 'barra'],
  ['Desenvolvimento (halter)', 'ombros', ['triceps'], 'halter'],
  ['Desenvolvimento máquina', 'ombros', ['triceps'], 'maquina'],
  ['Desenvolvimento Arnold', 'ombros', ['triceps'], 'halter'],
  ['Elevação lateral (halter)', 'ombros', [], 'halter'],
  ['Elevação lateral (polia)', 'ombros', [], 'cabo'],
  ['Elevação lateral máquina', 'ombros', [], 'maquina'],
  ['Elevação frontal (halter)', 'ombros', [], 'halter'],
  ['Crucifixo inverso (halter)', 'ombros', ['costas'], 'halter'],
  ['Crucifixo inverso máquina', 'ombros', ['costas'], 'maquina'],
  ['Face pull (polia)', 'ombros', ['trapezio', 'costas'], 'cabo'],
  ['Remada alta (barra)', 'ombros', ['trapezio'], 'barra'],
  ['Encolhimento (barra)', 'trapezio', [], 'barra'],
  ['Encolhimento (halter)', 'trapezio', [], 'halter'],
  // Bíceps
  ['Rosca direta (barra)', 'biceps', ['antebraco'], 'barra'],
  ['Rosca direta (barra W)', 'biceps', ['antebraco'], 'barra'],
  ['Rosca alternada (halter)', 'biceps', ['antebraco'], 'halter'],
  ['Rosca martelo (halter)', 'biceps', ['antebraco'], 'halter'],
  ['Rosca concentrada (halter)', 'biceps', [], 'halter'],
  ['Rosca Scott (barra W)', 'biceps', [], 'barra'],
  ['Rosca Scott máquina', 'biceps', [], 'maquina'],
  ['Rosca inclinada (halter)', 'biceps', [], 'halter'],
  ['Rosca (polia)', 'biceps', ['antebraco'], 'cabo'],
  ['Rosca inversa (barra)', 'antebraco', ['biceps'], 'barra'],
  ['Rosca punho (barra)', 'antebraco', [], 'barra'],
  // Tríceps
  ['Tríceps pulley (barra)', 'triceps', [], 'cabo'],
  ['Tríceps corda (polia)', 'triceps', [], 'cabo'],
  ['Tríceps francês (halter)', 'triceps', [], 'halter'],
  ['Tríceps testa (barra W)', 'triceps', [], 'barra'],
  ['Tríceps acima da cabeça (polia)', 'triceps', [], 'cabo'],
  ['Tríceps coice (halter)', 'triceps', [], 'halter'],
  ['Supino fechado (barra)', 'triceps', ['peito', 'ombros'], 'barra'],
  ['Paralelas (tríceps)', 'triceps', ['peito', 'ombros'], 'peso_corporal', 'peso_corporal'],
  ['Mergulho no banco', 'triceps', ['peito'], 'peso_corporal', 'peso_corporal'],
  ['Tríceps máquina', 'triceps', [], 'maquina'],
  // Pernas
  ['Agachamento livre (barra)', 'quadriceps', ['gluteos', 'posteriores', 'lombar'], 'barra'],
  ['Agachamento frontal (barra)', 'quadriceps', ['gluteos'], 'barra'],
  ['Agachamento (Smith)', 'quadriceps', ['gluteos'], 'smith'],
  ['Agachamento hack', 'quadriceps', ['gluteos'], 'maquina'],
  ['Agachamento búlgaro (halter)', 'quadriceps', ['gluteos'], 'halter'],
  ['Agachamento goblet', 'quadriceps', ['gluteos'], 'kettlebell'],
  ['Agachamento sumô (halter)', 'gluteos', ['adutores', 'quadriceps'], 'halter'],
  ['Leg press 45°', 'quadriceps', ['gluteos'], 'maquina'],
  ['Leg press horizontal', 'quadriceps', ['gluteos'], 'maquina'],
  ['Cadeira extensora', 'quadriceps', [], 'maquina'],
  ['Afundo (halter)', 'quadriceps', ['gluteos'], 'halter'],
  ['Passada (halter)', 'quadriceps', ['gluteos'], 'halter'],
  ['Mesa flexora', 'posteriores', [], 'maquina'],
  ['Cadeira flexora', 'posteriores', [], 'maquina'],
  ['Flexora em pé', 'posteriores', [], 'maquina'],
  ['Stiff (barra)', 'posteriores', ['gluteos', 'lombar'], 'barra'],
  ['Stiff (halter)', 'posteriores', ['gluteos', 'lombar'], 'halter'],
  ['Levantamento terra romeno', 'posteriores', ['gluteos', 'lombar'], 'barra'],
  ['Elevação pélvica (barra)', 'gluteos', ['posteriores'], 'barra'],
  ['Elevação pélvica máquina', 'gluteos', ['posteriores'], 'maquina'],
  ['Glúteo na polia (coice)', 'gluteos', [], 'cabo'],
  ['Glúteo máquina', 'gluteos', [], 'maquina'],
  ['Cadeira abdutora', 'abdutores', ['gluteos'], 'maquina'],
  ['Cadeira adutora', 'adutores', [], 'maquina'],
  ['Panturrilha em pé (máquina)', 'panturrilhas', [], 'maquina'],
  ['Panturrilha sentado', 'panturrilhas', [], 'maquina'],
  ['Panturrilha no leg press', 'panturrilhas', [], 'maquina'],
  ['Panturrilha em pé (Smith)', 'panturrilhas', [], 'smith'],
  // Abdômen
  ['Abdominal (crunch)', 'abdomen', [], 'peso_corporal', 'peso_corporal'],
  ['Abdominal na polia', 'abdomen', [], 'cabo'],
  ['Abdominal máquina', 'abdomen', [], 'maquina'],
  ['Elevação de pernas (suspenso)', 'abdomen', [], 'peso_corporal', 'peso_corporal'],
  ['Elevação de pernas (deitado)', 'abdomen', [], 'peso_corporal', 'peso_corporal'],
  ['Abdominal infra no banco', 'abdomen', [], 'peso_corporal', 'peso_corporal'],
  ['Prancha', 'abdomen', ['lombar'], 'peso_corporal', 'tempo'],
  ['Prancha lateral', 'abdomen', [], 'peso_corporal', 'tempo'],
  ['Roda abdominal', 'abdomen', [], 'outro', 'peso_corporal'],
  ['Russian twist', 'abdomen', [], 'peso_corporal', 'peso_corporal'],
  // Corpo inteiro / outros
  ['Kettlebell swing', 'gluteos', ['posteriores', 'lombar'], 'kettlebell'],
  ['Clean (barra)', 'corpo', ['posteriores', 'trapezio', 'quadriceps'], 'barra'],
  ['Burpee', 'corpo', [], 'peso_corporal', 'peso_corporal'],
  ['Farmer walk', 'antebraco', ['trapezio', 'abdomen'], 'halter', 'tempo'],
  // Cardio
  ['Esteira', 'cardio', [], 'maquina', 'distancia'],
  ['Corrida', 'cardio', [], 'outro', 'distancia'],
  ['Bicicleta ergométrica', 'cardio', [], 'maquina', 'distancia'],
  ['Elíptico', 'cardio', [], 'maquina', 'distancia'],
  ['Remo ergômetro', 'cardio', ['costas'], 'maquina', 'distancia'],
  ['Escada', 'cardio', [], 'maquina', 'tempo'],
  ['Pular corda', 'cardio', [], 'outro', 'tempo'],
]

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export const BUILTIN_EXERCISES: Exercise[] = ROWS.map(([name, primary, secondary, equipment, kind]) => ({
  id: 'b-' + slug(name), name, primary, secondary, equipment, kind: kind ?? 'peso_reps',
}))
