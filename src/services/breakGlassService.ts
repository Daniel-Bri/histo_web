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

const BASE_PATH = 'seguridad/break-glass/'

export async function solicitarBreakGlass(payload: BreakGlassCreatePayload) {
  const { data } = await api.post<BreakGlassSolicitudItem>(`${BASE_PATH}solicitar/`, payload)
  return data
}

export async function listarMisSolicitudesBreakGlass() {
  const { data } = await api.get<BreakGlassSolicitudItem[]>(`${BASE_PATH}mis-solicitudes/`)
  return Array.isArray(data) ? data : []
}

