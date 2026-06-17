import { api } from '../api/axiosConfig'
import type { Cobro, CrearSesionCobroPayload, CrearSesionCobroResponse } from '../types/cobro.types'

export const cobroService = {
  listarPorFicha: (fichaId: number) =>
    api.get<Cobro[]>('cobros/', { params: { ficha: fichaId } }),

  crearSesion: (payload: CrearSesionCobroPayload) =>
    api.post<CrearSesionCobroResponse>('cobros/crear-sesion/', payload),

  anular: (cobroId: number) =>
    api.post<Cobro>(`cobros/${cobroId}/anular/`),
}