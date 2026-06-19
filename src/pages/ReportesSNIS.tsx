import { useState } from 'react'
import {
  exportarReporteSNIS,
  obtenerReporteSNIS,
  type MorbilidadRow,
  type ReporteSNISFiltros,
  type ReporteSNISPayload,
  type SexoFiltro,
} from '../services/reportesService'

const hoy         = new Date().toISOString().slice(0, 10)
const primerDia   = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const SEXOS: { value: SexoFiltro; label: string }[] = [
  { value: '',  label: 'Todos' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
]

const INIT: ReporteSNISFiltros = {
  fecha_desde:  primerDia,
  fecha_hasta:  hoy,
  codigo_cie10: '',
  sexo:         '',
}

export default function ReportesSNIS() {
  const [filtros,    setFiltros]    = useState<ReporteSNISFiltros>(INIT)
  const [datos,      setDatos]      = useState<ReporteSNISPayload | null>(null)
  const [cargando,   setCargando]   = useState(false)
  const [exportando, setExportando] = useState<string | null>(null)
  const [error,      setError]      = useState('')

  const set = <K extends keyof ReporteSNISFiltros>(k: K, v: ReporteSNISFiltros[K]) =>
    setFiltros(f => ({ ...f, [k]: v }))

  const buscar = async () => {
    setCargando(true)
    setError('')
    try {
      const res = await obtenerReporteSNIS(filtros)
      setDatos(res)
    } catch {
      setError('Error al obtener el reporte. Verifica la conexión con el servidor.')
    } finally {
      setCargando(false)
    }
  }

  const exportar = async (fmt: 'csv' | 'excel' | 'pdf') => {
    setExportando(fmt)
    setError('')
    try {
      await exportarReporteSNIS(filtros, fmt)
    } catch {
      setError(`Error al exportar en formato ${fmt.toUpperCase()}.`)
    } finally {
      setExportando(null)
    }
  }

  const maxTotal = datos ? Math.max(...datos.morbilidad.map(r => r.total), 1) : 1

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Encabezado */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
          Reporte SNIS — Morbilidad CIE-10
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Casos por diagnóstico CIE-10 para reporte al Sistema Nacional de Información en Salud (Bolivia).
          Los datos se filtran automáticamente por su establecimiento.
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
        padding: '1rem 1.25rem', marginBottom: '1.25rem',
        display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end',
      }}>
        <div>
          <label style={labelStyle}>Desde</label>
          <input type="date" value={filtros.fecha_desde}
            onChange={e => set('fecha_desde', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Hasta</label>
          <input type="date" value={filtros.fecha_hasta}
            onChange={e => set('fecha_hasta', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Código CIE-10</label>
          <input type="text" placeholder="Ej: J18, E11…" value={filtros.codigo_cie10}
            onChange={e => set('codigo_cie10', e.target.value.toUpperCase())}
            style={{ ...inputStyle, width: '120px' }} />
        </div>
        <div>
          <label style={labelStyle}>Sexo</label>
          <select value={filtros.sexo}
            onChange={e => set('sexo', e.target.value as SexoFiltro)} style={inputStyle}>
            {SEXOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button onClick={buscar} disabled={cargando} style={btnPrimary}>
          {cargando ? 'Cargando…' : 'Generar reporte'}
        </button>
        <button onClick={() => { setFiltros(INIT); setDatos(null); setError('') }}
          style={btnSecondary}>
          Limpiar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          borderRadius: '0.4rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {datos && (
        <>
          {/* Tarjetas resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <Tarjeta valor={datos.resumen.total_casos} label="Total de casos" color="#1d4ed8" fondo="#eff6ff" />
            <Tarjeta valor={datos.resumen.total_diagnosticos_distintos} label="Diagnósticos distintos" color="#065f46" fondo="#ecfdf5" />
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>Período</div>
              <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                {datos.periodo.fecha_desde} al {datos.periodo.fecha_hasta}
              </div>
              {Object.keys(datos.filtros_aplicados).filter(k => !['fecha_desde','fecha_hasta'].includes(k)).length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Filtros: {[
                    datos.filtros_aplicados.codigo_cie10 && `CIE-10: ${datos.filtros_aplicados.codigo_cie10}`,
                    datos.filtros_aplicados.sexo && `Sexo: ${datos.filtros_aplicados.sexo}`,
                  ].filter(Boolean).join(' | ')}
                </div>
              )}
            </div>
          </div>

          {/* Gráfica de barras — Top 10 */}
          {datos.morbilidad.length > 0 && (
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
              padding: '1rem 1.25rem', marginBottom: '1.25rem',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
                Top {Math.min(10, datos.morbilidad.length)} diagnósticos más frecuentes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {datos.morbilidad.slice(0, 10).map((row: MorbilidadRow) => (
                  <div key={row.codigo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '60px', fontSize: '0.75rem', color: '#64748b', textAlign: 'right', flexShrink: 0, fontFamily: 'monospace' }}>
                      {row.codigo}
                    </div>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '9999px', height: '22px', position: 'relative' }}>
                      <div style={{
                        width: `${(row.total / maxTotal) * 100}%`,
                        background: '#3b82f6', height: '22px', borderRadius: '9999px',
                        transition: 'width 0.4s ease',
                      }} />
                      <span style={{
                        position: 'absolute', left: '0.5rem', top: 0,
                        fontSize: '0.75rem', color: '#fff', lineHeight: '22px', fontWeight: 600,
                      }}>
                        {row.total}
                      </span>
                    </div>
                    <div style={{ width: '160px', fontSize: '0.75rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}
                      title={row.descripcion}>
                      {row.descripcion || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones exportar */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {(['csv', 'excel', 'pdf'] as const).map(fmt => (
              <button key={fmt} onClick={() => exportar(fmt)} disabled={exportando !== null}
                style={{
                  ...btnSecondary,
                  borderColor: fmt === 'pdf' ? '#ef4444' : fmt === 'excel' ? '#16a34a' : '#6366f1',
                  color:       fmt === 'pdf' ? '#dc2626' : fmt === 'excel' ? '#15803d' : '#4f46e5',
                  opacity: exportando !== null ? 0.6 : 1,
                }}>
                {exportando === fmt ? 'Exportando…' : `Exportar ${fmt.toUpperCase()}`}
              </button>
            ))}
          </div>

          {/* Tabla de morbilidad */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['#', 'Código CIE-10', 'Descripción', 'Total', 'Masc.', 'Fem.', '% del total'].map(h => (
                    <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: h === '#' || h === 'Total' || h === 'Masc.' || h === 'Fem.' || h === '% del total' ? 'right' : 'left', fontWeight: 600, color: '#374151', fontSize: '0.8125rem' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.morbilidad.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      Sin registros para el período y filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  datos.morbilidad.map((row: MorbilidadRow, i: number) => (
                    <tr key={row.codigo} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '0.5rem 0.875rem', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{row.codigo}</td>
                      <td style={{ padding: '0.5rem 0.875rem', color: '#374151' }}>{row.descripcion || '—'}</td>
                      <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>{row.total}</td>
                      <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', color: '#2563eb' }}>{row.masculino}</td>
                      <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', color: '#be185d' }}>{row.femenino}</td>
                      <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', color: '#6b7280' }}>{row.porcentaje}%</td>
                    </tr>
                  ))
                )}
              </tbody>
              {datos.morbilidad.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={3} style={{ padding: '0.5rem 0.875rem', fontWeight: 600, color: '#374151' }}>Total</td>
                    <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{datos.resumen.total_casos}</td>
                    <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                      {datos.morbilidad.reduce((s, r) => s + r.masculino, 0)}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', fontWeight: 700, color: '#be185d' }}>
                      {datos.morbilidad.reduce((s, r) => s + r.femenino, 0)}
                    </td>
                    <td style={{ padding: '0.5rem 0.875rem', textAlign: 'right', fontWeight: 700 }}>100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {!datos && !cargando && !error && (
        <div style={{
          textAlign: 'center', padding: '3rem', color: '#94a3b8',
          border: '2px dashed #e2e8f0', borderRadius: '0.5rem',
        }}>
          Configura los filtros y presiona <strong>Generar reporte</strong> para ver los resultados.
        </div>
      )}
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Tarjeta({ valor, label, color, fondo }: { valor: number; label: string; color: string; fondo: string }) {
  return (
    <div style={{ background: fondo, border: `1px solid ${color}22`, borderRadius: '0.5rem', padding: '1rem' }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{valor}</div>
      <div style={{ fontSize: '0.8125rem', color: '#475569' }}>{label}</div>
    </div>
  )
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem',
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.375rem 0.625rem',
  fontSize: '0.875rem', color: '#1e293b', background: '#fff',
}

const btnPrimary: React.CSSProperties = {
  background: '#2563eb', color: '#fff', border: 'none',
  borderRadius: '0.375rem', padding: '0.425rem 1rem',
  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#374151', border: '1px solid #cbd5e1',
  borderRadius: '0.375rem', padding: '0.425rem 0.875rem',
  fontSize: '0.875rem', cursor: 'pointer',
}
