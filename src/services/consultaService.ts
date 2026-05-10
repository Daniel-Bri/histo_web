import { api } from '../api/axiosConfig';

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
  // Firma Digital (T022 / CU11)
  hash_documento?: string;
  firmada_por?: number;
  firmada_por_nombre?: string;
  firmada_en?: string;
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
  getById: (id: number) => api.get<ConsultaMedica>(`consultas/${id}/`),
  create: (fichaId: number) => api.post<ConsultaMedica>(`consultas/`, { ficha: fichaId }),
  update: (id: number, data: UpdateConsultaDTO) => api.patch(`consultas/${id}/`, data),
  completar: (id: number) => api.patch<ConsultaMedica>(`consultas/${id}/completar/`),
  firmar: (id: number) => api.patch<ConsultaMedica>(`consultas/${id}/firmar/`),
  searchCIE10: (termino: string) => api.get<DiagnosticoCIE10[]>(`auditoria/cie10/search/?q=${termino}`),
  getAll: (params?: any) => api.get<{ results: ConsultaMedica[] }>('consultas/', { params }),
  getQueue: () => api.get<{ results: any[] }>('fichas/', { params: { en_curso: true, estado: 'EN_TRIAJE' } })
};
