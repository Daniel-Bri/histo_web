import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/axiosConfig'
import {
  listarPermisos,
  otorgarPermiso,
  revocarPermiso,
  type PermisoPaciente,
} from '../services/permisoService'
import { fetchPersonal, type PersonalSalud } from '../services/personalService'

interface PacienteMin {
  id: number
  ci: string
  nombres: string
  apellido_paterno: string
  apellido_materno: string
}

interface PaginatedPacientes {
  results: PacienteMin[]
}

type FiltroActivo = 'todos' | 'activos' | 'inactivos'

function parseDrfError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Error desconocido.'
  const resp = (err as { response?: { data?: unknown } }).response?.data
  if (!resp || typeof resp !== 'object') return 'Error al procesar la solicitud.'
  const d = resp as Record<string, unknown>
  if (typeof d.detail === 'string') return d.detail
  const msgs: string[] = []
  for (const val of Object.values(d)) {
    if (Array.isArray(val)) msgs.push(...val.map(String))
    else if (typeof val === 'string') msgs.push(val)
  }
  return msgs.join(' ') || 'Error al procesar la solicitud.'
}

function nombreMedico(m: PersonalSalud) {
  return [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || m.user.username
}

export default function GestionPermisos() {
  // ── Lista de permisos ──────────────────────────────────────────
  const [permisos, setPermisos]               = useState<PermisoPaciente[]>([])
  const [loadingPermisos, setLoadingPermisos] = useState(true)
  const [errorPermisos, setErrorPermisos]     = useState('')
  const [filtro, setFiltro]                   = useState<FiltroActivo>('todos')

  // ── Médicos (cargados una vez) ─────────────────────────────────
  const [medicos, setMedicos] = useState<PersonalSalud[]>([])

  // ── Búsqueda de paciente (auto-search con debounce) ────────────
  const debounceRef                                         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [busquedaPaciente, setBusquedaPaciente]             = useState('')
  const [pacientesEncontrados, setPacientesEncontrados]     = useState<PacienteMin[]>([])
  const [buscandoPaciente, setBuscandoPaciente]             = useState(false)
  const [sinResultadosPaciente, setSinResultadosPaciente]   = useState(false)
  const [pacienteSeleccionado, setPacienteSeleccionado]     = useState<PacienteMin | null>(null)

  // ── Búsqueda de médico (typeahead client-side) ─────────────────
  const [busquedaMedico, setBusquedaMedico]           = useState('')
  const [medicoSeleccionado, setMedicoSeleccionado]   = useState<PersonalSalud | null>(null)
  const [medicoId, setMedicoId]                       = useState('')
  const [dropdownMedicoVisible, setDropdownMedicoVisible] = useState(false)

  // ── Formulario ─────────────────────────────────────────────────
  const [otorgando, setOtorgando]   = useState(false)
  const [errorForm, setErrorForm]   = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // ── Revocar ────────────────────────────────────────────────────
  const [permisoAConfirmar, setPermisoAConfirmar] = useState<PermisoPaciente | null>(null)
  const [revocandoId, setRevocandoId]             = useState<number | null>(null)
  const [errorRevoke, setErrorRevoke]             = useState('')

  // ── Carga inicial ──────────────────────────────────────────────
  const cargarPermisos = useCallback(async () => {
    setLoadingPermisos(true)
    setErrorPermisos('')
    try {
      setPermisos(await listarPermisos())
    } catch {
      setErrorPermisos('No se pudo cargar la lista de permisos. Verifique la sesión.')
    } finally {
      setLoadingPermisos(false)
    }
  }, [])

  useEffect(() => { void cargarPermisos() }, [cargarPermisos])

  useEffect(() => {
    fetchPersonal(false)
      .then(data => setMedicos(data.filter(p => p.rol === 'medico' && p.is_active)))
      .catch(() => {/* silent */})
  }, [])

  // ── Auto-search paciente con debounce 300 ms ───────────────────
  useEffect(() => {
    if (pacienteSeleccionado) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = busquedaPaciente.trim()
    if (!q) {
      setPacientesEncontrados([])
      setSinResultadosPaciente(false)
      setBuscandoPaciente(false)
      return
    }

    setBuscandoPaciente(true)
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const { data } = await api.get<PaginatedPacientes>('pacientes/pacientes/', {
            params: { search: q, page_size: 10 },
          })
          setPacientesEncontrados(data.results)
          setSinResultadosPaciente(data.results.length === 0)
        } catch {
          // silent
        } finally {
          setBuscandoPaciente(false)
        }
      })()
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [busquedaPaciente, pacienteSeleccionado])

  const seleccionarPaciente = (p: PacienteMin) => {
    setPacienteSeleccionado(p)
    setPacientesEncontrados([])
    setBusquedaPaciente('')
    setSinResultadosPaciente(false)
  }

  // ── Typeahead médico (filtrado client-side) ────────────────────
  const medicosFiltrados = busquedaMedico.trim()
    ? medicos.filter(m => {
        const q = busquedaMedico.toLowerCase()
        return (
          m.user.first_name.toLowerCase().includes(q) ||
          m.user.last_name.toLowerCase().includes(q) ||
          m.user.username.toLowerCase().includes(q)
        )
      })
    : medicos

  const seleccionarMedico = (m: PersonalSalud) => {
    setMedicoSeleccionado(m)
    setMedicoId(String(m.user.id))
    setBusquedaMedico('')
    setDropdownMedicoVisible(false)
  }

  // ── Otorgar ────────────────────────────────────────────────────
  const handleOtorgar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteSeleccionado) { setErrorForm('Seleccione un paciente.'); return }
    if (!medicoId)             { setErrorForm('Seleccione un médico.');   return }
    setOtorgando(true)
    setErrorForm('')
    setSuccessMsg('')
    try {
      await otorgarPermiso(pacienteSeleccionado.id, Number(medicoId))
      setSuccessMsg('Permiso otorgado correctamente.')
      setPacienteSeleccionado(null)
      setMedicoSeleccionado(null)
      setMedicoId('')
      setBusquedaMedico('')
      void cargarPermisos()
    } catch (err) {
      setErrorForm(parseDrfError(err))
    } finally {
      setOtorgando(false)
    }
  }

  // ── Revocar ────────────────────────────────────────────────────
  const handleRevocar = async (p: PermisoPaciente) => {
    setPermisoAConfirmar(null)
    setRevocandoId(p.id)
    setErrorRevoke('')
    try {
      await revocarPermiso(p.paciente_id, p.medico_id)
      void cargarPermisos()
    } catch (err) {
      setErrorRevoke(parseDrfError(err))
    } finally {
      setRevocandoId(null)
    }
  }

  const permisosFiltrados = permisos.filter(p => {
    if (filtro === 'activos')   return p.activo
    if (filtro === 'inactivos') return !p.activo
    return true
  })

  // ── Estilos reutilizables ──────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid #cbd5e1', fontSize: '13px',
    outline: 'none', color: '#0D1B2A', boxSizing: 'border-box',
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
    background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: '220px',
    overflowY: 'auto',
  }

  const dropdownItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '10px 14px', background: 'none', border: 'none',
    cursor: 'pointer', fontSize: '13px', color: '#0D1B2A',
    borderBottom: '1px solid #f1f5f9',
  }

  return (
    <div style={{ padding: '28px 32px', background: '#F0F6FF', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0D1B2A', margin: 0 }}>
          Permisos de Acceso al Expediente
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
          Gestión de permisos para que médicos accedan al expediente clínico de pacientes.
        </p>
      </div>

      {/* ── Formulario otorgar ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: '12px', padding: '20px 24px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '20px',
        border: '1px solid #e2e8f0',
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#0D1B2A', margin: '0 0 16px' }}>
          Otorgar nuevo permiso
        </h2>

        <form onSubmit={(e) => void handleOtorgar(e)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>

            {/* ── Paciente ── */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Paciente
              </label>

              {pacienteSeleccionado ? (
                /* Chip de selección */
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 12px', background: '#f0fdf4',
                  border: '1px solid #86efac', borderRadius: '8px',
                }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#166534', fontWeight: 500 }}>
                    {pacienteSeleccionado.nombres} {pacienteSeleccionado.apellido_paterno} — CI: {pacienteSeleccionado.ci}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPacienteSeleccionado(null)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ) : (
                /* Typeahead de paciente */
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={busquedaPaciente}
                      onChange={e => setBusquedaPaciente(e.target.value)}
                      onBlur={() => setTimeout(() => { setPacientesEncontrados([]); setSinResultadosPaciente(false) }, 200)}
                      placeholder="Escriba CI o nombre para buscar…"
                      style={inputStyle}
                      autoComplete="off"
                    />
                    {buscandoPaciente && (
                      <span style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        fontSize: '11px', color: '#94a3b8',
                      }}>
                        buscando…
                      </span>
                    )}
                  </div>

                  {pacientesEncontrados.length > 0 && (
                    <div style={dropdownStyle}>
                      {pacientesEncontrados.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => seleccionarPaciente(p)}
                          style={dropdownItemStyle}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <strong>{p.nombres} {p.apellido_paterno} {p.apellido_materno}</strong>
                          <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '12px' }}>
                            CI: {p.ci}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {sinResultadosPaciente && !buscandoPaciente && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0', paddingLeft: '2px' }}>
                      Sin resultados para "{busquedaPaciente}".
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Médico ── */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Médico
              </label>

              {medicoSeleccionado ? (
                /* Chip de selección */
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 12px', background: '#eff6ff',
                  border: '1px solid #93c5fd', borderRadius: '8px',
                }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#1d4ed8', fontWeight: 500 }}>
                    {nombreMedico(medicoSeleccionado)}
                    <span style={{ fontWeight: 400, color: '#3b82f6', marginLeft: '6px' }}>
                      @{medicoSeleccionado.user.username}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMedicoSeleccionado(null); setMedicoId('') }}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ) : (
                /* Typeahead de médico */
                <div style={{ position: 'relative' }}>
                  <input
                    value={busquedaMedico}
                    onChange={e => { setBusquedaMedico(e.target.value); setDropdownMedicoVisible(true) }}
                    onBlur={() => setTimeout(() => setDropdownMedicoVisible(false), 200)}
                    placeholder="Escriba nombre o usuario del médico…"
                    style={inputStyle}
                    autoComplete="off"
                  />

                  {dropdownMedicoVisible && busquedaMedico.trim() && (
                    <div style={dropdownStyle}>
                      {medicosFiltrados.length === 0 ? (
                        <div style={{ padding: '12px 14px', fontSize: '13px', color: '#94a3b8' }}>
                          Sin médicos activos{busquedaMedico ? ` para "${busquedaMedico}"` : ''}.
                        </div>
                      ) : (
                        medicosFiltrados.map(m => (
                          <button
                            key={m.user.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => seleccionarMedico(m)}
                            style={dropdownItemStyle}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <strong>{nombreMedico(m)}</strong>
                            <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '12px' }}>
                              @{m.user.username}
                            </span>
                            {m.especialidad && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                                {m.especialidad.nombre}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {errorForm && (
            <div style={{
              padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: '8px', color: '#dc2626', fontSize: '13px', marginBottom: '12px',
            }}>
              {errorForm}
            </div>
          )}
          {successMsg && (
            <div style={{
              padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: '8px', color: '#166534', fontSize: '13px', marginBottom: '12px',
            }}>
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={otorgando}
            style={{
              padding: '9px 22px', background: '#122268', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: otorgando ? 'default' : 'pointer', opacity: otorgando ? 0.7 : 1,
            }}
          >
            {otorgando ? 'Otorgando…' : 'Otorgar permiso'}
          </button>
        </form>
      </div>

      {/* ── Lista de permisos ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: '12px', padding: '20px 24px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#0D1B2A', margin: 0 }}>
            Permisos registrados
            {!loadingPermisos && (
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginLeft: '8px' }}>
                ({permisosFiltrados.length})
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['todos', 'activos', 'inactivos'] as FiltroActivo[]).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                style={{
                  padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  border: '1px solid', borderColor: filtro === f ? '#122268' : '#e2e8f0',
                  background: filtro === f ? '#122268' : 'white',
                  color: filtro === f ? 'white' : '#64748b',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {errorRevoke && (
          <div style={{
            padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '8px', color: '#dc2626', fontSize: '13px', marginBottom: '12px',
          }}>
            {errorRevoke}
          </div>
        )}

        {loadingPermisos ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '14px' }}>
            Cargando permisos…
          </div>
        ) : errorPermisos ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#dc2626', fontSize: '14px' }}>
            {errorPermisos}
            <br />
            <button
              onClick={() => void cargarPermisos()}
              style={{
                marginTop: '12px', padding: '7px 16px', background: '#122268', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
              }}
            >
              Reintentar
            </button>
          </div>
        ) : permisosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px' }}>
            No hay permisos {filtro !== 'todos' ? filtro : 'registrados'}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Paciente', 'CI', 'Médico autorizado', 'Otorgado por', 'Fecha otorgamiento', 'Revocación', 'Estado', 'Acción'].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px', textAlign: 'left',
                      borderBottom: '2px solid #e2e8f0',
                      color: '#64748b', fontSize: '11px',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permisosFiltrados.map(p => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafbfc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '11px 12px', color: '#0D1B2A', fontWeight: 500 }}>
                      {p.paciente_nombre}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>
                      {p.paciente_ci}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#0D1B2A' }}>
                      {p.medico_nombre}
                      <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>
                        @{p.medico_username}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', color: '#64748b', fontSize: '12px' }}>
                      @{p.otorgado_por_username}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(p.fecha_otorgamiento).toLocaleString('es-BO')}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {p.fecha_revocacion
                        ? new Date(p.fecha_revocacion).toLocaleString('es-BO')
                        : <span style={{ color: '#cbd5e1' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: 600,
                        background: p.activo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)',
                        color: p.activo ? '#059669' : '#dc2626',
                        border: `1px solid ${p.activo ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {p.activo ? 'Activo' : 'Revocado'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      {p.activo && (
                        <button
                          onClick={() => setPermisoAConfirmar(p)}
                          disabled={revocandoId === p.id}
                          style={{
                            padding: '5px 12px', background: 'rgba(239,68,68,0.07)',
                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
                            color: '#dc2626', fontSize: '12px', fontWeight: 600,
                            cursor: revocandoId === p.id ? 'default' : 'pointer',
                            opacity: revocandoId === p.id ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {revocandoId === p.id ? 'Revocando…' : 'Revocar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de confirmación de revocación ── */}
      {permisoAConfirmar && (
        <div
          onClick={() => setPermisoAConfirmar(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '14px', padding: '28px 32px',
              maxWidth: '440px', width: '90%',
              boxShadow: '0 8px 40px rgba(0,0,0,0.20)',
            }}
          >
            {/* Icono de advertencia */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg viewBox="0 0 20 20" width="22" height="22" fill="none"
                stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L2 17h16L10 3z" />
                <line x1="10" y1="9" x2="10" y2="12" />
                <circle cx="10" cy="14.5" r="0.5" fill="#dc2626" />
              </svg>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0D1B2A', margin: '0 0 8px' }}>
              ¿Revocar permiso?
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 6px', lineHeight: 1.6 }}>
              Se revocará el acceso de{' '}
              <strong style={{ color: '#0D1B2A' }}>{permisoAConfirmar.medico_nombre}</strong>
              {' '}al expediente de{' '}
              <strong style={{ color: '#0D1B2A' }}>{permisoAConfirmar.paciente_nombre}</strong>.
            </p>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 24px' }}>
              Esta acción puede deshacerse otorgando el permiso nuevamente.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPermisoAConfirmar(null)}
                style={{
                  padding: '8px 20px', background: 'white',
                  border: '1px solid #e2e8f0', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, color: '#64748b', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleRevocar(permisoAConfirmar)}
                disabled={revocandoId === permisoAConfirmar.id}
                style={{
                  padding: '8px 20px', background: '#dc2626',
                  border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, color: 'white',
                  cursor: revocandoId === permisoAConfirmar.id ? 'default' : 'pointer',
                  opacity: revocandoId === permisoAConfirmar.id ? 0.7 : 1,
                }}
              >
                {revocandoId === permisoAConfirmar.id ? 'Revocando…' : 'Sí, revocar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
