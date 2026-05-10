export type AuditoriaAccion = 'CREAR' | 'LEER' | 'ACTUALIZAR' | 'ELIMINAR' | 'LOGIN' | 'LOGOUT' | 'EXPORTAR';

export type AuditoriaModulo = 'ATENCION_CLINICA' | 'USUARIOS' | 'PACIENTES' | 'INVENTARIO' | 'REPORTES' | 'CONFIGURACION' | 'APERTURA_FICHA';

export interface BitacoraEntry {
  id: number;
  timestamp: string; // ISO 8601
  usuario_username: string;
  accion: AuditoriaAccion;
  modulo: AuditoriaModulo;
  ip_address: string;
  detalles: string;
}

export interface BitacoraResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: BitacoraEntry[];
}

export interface BitacoraFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  usuario?: string;
  accion?: string;
  modulo?: string;
  page?: number;
  ordering?: string;
}
