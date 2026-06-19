import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { AxiosError } from 'axios'
import { getStoredUser, hasRole } from '../../utils/auth'
import {
  aprobarBreakGlass,
  listarPendientesBreakGlass,
  rechazarBreakGlass,
  type BreakGlassSolicitudItem,
} from '../../services/breakGlassService'

type ModalState =
  | { tipo: 'aprobar'; solicitud: BreakGlassSolicitudItem }
  | { tipo: 'rechazar'; solicitud: BreakGlassSolicitudItem }
  | null

function extraerMensajeError(error: unknown): string {
  const axiosErr = error as AxiosError<Record<string, unknown>>
  const status = axiosErr.response?.status
  const data = axiosErr.response?.data
  const detail = typeof data?.detail === 'string' ? data.detail : ''

  if (status === 400) return detail || 'La solicitud no pudo procesarse. Revisa los datos enviados.'
  if (status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  if (status === 403) return detail || 'No tienes permisos para aprobar o rechazar solicitudes Break-Glass.'
  if (status === 404) return 'La solicitud Break-Glass ya no existe o no fue encontrada.'
  if (status === 409) return detail || 'La solicitud ya fue procesada por otro usuario.'
  if (status === 500) return 'Ocurrió un error del servidor. Intenta nuevamente.'
  return 'No se pudo completar la operación. Verifica tu conexión e intenta otra vez.'
}

function formatearFecha(valor: string | null): string {
  if (!valor) return 'Sin fecha'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
}

function urgenciaStyle(nivel: string) {
  if (nivel === 'ALTA') return { background: 'transparent', color: '#dc2626', border: 'transparent' }
  if (nivel === 'MEDIA') return { background: 'transparent', color: '#d97706', border: 'transparent' }
  return { background: 'transparent', color: '#0284c7', border: 'transparent' }
}

function estadoStyle(estado: string) {
  if (estado === 'PENDIENTE') return { background: 'transparent', color: '#1d4ed8', border: 'transparent' }
  if (estado === 'APROBADA') return { background: 'transparent', color: '#16a34a', border: 'transparent' }
  if (estado === 'RECHAZADA') return { background: 'transparent', color: '#dc2626', border: 'transparent' }
  return { background: 'transparent', color: '#475569', border: 'transparent' }
}

function Chip({ label, colors }: { label: string; colors: { background: string; color: string; border: string } }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: 'none',
        background: colors.background,
        color: colors.color,
        fontSize: 12,
        fontWeight: 800,
        padding: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export default function AprobacionBreakGlass() {
  const user = getStoredUser()
  const puedeAcceder = useMemo(() => hasRole('Auditor', 'Director') || user?.is_superuser === true, [user?.is_superuser])

  const [solicitudes, setSolicitudes] = useState<BreakGlassSolicitudItem[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [busquedaPaciente, setBusquedaPaciente] = useState('')

  const solicitudesFiltradas = useMemo(() => {
    const texto = busquedaPaciente.trim().toLowerCase()
    if (!texto) return solicitudes
    return solicitudes.filter((solicitud) => {
      const paciente = `${solicitud.paciente_nombre ?? ''} ${solicitud.paciente_ci ?? ''}`.toLowerCase()
      const solicitante = `${solicitud.solicitante_username ?? ''}`.toLowerCase()
      return paciente.includes(texto) || solicitante.includes(texto)
    })
  }, [busquedaPaciente, solicitudes])

  const cargarPendientes = useCallback(async () => {
    if (!puedeAcceder) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await listarPendientesBreakGlass()
      setSolicitudes(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setLoading(false)
    }
  }, [puedeAcceder])

  useEffect(() => {
    void cargarPendientes()
  }, [cargarPendientes])

  const cerrarModal = () => {
    if (procesando) return
    setModal(null)
    setMotivoRechazo('')
  }

  const confirmarAprobacion = async () => {
    if (!modal || modal.tipo !== 'aprobar') return
    setProcesando(true)
    setError('')
    setSuccess('')
    try {
      const response = await aprobarBreakGlass(modal.solicitud.id)
      setSuccess(response.mensaje || 'Solicitud Break-Glass aprobada correctamente.')
      setModal(null)
      await cargarPendientes()
    } catch (err) {
      const mensaje = extraerMensajeError(err)
      setError(mensaje)
      if (mensaje.toLowerCase().includes('expir')) {
        await cargarPendientes()
      }
    } finally {
      setProcesando(false)
    }
  }

  const confirmarRechazo = async () => {
    if (!modal || modal.tipo !== 'rechazar') return
    const motivo = motivoRechazo.trim()
    if (motivo.length < 10) {
      setError('El motivo de rechazo debe tener al menos 10 caracteres.')
      return
    }
    setProcesando(true)
    setError('')
    setSuccess('')
    try {
      const response = await rechazarBreakGlass(modal.solicitud.id, { motivo_rechazo: motivo })
      setSuccess(response.mensaje || 'Solicitud Break-Glass rechazada correctamente.')
      setModal(null)
      setMotivoRechazo('')
      await cargarPendientes()
    } catch (err) {
      const mensaje = extraerMensajeError(err)
      setError(mensaje)
      if (mensaje.toLowerCase().includes('expir')) {
        await cargarPendientes()
      }
    } finally {
      setProcesando(false)
    }
  }

  if (!puedeAcceder) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Aprobación Break-Glass</h1>
          <div style={styles.error}>No autorizado. Solo Auditor o Director pueden revisar solicitudes Break-Glass.</div>
        </section>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <section style={styles.headerCard}>
        <div>
          <p style={styles.eyebrow}>Seguridad clínica</p>
          <h1 style={styles.title}>Aprobación Break-Glass</h1>
          <p style={styles.subtitle}>Revisa solicitudes de acceso de emergencia pendientes y registra una decisión auditada.</p>
        </div>
        <button type="button" onClick={() => void cargarPendientes()} style={styles.secondaryButton} disabled={loading}>
          Actualizar
        </button>
      </section>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <section style={styles.searchCard}>

        <label style={styles.searchLabel}>
          Buscar solicitud por Paciente
          <input
            value={busquedaPaciente}
            onChange={(event) => setBusquedaPaciente(event.target.value)}
            placeholder="Buscar por nombre del paciente, CI o médico solicitante..."
            style={styles.searchInput}
          />
        </label>
      </section>

      <section style={styles.card}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Solicitudes pendientes</h2>
            <p style={styles.subtitleSmall}>
              {loading
                ? 'Cargando solicitudes...'
                : `${solicitudesFiltradas.length} de ${solicitudes.length} solicitud(es) visibles`}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>Cargando solicitudes Break-Glass...</div>
        ) : solicitudes.length === 0 ? (
          <div style={styles.empty}>No hay solicitudes pendientes.</div>
        ) : solicitudesFiltradas.length === 0 ? (
          <div style={styles.empty}>No hay solicitudes que coincidan con tu búsqueda.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Médico solicitante</th>
                  <th style={styles.th}>Paciente</th>
                  <th style={styles.th}>Justificación</th>
                  <th style={styles.th}>Urgencia</th>
                  <th style={styles.th}>Fecha/hora</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.map((solicitud) => {
                  const esPropia = solicitud.solicitante_id === user?.id
                  return (
                    <tr key={solicitud.id}>
                      <td style={styles.td}>{solicitud.solicitante_username || 'Sin usuario'}</td>
                      <td style={styles.td}>
                        <strong>{solicitud.paciente_nombre || 'Paciente sin nombre'}</strong>
                        <span style={styles.cellHint}>{solicitud.paciente_ci || 'Sin CI'}</span>
                      </td>
                      <td style={{ ...styles.td, ...styles.justificacion }}>{solicitud.justificacion}</td>
                      <td style={styles.td}>
                        <Chip label={solicitud.nivel_urgencia} colors={urgenciaStyle(solicitud.nivel_urgencia)} />
                      </td>
                      <td style={styles.td}>{formatearFecha(solicitud.creado_en)}</td>
                      <td style={styles.td}>
                        <Chip label={solicitud.estado} colors={estadoStyle(solicitud.estado)} />
                      </td>
                      <td style={styles.td}>
                        {esPropia ? (
                          <Chip
                            label="No puede aprobar su propia solicitud"
                            colors={{ background: '#f8fafc', color: '#475569', border: '#cbd5e1' }}
                          />
                        ) : (
                          <div style={styles.actions}>
                            <button type="button" style={styles.approveButton} onClick={() => setModal({ tipo: 'aprobar', solicitud })}>
                              Aprobar
                            </button>
                            <button type="button" style={styles.rejectButton} onClick={() => setModal({ tipo: 'rechazar', solicitud })}>
                              Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <div style={styles.overlay} role="dialog" aria-modal="true">
          <section style={styles.modal}>
            <h2 style={styles.modalTitle}>
              {modal.tipo === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud Break-Glass'}
            </h2>
            <p style={styles.modalText}>
              Solicitud de <strong>{modal.solicitud.solicitante_username}</strong> para el expediente de{' '}
              <strong>{modal.solicitud.paciente_nombre}</strong>.
            </p>

            {modal.tipo === 'aprobar' ? (
              <p style={styles.modalWarning}>¿Está seguro que desea aprobar esta solicitud?</p>
            ) : (
              <label style={styles.label}>
                Motivo de rechazo
                <textarea
                  value={motivoRechazo}
                  onChange={(event) => setMotivoRechazo(event.target.value)}
                  placeholder="Explica por qué se rechaza esta solicitud..."
                  style={styles.textarea}
                  rows={5}
                />
                <span style={styles.counter}>{motivoRechazo.trim().length}/10 caracteres mínimos</span>
              </label>
            )}

            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelButton} onClick={cerrarModal} disabled={procesando}>
                Cancelar
              </button>
              {modal.tipo === 'aprobar' ? (
                <button type="button" style={styles.approveButtonLarge} onClick={() => void confirmarAprobacion()} disabled={procesando}>
                  {procesando ? 'Aprobando...' : 'Confirmar aprobación'}
                </button>
              ) : (
                <button
                  type="button"
                  style={styles.rejectButtonLarge}
                  onClick={() => void confirmarRechazo()}
                  disabled={procesando || motivoRechazo.trim().length < 10}
                >
                  {procesando ? 'Rechazando...' : 'Confirmar rechazo'}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    padding: '28px 32px',
    background: '#eef4ff',
    minHeight: '100%',
    color: '#000f5c',
  },
  headerCard: {
    background: '#ffffff',
    border: '1px solid #dbe7ff',
    borderRadius: 18,
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
    padding: 24,
    marginBottom: 18,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchCard: {
    background: '#ffffff',
    border: '1px solid #dbe7ff',
    borderRadius: 18,
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
    padding: 18,
    marginBottom: 18,
  },
  searchHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  searchModeButton: {
    border: '1px solid #0003b8',
    borderRadius: 999,
    background: '#0003b8',
    color: '#ffffff',
    fontWeight: 900,
    fontSize: 13,
    padding: '8px 15px',
    cursor: 'default',
  },
  searchStatus: {
    borderRadius: 999,
    background: '#eef2ff',
    color: '#334155',
    fontWeight: 700,
    fontSize: 12,
    padding: '7px 12px',
  },
  searchLabel: {
    display: 'block',
    color: '#0003b8',
    fontWeight: 800,
    fontSize: 12,
  },
  searchInput: {
    width: '100%',
    height: 44,
    marginTop: 8,
    border: '1.5px solid #2563eb',
    borderRadius: 10,
    padding: '0 14px',
    color: '#0f172a',
    outline: 'none',
    fontSize: 14,
    boxSizing: 'border-box',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #dbe7ff',
    borderRadius: 18,
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
    padding: 22,
  },
  eyebrow: {
    margin: '0 0 6px',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontSize: 11,
    fontWeight: 900,
  },
  title: {
    margin: 0,
    fontSize: 26,
    color: '#0003b8',
    fontWeight: 900,
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#475569',
    fontSize: 14,
  },
  subtitleSmall: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: 12,
  },
  sectionTitle: {
    margin: 0,
    color: '#0003b8',
    fontSize: 18,
    fontWeight: 900,
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
  },
  table: {
    width: '100%',
    minWidth: 980,
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    background: '#f1f6ff',
    color: '#0003b8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    padding: '14px 12px',
    borderBottom: '1px solid #dbe7ff',
  },
  td: {
    padding: '14px 12px',
    borderBottom: '1px solid #eef2ff',
    verticalAlign: 'top',
    color: '#00116b',
    fontSize: 13,
  },
  justificacion: {
    maxWidth: 360,
    lineHeight: 1.45,
    color: '#334155',
  },
  cellHint: {
    display: 'block',
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  approveButton: {
    border: '1px solid #86efac',
    borderRadius: 999,
    background: '#ecfdf5',
    color: '#166534',
    fontWeight: 800,
    fontSize: 12,
    padding: '7px 11px',
    cursor: 'pointer',
    minWidth: 74,
  },
  rejectButton: {
    border: '1px solid #fecaca',
    borderRadius: 999,
    background: '#fff1f2',
    color: '#b91c1c',
    fontWeight: 800,
    fontSize: 12,
    padding: '7px 11px',
    cursor: 'pointer',
    minWidth: 74,
  },
  secondaryButton: {
    border: '1px solid #93c5fd',
    borderRadius: 12,
    background: '#eff6ff',
    color: '#0003b8',
    fontWeight: 800,
    padding: '11px 16px',
    cursor: 'pointer',
  },
  empty: {
    border: '1px dashed #bfdbfe',
    background: '#f8fbff',
    borderRadius: 14,
    padding: 28,
    color: '#475569',
    textAlign: 'center',
    fontWeight: 700,
  },
  error: {
    background: '#fff1f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 14,
    fontWeight: 700,
  },
  success: {
    background: '#ecfdf5',
    border: '1px solid #bbf7d0',
    color: '#166534',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 14,
    fontWeight: 700,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modal: {
    width: 'min(620px, 100%)',
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
    padding: 24,
    border: '1px solid #dbe7ff',
  },
  modalTitle: {
    margin: '0 0 10px',
    color: '#0003b8',
    fontSize: 22,
    fontWeight: 900,
  },
  modalText: {
    color: '#334155',
    lineHeight: 1.5,
  },
  modalWarning: {
    background: '#f8fbff',
    border: '1px solid #dbe7ff',
    borderRadius: 12,
    padding: 14,
    color: '#00116b',
    fontWeight: 700,
  },
  label: {
    display: 'block',
    color: '#0003b8',
    fontWeight: 900,
    marginTop: 16,
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    marginTop: 8,
    border: '1px solid #bfdbfe',
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    outline: 'none',
    fontFamily: 'inherit',
  },
  counter: {
    display: 'block',
    color: '#64748b',
    fontSize: 12,
    marginTop: 6,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  cancelButton: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    color: '#0003b8',
    fontWeight: 800,
    padding: '11px 16px',
    cursor: 'pointer',
  },
  approveButtonLarge: {
    border: 'none',
    borderRadius: 12,
    background: '#0b8f4d',
    color: '#fff',
    fontWeight: 900,
    padding: '11px 18px',
    cursor: 'pointer',
  },
  rejectButtonLarge: {
    border: 'none',
    borderRadius: 12,
    background: '#dc2626',
    color: '#fff',
    fontWeight: 900,
    padding: '11px 18px',
    cursor: 'pointer',
  },
}
