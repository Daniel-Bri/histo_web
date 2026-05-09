import { api } from '../api/axiosConfig'
import type { FichaBrief } from '../types/triaje.types'

export interface FichaListResponse {
  count: number
  next: string | null
  previous: string | null
  results: FichaBrief[]
}

export interface FichaListParams {
  estado?: string
  paciente?: number
  en_curso?: boolean
  page?: number
  page_size?: number
  fecha_desde?: string
  fecha_hasta?: string
}

export const fichaService = {
  listar: (params?: FichaListParams) =>
    api.get<FichaListResponse>('fichas/', { params }),

  obtener: (id: number) =>
    api.get<FichaBrief>(`fichas/${id}/`),

  crear: (paciente_id: number) =>
    api.post<FichaBrief>('fichas/', { paciente_id }),

  cambiarEstado: (fichaId: number, estado: string) =>
    api.patch<FichaBrief>(`fichas/${fichaId}/cambiar-estado/`, { estado }),
}
