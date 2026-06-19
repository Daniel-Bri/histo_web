import { api } from '../api/axiosConfig'

export type BreakGlassUrgencia = 'ALTA' | 'MEDIA' | 'BAJA'
export type BreakGlassEstado = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'EXPIRADA'

export interface BreakGlassSolicitudItem {
  id: number
  tenant_id: number
  solicitante_id: number
  solicitante_username: string
  paciente_id: number
  paciente_ci: string
  paciente_nombre: string
  justificacion: string
  nivel_urgencia: BreakGlassUrgencia
  estado: BreakGlassEstado
  aprobado_por_id: number | null
  acceso_desde: string | null
  acceso_hasta: string | null
  acceso_activo: boolean
  acceso_expirado: boolean
  evento_blockchain_id: number | null
  creado_en: string
  actualizado_en: string
  advertencia?: string
}

export interface BreakGlassCreatePayload {
  paciente_id: number
  justificacion: string
  nivel_urgencia: BreakGlassUrgencia
}

export interface BreakGlassAprobarResponse {
  mensaje: string
  estado: BreakGlassEstado
  acceso_desde: string | null
  acceso_hasta: string | null
}

export interface BreakGlassRechazarPayload {
  motivo_rechazo: string
}

export interface BreakGlassRechazarResponse {
  mensaje: string
  estado: BreakGlassEstado
  motivo_rechazo: string
  notificacion?: Record<string, unknown>
}

const BASE_PATH = 'seguridad/break-glass/'

export async function solicitarBreakGlass(payload: BreakGlassCreatePayload) {
  const { data } = await api.post<BreakGlassSolicitudItem>(`${BASE_PATH}solicitar/`, payload)
  return data
}

export async function listarMisSolicitudesBreakGlass() {
  const { data } = await api.get<BreakGlassSolicitudItem[]>(`${BASE_PATH}mis-solicitudes/`)
  return Array.isArray(data) ? data : []
}

export async function listarPendientesBreakGlass() {
  const { data } = await api.get<BreakGlassSolicitudItem[]>(`${BASE_PATH}pendientes/`)
  return Array.isArray(data) ? data : []
}

export async function aprobarBreakGlass(id: number) {
  const { data } = await api.post<BreakGlassAprobarResponse>(`${BASE_PATH}${id}/aprobar/`)
  return data
}

export async function rechazarBreakGlass(id: number, payload: BreakGlassRechazarPayload) {
  const { data } = await api.post<BreakGlassRechazarResponse>(`${BASE_PATH}${id}/rechazar/`, payload)
  return data
}
