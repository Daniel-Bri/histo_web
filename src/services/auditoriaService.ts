import { api, API_BASE_URL } from '../api/axiosConfig';
import type { BitacoraFilters, BitacoraResponse } from '../types/auditoria.types';

export const auditoriaService = {
  getBitacora: async (filters: BitacoraFilters): Promise<BitacoraResponse> => {
    const params = new URLSearchParams();
    if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
    if (filters.usuario) params.append('usuario', filters.usuario);
    if (filters.accion) params.append('accion', filters.accion);
    if (filters.modulo) params.append('modulo', filters.modulo);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.ordering) params.append('ordering', filters.ordering);

    const { data } = await api.get<BitacoraResponse>(`bitacora/?${params.toString()}`);
    return data;
  },

  getExportUrl: (filters: BitacoraFilters): string => {
    const params = new URLSearchParams();
    if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
    if (filters.usuario) params.append('usuario', filters.usuario);
    if (filters.accion) params.append('accion', filters.accion);
    if (filters.modulo) params.append('modulo', filters.modulo);
    
    // We need to pass the token because it's a direct download
    const token = localStorage.getItem('access_token');
    if (token) {
        params.append('token', token);
    }

    return `${API_BASE_URL}/bitacora/exportar/?${params.toString()}`;
  },

  // Alternatively, fetch the blob directly to handle auth via headers
  exportBitacora: async (filters: BitacoraFilters): Promise<Blob> => {
    const params = new URLSearchParams();
    if (filters.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
    if (filters.usuario) params.append('usuario', filters.usuario);
    if (filters.accion) params.append('accion', filters.accion);
    if (filters.modulo) params.append('modulo', filters.modulo);

    const { data } = await api.get(`bitacora/exportar/?${params.toString()}`, {
      responseType: 'blob'
    });
    return data;
  }
};
