import { api } from '../api/axiosConfig'

export type ReporteFormato = 'json' | 'excel' | 'csv' | 'pdf'
export type NivelUrgencia = 'ROJO' | 'NARANJA' | 'AMARILLO' | 'VERDE' | 'AZUL'

export interface ReporteProduccionFiltros {
  fecha_desde: string
  fecha_hasta: string
  medico_id: string
  medico_nombre: string
  nivel_urgencia: '' | NivelUrgencia
  codigo_cie10: string
  q: string
  tipo_reporte?: string
}

export interface ReporteProduccionResumen {
  total_consultas: number
  total_triajes: number
  total_recetas_emitidas: number
  total_recetas_dispensadas: number
  total_recetas_anuladas: number
  tasa_derivacion_pct: number
}

export interface ReporteProduccionPayload {
  tipo_reporte?: string
  resumen: ReporteProduccionResumen
  periodo: {
    fecha_desde: string
    fecha_hasta: string
  }
  filtros_aplicados: Partial<ReporteProduccionFiltros>
  advertencias?: string[]
  filas: Array<Record<string, unknown>>
  detalle_consultas: Array<Record<string, unknown>>
  detalle_recetas: Array<Record<string, unknown>>
  detalle_triajes: Array<Record<string, unknown>>
  triajes_por_nivel: Array<Record<string, unknown>>
}

function buildParams(
  filtros: Partial<ReporteProduccionFiltros>,
  formato: ReporteFormato = 'json',
): Record<string, string> {
  const params: Record<string, string> = { formato }
  const entries = Object.entries(filtros) as Array<[keyof ReporteProduccionFiltros, string]>
  for (const [key, value] of entries) {
    const trimmed = (value ?? '').trim()
    if (trimmed) params[key] = trimmed
  }
  return params
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function pickRows(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates = ['resultados', 'detalle', 'rows', 'filas', 'items', 'data']
  for (const key of candidates) {
    const value = data[key]
    if (Array.isArray(value) && value.every((x) => typeof x === 'object' && x !== null)) {
      return value as Array<Record<string, unknown>>
    }
  }
  const dynamic = Object.values(data).find(
    (value) => Array.isArray(value) && value.every((x) => typeof x === 'object' && x !== null),
  )
  return (dynamic as Array<Record<string, unknown>>) ?? []
}

export async function obtenerReporteProduccion(
  filtros: Partial<ReporteProduccionFiltros>,
): Promise<ReporteProduccionPayload> {
  const { data } = await api.get<Record<string, unknown>>('reportes/produccion/', {
    params: buildParams(filtros, 'json'),
  })

  const resumenRaw = (data.resumen as Record<string, unknown> | undefined) ?? data
  const resumen: ReporteProduccionResumen = {
    total_consultas: toNumber(resumenRaw.total_consultas),
    total_triajes: toNumber(resumenRaw.total_triajes),
    total_recetas_emitidas: toNumber(resumenRaw.total_recetas_emitidas),
    total_recetas_dispensadas: toNumber(resumenRaw.total_recetas_dispensadas),
    total_recetas_anuladas: toNumber(resumenRaw.total_recetas_anuladas),
    tasa_derivacion_pct: toNumber(resumenRaw.tasa_derivacion_pct),
  }

  const periodoRaw = (data.periodo as Record<string, unknown> | undefined) ?? {}
  const filtrosRaw = (data.filtros_aplicados as Record<string, unknown> | undefined) ?? {}

  return {
    tipo_reporte: typeof data.tipo_reporte === 'string' ? data.tipo_reporte : 'resumen_general',
    resumen,
    periodo: {
      fecha_desde: String(periodoRaw.fecha_desde ?? ''),
      fecha_hasta: String(periodoRaw.fecha_hasta ?? ''),
    },
    filtros_aplicados: filtrosRaw as Partial<ReporteProduccionFiltros>,
    advertencias: Array.isArray(data.advertencias) ? (data.advertencias as string[]) : [],
    filas: pickRows(data),
    detalle_consultas: Array.isArray(data.detalle_consultas) ? (data.detalle_consultas as Array<Record<string, unknown>>) : [],
    detalle_recetas: Array.isArray(data.detalle_recetas) ? (data.detalle_recetas as Array<Record<string, unknown>>) : [],
    detalle_triajes: Array.isArray(data.detalle_triajes) ? (data.detalle_triajes as Array<Record<string, unknown>>) : [],
    triajes_por_nivel: Array.isArray(data.triajes_por_nivel) ? (data.triajes_por_nivel as Array<Record<string, unknown>>) : [],
  }
}

export async function exportarReporteProduccion(
  filtros: Partial<ReporteProduccionFiltros>,
  formato: Exclude<ReporteFormato, 'json'>,
) {
  const response = await api.get<Blob>('reportes/produccion/', {
    params: buildParams(filtros, formato),
    responseType: 'blob',
  })
  return response
}
