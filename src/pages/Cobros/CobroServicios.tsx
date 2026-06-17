import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/axiosConfig'
import { fichaService } from '../../services/fichaService'
import { listarOrdenesPorFicha, type OrdenEstudioListItem } from '../../services/estudiosService'
import { cobroService } from '../../services/cobroService'
import type { Cobro, EstadoCobro } from '../../types/cobro.types'
import type { FichaBrief } from '../../types/triaje.types'
import type { Paciente } from '../../types/paciente.types'

interface PaginatedResponse<T> {
  count: number
  results: T[]
}

interface ConceptoManual {
  id: string
  descripcion: string
  monto: string
}

const ESTADO_COLORS: Record<EstadoCobro, { bg: string; text: string; border: string }> = {
  PENDIENTE: { bg: '#FEF9C3', text: '#92400E', border: '#FDE68A' },
  PAGADO:    { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
  ANULADO:   { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  EXPIRADO:  { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
}

function EstadoCobroBadge({ estado }: { estado: EstadoCobro }) {
  const c = ESTADO_COLORS[estado] ?? ESTADO_COLORS.PENDIENTE
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '4px 12px', borderRadius: '9999px',
      fontSize: '12px', fontWeight: 700,
    }}>
      {estado}
    </span>
  )
}

export default function CobroServicios() {
  const [busqueda, setBusqueda] = useState('')
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [buscandoPaciente, setBuscandoPaciente] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [fichas, setFichas] = useState<FichaBrief[]>([])
  const [cargandoFichas, setCargandoFichas] = useState(false)
  const [fichaSeleccionada, setFichaSeleccionada] = useState<FichaBrief | null>(null)

  const [ordenes, setOrdenes] = useState<OrdenEstudioListItem[]>([])
  const [ordenesSeleccionadas, setOrdenesSeleccionadas] = useState<Set<number>>(new Set())
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false)

  const [conceptos, setConceptos] = useState<ConceptoManual[]>([])
  const [nuevoDescripcion, setNuevoDescripcion] = useState('')
  const [nuevoMonto, setNuevoMonto] = useState('')

  const [cobros, setCobros] = useState<Cobro[]>([])
  const [cargandoCobros, setCargandoCobros] = useState(false)

  const [generando, setGenerando] = useState(false)
  const [anulandoId, setAnulandoId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const ejecutarBusqueda = (query: string) => {
    const miId = ++requestIdRef.current
    setBuscandoPaciente(true)
    const params: Record<string, string | number> = { page_size: 12 }
    if (query.trim()) params.search = query.trim()
    api.get<PaginatedResponse<Paciente>>('pacientes/pacientes/', { params })
      .then(res => {
        if (miId === requestIdRef.current) setPacientes(res.data.results)
      })
      .catch(() => setError('No se pudo cargar pacientes.'))
      .finally(() => setBuscandoPaciente(false))
  }

  useEffect(() => {
    ejecutarBusqueda('')
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => ejecutarBusqueda(busqueda), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  const seleccionarPaciente = async (p: Paciente) => {
    setPacienteSeleccionado(p)
    setBusqueda('')
    setFichaSeleccionada(null)
    setOrdenes([])
    setOrdenesSeleccionadas(new Set())
    setConceptos([])
    setCobros([])
    setCargandoFichas(true)
    setError('')
    try {
      const res = await fichaService.listar({ paciente: p.id, en_curso: true, page_size: 50 })
      setFichas(res.data.results)
    } catch {
      setError('No se pudieron cargar las fichas del paciente.')
    } finally {
      setCargandoFichas(false)
    }
  }

  const cargarOrdenesYCobros = async (ficha: FichaBrief) => {
    setCargandoOrdenes(true)
    setCargandoCobros(true)
    setError('')
    try {
      const [ordenesData, cobrosRes] = await Promise.all([
        listarOrdenesPorFicha(ficha.id),
        cobroService.listarPorFicha(ficha.id),
      ])
      setOrdenes(ordenesData)
      setCobros(cobrosRes.data)
    } catch {
      setError('No se pudieron cargar las órdenes o el historial de cobros.')
    } finally {
      setCargandoOrdenes(false)
      setCargandoCobros(false)
    }
  }

  const seleccionarFicha = (f: FichaBrief) => {
    setFichaSeleccionada(f)
    setOrdenesSeleccionadas(new Set())
    setConceptos([])
    void cargarOrdenesYCobros(f)
  }

  const toggleOrden = (id: number) => {
    setOrdenesSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const agregarConcepto = () => {
    const montoNum = parseFloat(nuevoMonto)
    if (!nuevoDescripcion.trim() || isNaN(montoNum) || montoNum <= 0) {
      setError('Completa la descripción y un monto válido mayor a 0.')
      return
    }
    setConceptos(prev => [...prev, { id: crypto.randomUUID(), descripcion: nuevoDescripcion.trim(), monto: nuevoMonto }])
    setNuevoDescripcion('')
    setNuevoMonto('')
    setError('')
  }

  const quitarConcepto = (id: string) => {
    setConceptos(prev => prev.filter(c => c.id !== id))
  }

  const totalMonto = conceptos.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0)

  const generarCobro = async () => {
    if (!fichaSeleccionada) return
    if (conceptos.length === 0) {
      setError('Agrega al menos un concepto manual con su monto antes de generar el cobro.')
      return
    }
    setGenerando(true)
    setError('')
    try {
      const ordenesLabels = ordenes
        .filter(o => ordenesSeleccionadas.has(o.id))
        .map(o => o.tipo_label || o.tipo)
      const conceptosLabels = conceptos.map(c => c.descripcion)
      const concepto = [...ordenesLabels, ...conceptosLabels].join(', ').slice(0, 255)

      const res = await cobroService.crearSesion({
        ficha_id: fichaSeleccionada.id,
        concepto,
        monto: totalMonto,
      })
      window.open(res.data.checkout_url, '_blank')
      setOrdenesSeleccionadas(new Set())
      setConceptos([])
      await cargarOrdenesYCobros(fichaSeleccionada)
    } catch {
      setError('No se pudo generar el cobro. Verifica los datos e intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const anularCobro = async (cobro: Cobro) => {
    setAnulandoId(cobro.id)
    setError('')
    try {
      await cobroService.anular(cobro.id)
      if (fichaSeleccionada) await cargarOrdenesYCobros(fichaSeleccionada)
    } catch {
      setError('No se pudo anular el cobro.')
    } finally {
      setAnulandoId(null)
    }
  }

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', color: '#0003B8', fontWeight: 700, margin: 0 }}>
          Cobro de Servicios
        </h1>
        <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0 0' }}>
          Selecciona la ficha del paciente para generar o revisar cobros
        </p>
      </div>

      {error && (
        <div style={{
          background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA',
          borderRadius: '8px', padding: '10px 16px', marginBottom: '20px', fontSize: '13px',
        }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}

      <div style={{
        background: 'white', borderRadius: '12px', padding: '16px 20px',
        marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
      }}>
        <label style={{ fontSize: '13px', color: '#0003B8', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Buscar paciente por CI o apellido
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={pacienteSeleccionado ? `${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido} (CI ${pacienteSeleccionado.ci})` : busqueda}
            onChange={e => { setBusqueda(e.target.value); setPacienteSeleccionado(null) }}
            onKeyDown={e => { if (e.key === 'Enter') ejecutarBusqueda(busqueda) }}
            placeholder="Escribe el nombre, apellido o CI..."
            style={{
              flex: 1, padding: '10px 14px', fontSize: '14px', borderRadius: '8px',
              border: '1.5px solid #B3D4FF', outline: 'none', color: '#0003B8',
            }}
          />
          <button
            type="button"
            onClick={() => ejecutarBusqueda(busqueda)}
            style={{
              background: '#0003B8', color: 'white', border: 'none',
              borderRadius: '8px', padding: '10px 22px', fontWeight: 600,
              fontSize: '14px', cursor: 'pointer',
            }}
          >
            Buscar
          </button>
        </div>

        {buscandoPaciente && <p style={{ fontSize: '12px', color: '#888', margin: '8px 0 0' }}>Buscando...</p>}

        {!pacienteSeleccionado && (
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {busqueda.trim() ? `Resultados para "${busqueda}"` : 'Todos los pacientes'}
            </p>
            {pacientes.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#888' }}>No se encontraron pacientes.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {pacientes.map(p => (
                  <button
                    key={p.id}
                    onClick={() => void seleccionarPaciente(p)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '12px 14px', background: '#F0F6FF', border: '1px solid #E6EEFF',
                      borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#E6EEFF'; e.currentTarget.style.borderColor = '#B3D4FF' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#F0F6FF'; e.currentTarget.style.borderColor = '#E6EEFF' }}
                  >
                    <span style={{ fontWeight: 700, color: '#0003B8', fontSize: '13px' }}>
                      {p.nombre} {p.apellido}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      CI {p.ci}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {pacienteSeleccionado && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '16px 20px',
          marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
        }}>
          <label style={{ fontSize: '13px', color: '#0003B8', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            Ficha del paciente
          </label>
          {cargandoFichas ? (
            <p style={{ fontSize: '13px', color: '#888' }}>Cargando fichas...</p>
          ) : fichas.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#888' }}>Este paciente no tiene fichas abiertas.</p>
          ) : (
            <select
              value={fichaSeleccionada?.id ?? ''}
              onChange={e => {
                const f = fichas.find(x => x.id === Number(e.target.value))
                if (f) seleccionarFicha(f)
              }}
              style={{
                width: '100%', padding: '10px 14px', fontSize: '14px', borderRadius: '8px',
                border: '1.5px solid #B3D4FF', color: '#0003B8', background: 'white', cursor: 'pointer',
              }}
            >
              <option value="">Selecciona una ficha...</option>
              {fichas.map(f => (
                <option key={f.id} value={f.id}>
                  {f.correlativo} — {f.estado} — {f.fecha_apertura?.slice(0, 10)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {fichaSeleccionada && (
        <>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 20px',
            marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
          }}>
            <h2 style={{ fontSize: '15px', color: '#0003B8', fontWeight: 700, margin: '0 0 12px' }}>
              Órdenes de estudio de la ficha
            </h2>
            {cargandoOrdenes ? (
              <p style={{ fontSize: '13px', color: '#888' }}>Cargando órdenes...</p>
            ) : ordenes.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#888' }}>Esta ficha no tiene órdenes de estudio.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ordenes.map(o => (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: '#333' }}>
                    <input
                      type="checkbox"
                      checked={ordenesSeleccionadas.has(o.id)}
                      onChange={() => toggleOrden(o.id)}
                    />
                    <span style={{ fontWeight: 600, color: '#0003B8' }}>{o.tipo_label}</span>
                    <span style={{ color: '#888' }}>· {o.correlativo_orden} · {o.estado_label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 20px',
            marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
          }}>
            <h2 style={{ fontSize: '15px', color: '#0003B8', fontWeight: 700, margin: '0 0 12px' }}>
              Conceptos a cobrar
            </h2>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input
                value={nuevoDescripcion}
                onChange={e => setNuevoDescripcion(e.target.value)}
                placeholder="Descripción (ej. Consulta general)"
                style={{ flex: 2, minWidth: '180px', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1.5px solid #B3D4FF', color: '#333' }}
              />
              <input
                value={nuevoMonto}
                onChange={e => setNuevoMonto(e.target.value)}
                placeholder="Monto (Bs)"
                type="number"
                min="0"
                step="0.01"
                style={{ flex: 1, minWidth: '100px', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1.5px solid #B3D4FF', color: '#333' }}
              />
              <button
                type="button"
                onClick={agregarConcepto}
                style={{ background: '#0003B8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
              >
                + Agregar
              </button>
            </div>

            {conceptos.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#888' }}>Todavía no agregaste ningún concepto.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {conceptos.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #F0F6FF', color: '#333' }}>
                    <span>{c.descripcion}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <strong style={{ color: '#0003B8' }}>Bs {parseFloat(c.monto).toFixed(2)}</strong>
                      <button onClick={() => quitarConcepto(c.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontWeight: 700 }}>×</button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #F0F6FF', paddingTop: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0003B8' }}>
                Total: Bs {totalMonto.toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => void generarCobro()}
                disabled={generando || conceptos.length === 0}
                style={{
                  background: generando || conceptos.length === 0 ? '#B3D4FF' : '#00A896',
                  color: 'white', border: 'none', borderRadius: '8px',
                  padding: '10px 24px', fontWeight: 700, fontSize: '14px',
                  cursor: generando || conceptos.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {generando ? 'Generando...' : 'Generar cobro'}
              </button>
            </div>
          </div>

          <div style={{
            background: 'white', borderRadius: '12px', padding: '16px 20px',
            boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
          }}>
            <h2 style={{ fontSize: '15px', color: '#0003B8', fontWeight: 700, margin: '0 0 12px' }}>
              Historial de cobros de la ficha
            </h2>
            <button
              type="button"
              onClick={() => void cargarOrdenesYCobros(fichaSeleccionada)}
              style={{
                background: 'transparent', color: '#0003B8', border: '1.5px solid #B3D4FF',
                borderRadius: '6px', padding: '5px 14px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, marginBottom: '12px',
              }}
            >
              ↻ Refrescar
            </button>
            {cargandoCobros ? (
              <p style={{ fontSize: '13px', color: '#888' }}>Cargando historial...</p>
            ) : cobros.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#888' }}>Todavía no hay cobros generados para esta ficha.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0F6FF' }}>
                    {['Concepto', 'Monto', 'Estado', 'Fecha', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === '' ? 'right' : 'left', fontSize: '12px', fontWeight: 700, color: '#0003B8', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cobros.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid #F0F6FF' }}>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: '#333' }}>{c.concepto}</td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: '#0003B8' }}>Bs {parseFloat(c.monto).toFixed(2)}</td>
                      <td style={{ padding: '10px 14px' }}><EstadoCobroBadge estado={c.estado} /></td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#888' }}>{c.creado_en.slice(0, 10)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {c.estado === 'PENDIENTE' && (
                          <button
                            onClick={() => void anularCobro(c)}
                            disabled={anulandoId === c.id}
                            style={{
                              background: 'transparent', color: '#DC2626',
                              border: '1.5px solid #FECACA', borderRadius: '6px',
                              padding: '5px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            }}
                          >
                            {anulandoId === c.id ? 'Anulando...' : 'Anular'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}