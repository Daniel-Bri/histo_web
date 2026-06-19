import { api } from '../api/axiosConfig'

export async function registrarTokenFCM(token: string, plataforma: 'web' | 'android' | 'ios' = 'web') {
  await api.post('notificaciones/token/', { token, plataforma })
}

export async function eliminarTokenFCM(token: string) {
  await api.delete('notificaciones/token/eliminar/', { data: { token } })
}
