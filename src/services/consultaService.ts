import api from '../api/axios';

export interface DiagnosticoCIE10 {
  codigo: string;
  descripcion: string;
}

export interface Paciente {
  id: number;
  nombre_completo: string;
  edad: number;
  genero: 'M' | 'F';
}

export interface Medico {
  id: number;
  nombre: string;
}

export interface ConsultaMedica {
  id: number;
  ficha: number;
  paciente_nombre: string;
  ficha_correlativo: string;
  medico: number;
  triaje: number | null;
  estado: 'BORRADOR' | 'COMPLETADA' | 'FIRMADA';
  // SOAP-S
  motivo_consulta: string;
  historia_enfermedad_actual: string;
  // SOAP-O
  examen_fisico: string;
  // SOAP-A
  impresion_diagnostica: string;
  codigo_cie10_principal: string;
  codigo_cie10_secundario: string;
  descripcion_cie10: string;
  // SOAP-P
  plan_tratamiento: string;
  indicaciones_alta: string;
  // Otros
  creado_en: string;
  actualizado_en: string;
}

export interface FichaQueue {
  id: number;
  correlativo: string;
  paciente_nombre: string;
  paciente_edad: number;
  paciente_genero: string;
  estado: string;
  fecha_apertura: string;
}

export type UpdateConsultaDTO = Partial<ConsultaMedica>;

export const consultaService = {
  getById: (id: number) => api.get<ConsultaMedica>(`/api/consultas/${id}/`),
  create: (fichaId: number) => api.post<ConsultaMedica>(`/api/consultas/`, { ficha: fichaId }),
  update: (id: number, data: UpdateConsultaDTO) => api.patch(`/api/consultas/${id}/`, data),
  completar: (id: number) => api.patch<ConsultaMedica>(`/api/consultas/${id}/completar/`),
  searchCIE10: (termino: string) => api.get<DiagnosticoCIE10[]>(`/api/auditoria/cie10/search/?q=${termino}`),
  getAll: (params?: any) => api.get<{ results: ConsultaMedica[] }>('/api/consultas/', { params }),
  getQueue: () => api.get<{ results: any[] }>('/api/fichas/', { params: { en_curso: true, estado: 'EN_TRIAJE' } })
};
