import { useEffect, useMemo, useRef, useState } from 'react'
import type { AxiosError, AxiosResponse } from 'axios'
import { getStoredUser, hasRole } from '../utils/auth'
import {
  exportarReporteProduccion,
  obtenerReporteProduccion,
  type NivelUrgencia,
  type ReporteProduccionFiltros,
  type ReporteProduccionPayload,
} from '../services/reportesService'

const URGENCIAS: Array<{ value: '' | NivelUrgencia; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'ROJO', label: 'Rojo' },
  { value: 'NARANJA', label: 'Naranja' },
  { value: 'AMARILLO', label: 'Amarillo' },
  { value: 'VERDE', label: 'Verde' },
  { value: 'AZUL', label: 'Azul' },
]

const INITIAL_FILTERS: ReporteProduccionFiltros = {
  fecha_desde: '',
  fecha_hasta: '',
  medico_id: '',
  medico_nombre: '',
  nivel_urgencia: '',
  codigo_cie10: '',
  q: '',
}

type SpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  start: () => void
  stop: () => void
}

function getSpeechCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function parseApiError(err: unknown, defaultMessage: string): string {
  const axiosErr = err as AxiosError<Record<string, unknown>>
  const status = axiosErr.response?.status
  const data = axiosErr.response?.data
  const token = localStorage.getItem('access_token')

  if (!token) return '401: no hay token de sesión. Inicia sesión nuevamente.'
  if (!status) return 'No se pudo conectar con el servidor. Verifica backend, red o CORS.'
  if (status === 401) return '401: token vencido o inválido.'
  if (status === 403) return '403: no tienes permisos para ver reportes.'
  if (status === 500) return '500: error interno del backend al generar el reporte.'
  if (status === 400 && data && typeof data === 'object') {
    const first = Object.values(data)[0]
    if (Array.isArray(first) && first[0]) return `400: ${String(first[0])}`
    if (typeof first === 'string') return `400: ${first}`
    return '400: parámetros inválidos. Revisa fechas y filtros.'
  }
  return `${defaultMessage} (HTTP ${status}).`
}

function prettyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

const COLUMN_CONFIG: Record<string, Array<{ key: string; label: string }>> = {
  consultas: [
    { key: 'paciente', label: 'Paciente' },
    { key: 'ci', label: 'CI' },
    { key: 'fecha_consulta', label: 'Fecha' },
    { key: 'medico', label: 'Médico' },
    { key: 'motivo_consulta', label: 'Motivo' },
    { key: 'codigo_cie10', label: 'CIE-10' },
    { key: 'estado', label: 'Estado' },
  ],
  triajes: [
    { key: 'paciente', label: 'Paciente' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'nivel_urgencia', label: 'Urgencia' },
    { key: 'fc', label: 'FC' },
    { key: 'fr', label: 'FR' },
    { key: 'temperatura', label: 'Temperatura' },
    { key: 'saturacion', label: 'Saturación' },
    { key: 'eva', label: 'EVA' },
    { key: 'estado', label: 'Estado' },
  ],
  recetas: [
    { key: 'numero_receta', label: 'N° receta' },
    { key: 'fecha_emision', label: 'Fecha' },
    { key: 'paciente', label: 'Paciente' },
    { key: 'medico', label: 'Médico' },
    { key: 'estado', label: 'Estado' },
  ],
}

function parseFileNameFromDisposition(contentDisposition?: string, fallback = 'reporte') {
  if (!contentDisposition) return fallback
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])
  const simpleMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  if (simpleMatch?.[1]) return simpleMatch[1]
  return fallback
}

