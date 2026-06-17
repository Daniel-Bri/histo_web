import { api } from '../api/axiosConfig'

export type OrdenEstado = 'SOLICITADA' | 'EN_PROCESO' | 'COMPLETADA' | 'ANULADA'

export interface OrdenEstudioListItem {
  id: number
  correlativo_orden: string
  tipo: string
  tipo_label: string
  urgente: boolean
  estado: OrdenEstado
  estado_label: string
  fecha_solicitud: string
  paciente_nombre: string
}

export interface OrdenEstudioDetail extends OrdenEstudioListItem {
  consulta_id: number
  descripcion: string
  indicacion_clinica: string
  motivo_urgencia: string | null
  medico_solicitante_nombre: string
  tecnico_responsable_nombre: string
  resultado_texto: string | null
  resultado_archivo: string | null
}

export interface ColaLaboratorioResponse {
  urgentes: OrdenEstudioListItem[]
  normales: OrdenEstudioListItem[]
  en_proceso: OrdenEstudioListItem[]
  total_pendientes: number
}

export interface CrearOrdenPayload {
  consulta_id: number
  tipo: 'LAB' | 'RX' | 'ECO' | 'TC' | 'RMN' | 'ECG' | 'END' | 'OTRO'
  descripcion: string
  indicacion_clinica: string
  urgente: boolean
  motivo_urgencia?: string
}

export interface ConsultaOption {
  id: number
  paciente?: number | string
  paciente_nombre?: string
  paciente_display?: string
  ficha?: number
  ficha_correlativo?: string
  motivo_consulta?: string
  impresion_diagnostica?: string
  codigo_cie10_principal?: string
  creado_en?: string
}

export interface ResultadoEstudioResponse {
  id: number
  orden: number
  fecha_resultado: string
  archivo_adjunto: string | null
  nombre_archivo: string
  valores_resultado: string
  interpretacion_medica: string
  hash_sha256: string
  creado_en: string
}

export async function crearOrdenEstudio(payload: CrearOrdenPayload) {
  const { data } = await api.post('ordenes-estudio/', payload)
  return data as {
    id: number
    correlativo_orden: string
    consulta: number
    paciente: string
    tipo: string
    descripcion: string
    urgente: boolean
    estado: string
    fecha_solicitud: string
    medico_solicitante: string
  }
}

export async function listarConsultasParaEstudio() {
  const { data } = await api.get<ConsultaOption[] | { results: ConsultaOption[] }>(
    'consultas/consultas/',
    { params: { estado: 'COMPLETADA' } },
  )
  if (Array.isArray(data)) return data
  if (data && 'results' in data && Array.isArray(data.results)) return data.results
  return []
}

export async function obtenerColaLaboratorio(): Promise<ColaLaboratorioResponse> {
  const { data } = await api.get<ColaLaboratorioResponse>('ordenes-estudio/cola-laboratorio/')
  return data
}

export async function obtenerOrdenDetalle(id: number): Promise<OrdenEstudioDetail> {
  const { data } = await api.get<OrdenEstudioDetail>(`ordenes-estudio/${id}/`)
  return data
}

export async function cambiarEstadoOrden(id: number, estado: OrdenEstado) {
  const { data } = await api.patch<OrdenEstudioDetail>(`ordenes-estudio/${id}/cambiar-estado/`, { estado })
  return data
}

export async function subirResultadoEstudio(payload: {
  orden: number
  fecha_resultado: string
  archivo_adjunto: File
  valores_resultado?: string
  interpretacion_medica?: string
}) {
  const form = new FormData()
  form.append('orden', String(payload.orden))
  form.append('fecha_resultado', payload.fecha_resultado)
  form.append('archivo_adjunto', payload.archivo_adjunto)
  if (payload.valores_resultado) form.append('valores_resultado', payload.valores_resultado)
  if (payload.interpretacion_medica) form.append('interpretacion_medica', payload.interpretacion_medica)
  const { data } = await api.post<ResultadoEstudioResponse>('resultados-estudio/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listarOrdenesPorFicha(fichaId: number): Promise<OrdenEstudioListItem[]> {
  const { data } = await api.get<OrdenEstudioListItem[] | { results: OrdenEstudioListItem[] }>(
    'ordenes-estudio/',
    { params: { ficha: fichaId } },
  )
  if (Array.isArray(data)) return data
  if (data && 'results' in data && Array.isArray(data.results)) return data.results
  return []
}
