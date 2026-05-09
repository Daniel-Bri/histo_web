import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/axiosConfig'
import { fichaService } from '../services/fichaService'
import { parseDrfErrorResponse } from '../services/pacienteService'
import type { Paciente } from '../types/paciente.types'
import type { FichaBrief } from '../types/triaje.types'
import { hasRole } from '../utils/auth'

const ESTADO_META: Record<string, { label: string; bg: string; text: string }> = {
  ABIERTA: { label: 'Abierta', bg: '#DBEAFE', text: '#1D4ED8' },
  EN_TRIAJE: { label: 'En triaje', bg: '#FEF3C7', text: '#B45309' },
  EN_ATENCION: { label: 'En atencion', bg: '#DCFCE7', text: '#15803D' },
  CERRADA: { label: 'Cerrada', bg: '#F1F5F9', text: '#64748B' },
  CANCELADA: { label: 'Cancelada', bg: '#FEE2E2', text: '#DC2626' },
}

function toIsoDay(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export default function AperturaFichaColaDia() {
  const navigate = useNavigate()
  const puedeUsar = useMemo(() => hasRole('Administrativo', 'Director'), [])
  const hoyIso = useMemo(() => toIsoDay(new Date()), [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [fichas, setFichas] = useState<FichaBrief[]>([])
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState<Paciente[]>([])
  const [creatingFicha, setCreatingFicha] = useState<number | null>(null)

  const cargarColaDia = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fichaService.listar({
        fecha_desde: hoyIso,
        fecha_hasta: hoyIso,
        page_size: 100,
      })
      setFichas(res.data.results ?? [])
    } catch {
      setError('No se pudo cargar la cola de atencion del dia.')
    } finally {
      setLoading(false)
    }
  }, [hoyIso])

  useEffect(() => {
    if (puedeUsar) {
      void cargarColaDia()
    }
  }, [cargarColaDia, puedeUsar])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const res = await api.get<{ results: Paciente[] }>('pacientes/pacientes/', {
        params: { search: q, page_size: 8 },
      })
      const rows = res.data.results ?? []
      setSearchResults(rows)
      if (rows.length === 0) setSearchError('No se encontraron pacientes para ese criterio.')
    } catch {
      setSearchError('No se pudo buscar pacientes.')
    } finally {
      setSearching(false)
    }
  }

  const handleAbrirFicha = async (pacienteId: number) => {
    setCreatingFicha(pacienteId)
    setMsg('')
    setError('')
    try {
      const res = await fichaService.crear(pacienteId)
      setMsg(`Ficha ${res.data.correlativo} abierta correctamente.`)
      await cargarColaDia()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data
      const { general } = parseDrfErrorResponse(data)
      setError(general.join(' ') || 'No se pudo abrir la ficha.')
    } finally {
      setCreatingFicha(null)
    }
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1E293B', margin: 0 }}>
            Apertura de ficha y cola del dia
          </h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>
            Registro de fichas de atencion y seguimiento operativo del dia actual.
          </p>
        </div>
        <button
          onClick={() => void cargarColaDia()}
          disabled={!puedeUsar || loading}
          style={{
            padding: '8px 14px',
            border: '1px solid #B3D4FF',
            borderRadius: '8px',
            background: '#fff',
            color: '#1D4ED8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: puedeUsar ? 'pointer' : 'not-allowed',
            opacity: puedeUsar ? 1 : 0.7,
          }}
        >
          {loading ? 'Actualizando...' : '↻ Actualizar'}
        </button>
      </div>

      {!puedeUsar && (
        <div style={{ background: '#FFF3CD', color: '#664D03', border: '1px solid #FFECB5', borderRadius: 10, padding: 12 }}>
          Sin permisos para este modulo. Solo Administrativo y Director.
        </div>
      )}
      {error && <div style={{ marginBottom: 12, color: '#B42318', background: '#FEF3F2', border: '1px solid #FECACA', padding: 10, borderRadius: 8 }}>{error}</div>}
      {msg && <div style={{ marginBottom: 12, color: '#0A7B57', background: '#ECFDF3', border: '1px solid #ABEFC6', padding: 10, borderRadius: 8 }}>{msg}</div>}

      {puedeUsar && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>Cola de atencion del dia</span>
              <span style={{ background: '#DBEAFE', color: '#1D4ED8', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                {fichas.length}
              </span>
            </div>
            {loading ? (
              <div style={{ padding: '36px', color: '#64748B', textAlign: 'center' }}>Cargando fichas...</div>
            ) : fichas.length === 0 ? (
              <div style={{ padding: '36px', color: '#64748B', textAlign: 'center' }}>No hay fichas registradas hoy.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Ficha', 'Paciente', 'CI', 'Hora', 'Estado'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0' }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fichas.map((ficha, idx) => {
                    const meta = ESTADO_META[ficha.estado] ?? { label: ficha.estado, bg: '#F1F5F9', text: '#64748B' }
                    return (
                      <tr key={ficha.id} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#1D4ED8', borderBottom: '1px solid #F1F5F9' }}>{ficha.correlativo}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#1E293B', borderBottom: '1px solid #F1F5F9' }}>{ficha.paciente.nombre_completo}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569', borderBottom: '1px solid #F1F5F9' }}>{ficha.paciente.ci}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748B', borderBottom: '1px solid #F1F5F9' }}>
                          {new Date(ficha.fecha_apertura).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                          <span style={{ background: meta.bg, color: meta.text, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px' }}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', margin: 0 }}>Abrir nueva ficha</p>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Busca paciente por CI o apellido.</p>
            </div>
            <div style={{ padding: '16px' }}>
              <button
                onClick={() => navigate('/pacientes/registro')}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '16px',
                  background: '#fff',
                  color: '#1D4ED8',
                  border: '1.5px dashed #B3D4FF',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '18px' }}>+</span> Registrar nuevo paciente
              </button>

              <form onSubmit={(e) => void handleSearch(e)} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="CI o apellido..."
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #B3D4FF', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                />
                <button
                  type="submit"
                  disabled={searching}
                  style={{ padding: '8px 14px', border: 'none', borderRadius: '8px', background: '#122268', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {searching ? '...' : 'Buscar'}
                </button>
              </form>
              {searchError && (
                <div style={{ marginBottom: '14px', padding: '10px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FEE2E2' }}>
                  <p style={{ color: '#DC2626', fontSize: '12px', margin: '0 0 8px' }}>{searchError}</p>
                  <button
                    onClick={() => navigate('/pacientes/registro')}
                    style={{
                      background: '#DC2626',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Registrar nuevo paciente
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map((p) => (
                  <div key={p.id} style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#FAFBFF' }}>
                    <p style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B', margin: '0 0 2px' }}>
                      {p.nombre} {p.apellido}
                    </p>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px' }}>CI: {p.ci}</p>
                    <button
                      onClick={() => void handleAbrirFicha(p.id)}
                      disabled={creatingFicha === p.id}
                      style={{
                        padding: '5px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        background: creatingFicha === p.id ? '#9CA3AF' : '#00A896',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: creatingFicha === p.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {creatingFicha === p.id ? 'Abriendo...' : 'Abrir ficha'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
