import { api } from '../api/axiosConfig'
import { PERMISOS } from '../api/endpoints'

export interface PermisoPaciente {
  id: number
  paciente_id: number
  paciente_ci: string
  paciente_nombre: string
  medico_id: number
  medico_username: string
  medico_nombre: string
  otorgado_por_id: number
  otorgado_por_username: string
  fecha_otorgamiento: string
  fecha_revocacion: string | null
  activo: boolean
  tenant_id: number
}

export async function listarPermisos(params?: {
  paciente_id?: number
  medico_id?: number
  activo?: boolean
}): Promise<PermisoPaciente[]> {
  const { data } = await api.get<PermisoPaciente[]>(PERMISOS.LISTAR, { params })
  return data
}

export async function otorgarPermiso(
  paciente_id: number,
  medico_id: number,
): Promise<PermisoPaciente> {
  const { data } = await api.post<PermisoPaciente>(PERMISOS.OTORGAR, { paciente_id, medico_id })
  return data
}

export async function revocarPermiso(
  paciente_id: number,
  medico_id: number,
): Promise<PermisoPaciente> {
  const { data } = await api.post<PermisoPaciente>(PERMISOS.REVOCAR, { paciente_id, medico_id })
  return data
}