function triggerBlobDownload(response: AxiosResponse<Blob>, extension: 'csv' | 'xlsx' | 'pdf') {
  const url = window.URL.createObjectURL(response.data)
  const disposition = response.headers['content-disposition'] as string | undefined
  const baseName = parseFileNameFromDisposition(disposition, `reporte_produccion.${extension}`)
  const fileName = baseName.includes('.') ? baseName : `${baseName}.${extension}`
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

export default function ReportesProduccion() {
  const user = getStoredUser()
  const isMedico = hasRole('Médico')
  const medicoNombrePropio = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.username || ''

  const [filters, setFilters] = useState<ReporteProduccionFiltros>(INITIAL_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<ReporteProduccionFiltros>(INITIAL_FILTERS)
  const [smartOpen, setSmartOpen] = useState(false)
  const [smartQuery, setSmartQuery] = useState('')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [micAvailable, setMicAvailable] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'pdf' | null>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [payload, setPayload] = useState<ReporteProduccionPayload | null>(null)
  const [hasUserRequestedDetail, setHasUserRequestedDetail] = useState(false)
  const [consultaPage, setConsultaPage] = useState(1)
  const [recetaPage, setRecetaPage] = useState(1)
  const [triajePage, setTriajePage] = useState(1)
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null)
  const PAGE_SIZE = 10

  const rows = payload?.filas ?? []
  const tipoReporte = payload?.tipo_reporte ?? 'resumen_general'
  const detalleConsultas = payload?.detalle_consultas ?? []
  const detalleRecetas = payload?.detalle_recetas ?? []
  const detalleTriajes = payload?.detalle_triajes ?? []
  const distribucionTriajes = payload?.triajes_por_nivel ?? []
  const hasResumenData = useMemo(() => {
    if (!payload) return false
    const r = payload.resumen
    return (
      r.total_consultas > 0 ||
      r.total_triajes > 0 ||
      r.total_recetas_emitidas > 0 ||
      r.total_recetas_dispensadas > 0 ||
      r.total_recetas_anuladas > 0 ||
      r.tasa_derivacion_pct > 0
    )
  }, [payload])
  const hasAnyData = hasResumenData
  const summaryItems = useMemo(() => {
    const r = payload?.resumen
    if (!r) {
      return [
        { label: 'Total consultas', value: 0 },
        { label: 'Total triajes', value: 0 },
        { label: 'Recetas emitidas', value: 0 },
      ]
    }
    if (tipoReporte === 'consultas') return [{ label: 'Total consultas', value: r.total_consultas }]
    if (tipoReporte === 'triajes') return [{ label: 'Total triajes', value: r.total_triajes }]
    if (tipoReporte === 'recetas_emitidas') return [{ label: 'Recetas emitidas', value: r.total_recetas_emitidas }]
    if (tipoReporte === 'recetas_dispensadas') return [{ label: 'Recetas dispensadas', value: r.total_recetas_dispensadas }]
    if (tipoReporte === 'recetas_anuladas') return [{ label: 'Recetas anuladas', value: r.total_recetas_anuladas }]
    if (tipoReporte === 'recetas') {
      return [
        { label: 'Recetas emitidas', value: r.total_recetas_emitidas },
        { label: 'Recetas dispensadas', value: r.total_recetas_dispensadas },
        { label: 'Recetas anuladas', value: r.total_recetas_anuladas },
      ]
    }
    return [
      { label: 'Total consultas', value: r.total_consultas },
      { label: 'Total triajes', value: r.total_triajes },
      { label: 'Recetas emitidas', value: r.total_recetas_emitidas },
      { label: 'Recetas dispensadas', value: r.total_recetas_dispensadas },
      { label: 'Recetas anuladas', value: r.total_recetas_anuladas },
      { label: 'Tasa derivación', value: `${(r.tasa_derivacion_pct ?? 0).toFixed(2)}%` },
    ]
  }, [payload, tipoReporte])

  const hasNormalFilters = useMemo(() => {
    const medicoNameDiffers = !isMedico
      ? Boolean(filters.medico_nombre.trim())
      : Boolean(filters.medico_nombre.trim() && filters.medico_nombre.trim() !== medicoNombrePropio.trim())
    return Boolean(
      filters.fecha_desde.trim() ||
      filters.fecha_hasta.trim() ||
      filters.medico_id.trim() ||
      medicoNameDiffers ||
      filters.nivel_urgencia.trim() ||
      filters.codigo_cie10.trim(),
    )
  }, [filters, isMedico, medicoNombrePropio])
  const hasAnySearchInput = useMemo(
    () => Boolean(hasNormalFilters || smartQuery.trim()),
    [hasNormalFilters, smartQuery],
  )
  const shouldShowResultsSection = tipoReporte === 'resumen_general'
    ? hasUserRequestedDetail && hasAnySearchInput
    : hasUserRequestedDetail

  function buildSearchFilters(base: ReporteProduccionFiltros, smartValue: string): ReporteProduccionFiltros {
    const scoped = isMedico
      ? { ...base, medico_id: String(user?.id ?? ''), medico_nombre: medicoNombrePropio }
      : base
    const q = smartValue.trim()
    if (!q) return { ...scoped, q: '' }
    if (hasNormalFilters) return { ...scoped, q: '' }
    return { ...scoped, q }
  }

  async function buscar(currentFilters: ReporteProduccionFiltros, smartValue = smartQuery) {
    const effectiveFilters = buildSearchFilters(currentFilters, smartValue)
    setLoading(true)
    setError('')
    setOk('')
    setSpeechError('')
    try {
      const data = await obtenerReporteProduccion(effectiveFilters)
      setPayload(data)
      setConsultaPage(1)
      setRecetaPage(1)
      setTriajePage(1)
      const fromBackend = (data.filtros_aplicados ?? {}) as ReporteProduccionFiltros
      setAppliedFilters({
        ...INITIAL_FILTERS,
        ...effectiveFilters,
        ...fromBackend,
      })
    } catch (err) {
      setError(parseApiError(err, 'No se pudo cargar el reporte'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void buscar(INITIAL_FILTERS)
  }, [])

  useEffect(() => {
    if (!isMedico) return
    setFilters((prev) => ({
      ...prev,
      medico_id: String(user?.id ?? ''),
      medico_nombre: medicoNombrePropio,
    }))
  }, [isMedico, user?.id, medicoNombrePropio])

  useEffect(() => {
    const speechCtor = getSpeechCtor()
    setSpeechSupported(Boolean(speechCtor))
    if (!speechCtor || !navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setMicAvailable(devices.some((d) => d.kind === 'audioinput'))
      })
      .catch(() => {
        setMicAvailable(false)
      })
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
    }
  }, [])

  async function onExport(format: 'csv' | 'excel' | 'pdf') {
    setExporting(format)
    setError('')
    setOk('')
    try {
      const response = await exportarReporteProduccion(appliedFilters, format)
      const ext = format === 'excel' ? 'xlsx' : format
      triggerBlobDownload(response, ext)
      setOk(`Exportación ${format.toUpperCase()} generada correctamente.`)
    } catch (err) {
      setError(parseApiError(err, `Falló la exportación ${format.toUpperCase()}`))
    } finally {
      setExporting(null)
    }
  }

  function onChange<K extends keyof ReporteProduccionFiltros>(key: K, value: ReporteProduccionFiltros[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function onLimpiar() {
    setFilters(INITIAL_FILTERS)
    setAppliedFilters({ ...INITIAL_FILTERS, tipo_reporte: 'resumen_general' })
    setPayload(null)
    setSmartQuery('')
    setSpeechError('')
    setError('')
    setOk('')
    setHasUserRequestedDetail(false)
    setConsultaPage(1)
    setRecetaPage(1)
    setTriajePage(1)
    void buscar(INITIAL_FILTERS, '')
  }

  function paginate(items: Array<Record<string, unknown>>, page: number) {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
    const safePage = Math.min(Math.max(page, 1), totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return {
      rows: items.slice(start, start + PAGE_SIZE),
      totalPages,
      safePage,
    }
  }

  const consultaSlice = paginate(tipoReporte === 'resumen_general' ? detalleConsultas : (tipoReporte === 'consultas' ? rows : []), consultaPage)
  const recetaSlice = paginate(tipoReporte === 'resumen_general' ? detalleRecetas : (tipoReporte.startsWith('recetas') ? rows : []), recetaPage)
  const triajeSlice = paginate(tipoReporte === 'resumen_general' ? detalleTriajes : (tipoReporte === 'triajes' ? rows : []), triajePage)

  async function onStartVoice() {
    setSpeechError('')
    if (!speechSupported) {
      setSpeechError('Tu navegador no soporta reconocimiento de voz (Web Speech API).')
      return
    }
    if (!micAvailable) {
      setSpeechError('No se detectó micrófono disponible en este dispositivo.')
      return
    }
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      const SpeechCtor = getSpeechCtor()
      if (!SpeechCtor) {
        setSpeechError('Tu navegador no soporta reconocimiento de voz (Web Speech API).')
        return
      }
      const rec = new SpeechCtor()
      recognitionRef.current = rec
      rec.lang = 'es-ES'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onstart = () => setIsListening(true)
      rec.onend = () => setIsListening(false)
      rec.onerror = (event) => {
        setIsListening(false)
        if (event.error === 'not-allowed') {
          setSpeechError('Permiso de micrófono denegado. Habilítalo en el navegador.')
        } else {
          setSpeechError(`No se pudo capturar voz (${event.error}).`)
        }
      }
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? ''
        if (transcript) setSmartQuery(transcript)
      }
      rec.start()
    } catch {
      setIsListening(false)
      setSpeechError('No se pudo acceder al micrófono. Revisa permisos del navegador.')
    }
  }

  function onStopVoice() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, color: '#0003B8', margin: 0 }}>Reportes de Producción</h1>
        <p style={{ color: '#5f6b8a', margin: '6px 0 0', fontSize: 13 }}>
          Panel analítico con filtros, resumen operativo y exportación en CSV, Excel y PDF.
        </p>
      </div>

      {error && <div className="estudios-alert estudios-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      {ok && <div className="estudios-alert estudios-alert-ok" style={{ marginBottom: 12 }}>{ok}</div>}

      <section className="estudios-shell-card reportes-card-filtros" style={{ marginBottom: 14 }}>
        <h2 className="estudios-section-title">Filtros</h2>
        <div className="reportes-grid">
          <div>
            <label className="estudios-label">Fecha desde</label>
            <input type="date" value={filters.fecha_desde} onChange={(e) => onChange('fecha_desde', e.target.value)} />
          </div>
          <div>
            <label className="estudios-label">Fecha hasta</label>
            <input type="date" value={filters.fecha_hasta} onChange={(e) => onChange('fecha_hasta', e.target.value)} />
          </div>
          <div>
            <label className="estudios-label">Médico (nombre)</label>
            <input
              value={filters.medico_nombre}
              onChange={(e) => onChange('medico_nombre', e.target.value)}
              placeholder="Buscar médico..."
              disabled={isMedico}
            />
            {isMedico && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#60708d' }}>
                Vista restringida: solo se muestran datos del médico autenticado.
              </p>
            )}
          </div>
          <div>
            <label className="estudios-label">Nivel de urgencia</label>
            <select
              className="reportes-select"
              value={filters.nivel_urgencia}
              onChange={(e) => onChange('nivel_urgencia', e.target.value as ReporteProduccionFiltros['nivel_urgencia'])}
            >
              {URGENCIAS.map((u) => <option key={u.label} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="estudios-label">Código CIE-10</label>
            <input value={filters.codigo_cie10} onChange={(e) => onChange('codigo_cie10', e.target.value)} placeholder="Ej: diabetes, J00" />
          </div>
        </div>

        <div className="reportes-smart-box">
          <button type="button" className="reportes-smart-toggle" onClick={() => setSmartOpen((s) => !s)}>
            Búsqueda inteligente (IA) {smartOpen ? '▲' : '▼'}
          </button>
          {smartOpen && (
            <div className="reportes-smart-content">
              <label className="estudios-label">Consulta inteligente</label>
              <div className="reportes-smart-row">
                <input
                  value={smartQuery}
                  onChange={(e) => setSmartQuery(e.target.value)}
                  placeholder="Ej: pacientes diabéticos este mes"
                />
                {speechSupported && micAvailable && (
                  <button
                    type="button"
                    className={`reportes-mic-btn ${isListening ? 'reportes-mic-btn-listening' : ''}`}
                    onClick={() => {
                      if (isListening) {
                        onStopVoice()
                      } else {
                        void onStartVoice()
                      }
                    }}
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="2" width="4" height="7" rx="2" />
                      <path d="M4 7.5a4 4 0 0 0 8 0" />
                      <path d="M8 11.5v2.5" />
                      <path d="M6.2 14h3.6" />
                    </svg>
                    {isListening ? 'Detener' : 'Voz'}
                  </button>
                )}
              </div>
              {isListening && <p className="reportes-smart-state">Escuchando...</p>}
              {speechSupported && !micAvailable && <p className="reportes-smart-state">No se detectó micrófono disponible.</p>}
              {speechError && <p className="reportes-smart-error">{speechError}</p>}
              {hasNormalFilters && smartQuery.trim() && (
                <p className="reportes-smart-state">Hay filtros activos: se priorizarán filtros normales sobre búsqueda IA.</p>
              )}
            </div>
          )}
        </div>

        <div className="reportes-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={() => {
              setHasUserRequestedDetail(true)
              void buscar(filters)
            }}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button type="button" className="btn-secondary" disabled={loading} onClick={onLimpiar}>
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="estudios-shell-card" style={{ marginBottom: 14 }}>
        <div className="reportes-topbar">
          <div>
            <h2 className="estudios-section-title" style={{ marginBottom: 6 }}>Resumen</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#627193' }}>
              Periodo: <strong>{payload?.periodo.fecha_desde || appliedFilters.fecha_desde || 'Sin límite'}</strong> a{' '}
              <strong>{payload?.periodo.fecha_hasta || appliedFilters.fecha_hasta || 'Sin límite'}</strong>
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#627193' }}>
              Filtros aplicados: {Object.entries(appliedFilters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'ninguno'}
            </p>
          </div>
          <div className="reportes-export">
            <button type="button" className="btn-secondary" disabled={exporting !== null} onClick={() => void onExport('csv')}>
              {exporting === 'csv' ? 'Exportando CSV...' : 'Exportar CSV'}
            </button>
            <button type="button" className="btn-secondary" disabled={exporting !== null} onClick={() => void onExport('excel')}>
              {exporting === 'excel' ? 'Exportando Excel...' : 'Exportar Excel'}
            </button>
            <button type="button" className="btn-primary" disabled={exporting !== null} onClick={() => void onExport('pdf')}>
              {exporting === 'pdf' ? 'Exportando PDF...' : 'Exportar PDF'}
            </button>
          </div>
        </div>

        <div className="reportes-summary-grid">
          {summaryItems.map((item, idx) => (
            <article key={`${item.label}-${idx}`} className="reportes-kpi-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
        {payload?.advertencias?.length ? (
          <div className="reportes-empty-state" style={{ marginTop: 10 }}>
            {payload.advertencias.join(' ')}
          </div>
        ) : null}
        {!loading && payload && !hasAnyData && (
          <div className="reportes-empty-state">
            No hay datos para los filtros seleccionados.
          </div>
        )}
      </section>

      <section className="estudios-shell-card">
        <h2 className="estudios-section-title">Resultados</h2>
        {!shouldShowResultsSection && (
          <div className="consulta-item consulta-item-muted">
            Realiza una búsqueda o aplica filtros para ver el detalle.
          </div>
        )}
        {shouldShowResultsSection && (
          <>
        {(tipoReporte === 'triajes' || (tipoReporte === 'resumen_general' && hasUserRequestedDetail && hasAnySearchInput)) && (
          <>
            <h3 className="estudios-section-title" style={{ fontSize: 14, marginTop: 8 }}>Distribución de Triajes</h3>
            <div className="estudios-desktop-table">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #dbe4ff', color: '#0f2c7a' }}>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>Nivel</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '10px 8px' }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribucionTriajes.length === 0 ? <tr><td colSpan={3} style={{ padding: '12px 8px', color: '#667085' }}>Sin filas de detalle para mostrar.</td></tr> : distribucionTriajes.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eef2ff' }}>
                        <td style={{ padding: '10px 8px' }}>{prettyValue(r.nivel_urgencia)}</td>
                        <td style={{ padding: '10px 8px' }}>{prettyValue(r.total)}</td>
                        <td style={{ padding: '10px 8px' }}>{prettyValue(r.porcentaje)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {(tipoReporte === 'consultas' || (tipoReporte === 'resumen_general' && hasUserRequestedDetail && hasAnySearchInput)) && (
          <>
            <h3 className="estudios-section-title" style={{ fontSize: 14, marginTop: 12 }}>Consultas</h3>
            <div className="estudios-desktop-table">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #dbe4ff', color: '#0f2c7a' }}>
                      {COLUMN_CONFIG.consultas.map((col) => <th key={col.key} style={{ textAlign: 'left', padding: '10px 8px' }}>{col.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {consultaSlice.rows.length === 0 ? <tr><td colSpan={COLUMN_CONFIG.consultas.length} style={{ padding: '12px 8px', color: '#667085' }}>Sin filas de detalle para mostrar.</td></tr> : consultaSlice.rows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eef2ff' }}>
                        {COLUMN_CONFIG.consultas.map((col) => <td key={col.key} style={{ padding: '10px 8px', color: '#1f2f54' }}>{prettyValue(row[col.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="reportes-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn-secondary" disabled={consultaSlice.safePage <= 1} onClick={() => setConsultaPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <span style={{ alignSelf: 'center', fontSize: 12, color: '#60708d' }}>Página {consultaSlice.safePage} de {consultaSlice.totalPages}</span>
              <button type="button" className="btn-secondary" disabled={consultaSlice.safePage >= consultaSlice.totalPages} onClick={() => setConsultaPage((p) => Math.min(consultaSlice.totalPages, p + 1))}>Siguiente</button>
            </div>
          </>
        )}

        {(tipoReporte.startsWith('recetas') || (tipoReporte === 'resumen_general' && hasUserRequestedDetail && hasAnySearchInput)) && (
          <>
            <h3 className="estudios-section-title" style={{ fontSize: 14, marginTop: 12 }}>Recetas</h3>
            <div className="estudios-desktop-table">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #dbe4ff', color: '#0f2c7a' }}>
                      {COLUMN_CONFIG.recetas.map((col) => <th key={col.key} style={{ textAlign: 'left', padding: '10px 8px' }}>{col.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {recetaSlice.rows.length === 0 ? <tr><td colSpan={COLUMN_CONFIG.recetas.length} style={{ padding: '12px 8px', color: '#667085' }}>Sin filas de detalle para mostrar.</td></tr> : recetaSlice.rows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eef2ff' }}>
                        {COLUMN_CONFIG.recetas.map((col) => <td key={col.key} style={{ padding: '10px 8px', color: '#1f2f54' }}>{prettyValue(row[col.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="reportes-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn-secondary" disabled={recetaSlice.safePage <= 1} onClick={() => setRecetaPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <span style={{ alignSelf: 'center', fontSize: 12, color: '#60708d' }}>Página {recetaSlice.safePage} de {recetaSlice.totalPages}</span>
              <button type="button" className="btn-secondary" disabled={recetaSlice.safePage >= recetaSlice.totalPages} onClick={() => setRecetaPage((p) => Math.min(recetaSlice.totalPages, p + 1))}>Siguiente</button>
            </div>
          </>
        )}

        {(tipoReporte === 'triajes' || (tipoReporte === 'resumen_general' && hasUserRequestedDetail && hasAnySearchInput)) && (
          <>
            <h3 className="estudios-section-title" style={{ fontSize: 14, marginTop: 12 }}>Triajes</h3>
            <div className="estudios-desktop-table">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #dbe4ff', color: '#0f2c7a' }}>
                      {COLUMN_CONFIG.triajes.map((col) => <th key={col.key} style={{ textAlign: 'left', padding: '10px 8px' }}>{col.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {triajeSlice.rows.length === 0 ? <tr><td colSpan={COLUMN_CONFIG.triajes.length} style={{ padding: '12px 8px', color: '#667085' }}>Sin filas de detalle para mostrar.</td></tr> : triajeSlice.rows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eef2ff' }}>
                        {COLUMN_CONFIG.triajes.map((col) => <td key={col.key} style={{ padding: '10px 8px', color: '#1f2f54' }}>{prettyValue(row[col.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="reportes-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn-secondary" disabled={triajeSlice.safePage <= 1} onClick={() => setTriajePage((p) => Math.max(1, p - 1))}>Anterior</button>
              <span style={{ alignSelf: 'center', fontSize: 12, color: '#60708d' }}>Página {triajeSlice.safePage} de {triajeSlice.totalPages}</span>
              <button type="button" className="btn-secondary" disabled={triajeSlice.safePage >= triajeSlice.totalPages} onClick={() => setTriajePage((p) => Math.min(triajeSlice.totalPages, p + 1))}>Siguiente</button>
            </div>
          </>
        )}
          </>
        )}
      </section>
    </div>
  )
}
