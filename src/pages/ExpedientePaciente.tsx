import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/axiosConfig'
import { hasRole } from '../utils/auth'
import { registrarPacienteReciente } from '../components/Layout'
import {
  listarMisSolicitudesBreakGlass,
  solicitarBreakGlass,
  type BreakGlassSolicitudItem,
  type BreakGlassUrgencia,
} from '../services/breakGlassService'

interface Antecedentes {
  grupo_sanguineo?: string
  alergias?: string
  ant_patologicos?: string
  ant_no_patologicos?: string
  ant_quirurgicos?: string
  ant_familiares?: string
  ant_gineco_obstetricos?: string
  medicacion_actual?: string
  esquema_vacunacion?: string
}

interface Triaje {
  id: number
  hora_triaje: string
  nivel_urgencia?: string
  nivel_urgencia_label?: string
  motivo_consulta_triaje?: string
  temperatura_celsius?: number
  saturacion_oxigeno?: number
  frecuencia_cardiaca?: number
  presion_arterial?: string
}

interface Consulta {
  id: number
  creado_en: string
  estado?: string
  estado_label?: string
  motivo_consulta: string
  impresion_diagnostica: string
  codigo_cie10_principal?: string
  descripcion_cie10?: string
  plan_tratamiento?: string
}

interface ExpedienteData {
  id: number
  ci: string
  ci_complemento?: string
  nombres: string
  apellido_paterno: string
  apellido_materno?: string
  fecha_nacimiento: string
  sexo_label?: string
  autoidentificacion_label?: string
  telefono?: string
  direccion?: string
  tipo_seguro_label?: string
  numero_asegurado?: string
  antecedentes?: Antecedentes | null
  triajes?: Triaje[]
  consultas?: Consulta[]
}

// ── helpers ──────────────────────────────────────────────────────────────────
const txt = (v?: string | null) => (v && String(v).trim() ? v : '—')
const fechaCorta = (v?: string) => v ? new Date(v).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fechaHora  = (v?: string) => v ? new Date(v).toLocaleString('es-BO',  { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function calcEdad(fechaNac: string) {
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

// ── colores urgencia ──────────────────────────────────────────────────────────
const URGENCIA_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  ROJO:     { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' },
  NARANJA:  { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  AMARILLO: { bg: '#FFFDE7', color: '#F57F17', border: '#FFF176' },
  VERDE:    { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  AZUL:     { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
}

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  BORRADOR:   { bg: '#F5F5F5', color: '#757575' },
  COMPLETADA: { bg: '#E3F2FD', color: '#1565C0' },
  FIRMADA:    { bg: '#E8F5E9', color: '#2E7D32' },
}

// ── sub-components ────────────────────────────────────────────────────────────
function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', color: '#1a1a2e', fontWeight: value === '—' ? 400 : 500, opacity: value === '—' ? 0.4 : 1 }}>
        {value}
      </span>
    </div>
  )
}

function AntBox({ label, value }: { label: string; value?: string }) {
  const empty = !value || !value.trim()
  return (
    <div style={{
      background: '#F8FAFF', border: '1px solid #E7EEFF',
      borderRadius: '10px', padding: '12px 14px',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px 0' }}>
        {label}
      </p>
      <p style={{ fontSize: '13px', color: empty ? '#aaa' : '#333', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
        {empty ? 'No registrado' : value}
      </p>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function ExpedientePaciente() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData]       = useState<ExpedienteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [showBreakGlass, setShowBreakGlass] = useState(false)
  const [breakGlassSolicitud, setBreakGlassSolicitud] = useState<BreakGlassSolicitudItem | null>(null)
  const [breakGlassPacienteNombre, setBreakGlassPacienteNombre] = useState('')
  const forceBreakGlassView = searchParams.get('vista') === 'break-glass'

  const puedeEditarAntecedentes = hasRole('Médico', 'Enfermera', 'Administrativo', 'Director')

  useEffect(() => {
    if (!id) { setError('ID inválido.'); setLoading(false); return }
    api.get<ExpedienteData>(`expediente/${id}/expediente/`)
      .then(r => {
        setData(r.data)
        if (!forceBreakGlassView) setShowBreakGlass(false)
        registrarPacienteReciente({
          id: r.data.id,
          nombre: `${r.data.nombres} ${r.data.apellido_paterno}`,
          ci: r.data.ci,
        })
        listarMisSolicitudesBreakGlass()
          .then((solicitudes) => {
            const pacienteId = Number(id)
            const ultima = solicitudes
              .filter((s) => s.paciente_id === pacienteId)
              .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0]
            setBreakGlassSolicitud(ultima ?? null)
            if (ultima?.paciente_nombre) setBreakGlassPacienteNombre(ultima.paciente_nombre)
          })
          .catch(() => undefined)
      })
      .catch(async (e) => {
        const status = e?.response?.status
        if (status === 403 && id) {
          setShowBreakGlass(true)
          setError('')
          setData(null)
          const nombreIntento = e?.response?.data?.paciente_nombre
          if (typeof nombreIntento === 'string' && nombreIntento.trim()) {
            setBreakGlassPacienteNombre(nombreIntento)
          }
          try {
            const solicitudes = await listarMisSolicitudesBreakGlass()
            const pacienteId = Number(id)
            const ultima = solicitudes
              .filter((s) => s.paciente_id === pacienteId)
              .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0]
            setBreakGlassSolicitud(ultima ?? null)
            if (ultima?.paciente_nombre) setBreakGlassPacienteNombre(ultima.paciente_nombre)
          } catch {
            // sin acción: se mostrará la pantalla igualmente
          }
          return
        }
        const backendError =
          e?.response?.data?.error ??
          e?.response?.data?.detail
        const isNetworkError =
          e?.message === 'Network Error' || e?.code === 'ERR_NETWORK'
        if (status) {
          setError(`No se pudo cargar el expediente (HTTP ${status}). ${backendError ?? ''}`.trim())
        } else if (isNetworkError) {
          setError('No se pudo conectar con el servidor. Verifica que el backend esté encendido.')
        } else {
          setError(backendError ?? 'No se pudo cargar el expediente.')
        }
      })
      .finally(() => setLoading(false))
  }, [id, forceBreakGlassView])

  return (
    <div style={{ padding: '32px' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/pacientes')}
          style={{
            background: 'transparent', border: 'none',
            color: '#0080FF', fontSize: '13px', cursor: 'pointer', padding: 0, fontWeight: 600,
          }}
        >
          ← Pacientes
        </button>
        {data && (
          <>
            <span style={{ color: '#B3D4FF' }}>/</span>
            <span style={{ color: '#0003B8', fontSize: '13px', fontWeight: 600 }}>
              {data.nombres} {data.apellido_paterno}
            </span>
          </>
        )}
      </div>

      {loading && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '48px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,3,184,0.06)' }}>
          <p style={{ color: '#0003B8', fontWeight: 600 }}>Cargando expediente...</p>
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#E53935', fontWeight: 600, margin: 0 }}>{error}</p>
        </div>
      )}

      {!loading && !error && data && !forceBreakGlassView && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {breakGlassSolicitud && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSearchParams({ vista: 'break-glass' })}
                style={{
                  background: '#0003B8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ver estado de acceso de emergencia
              </button>
            </div>
          )}

          {/* ── Cabecera paciente ── */}
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Avatar */}
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: '#E8EEFF', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '24px', flexShrink: 0,
              }}>
                {data.sexo_label === 'Femenino' ? '👩' : '👨'}
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0003B8', margin: '0 0 4px 0' }}>
                  {data.nombres} {data.apellido_paterno} {data.apellido_materno ?? ''}
                </h1>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Chip label={`CI: ${data.ci}${data.ci_complemento ? `-${data.ci_complemento}` : ''}`} color="#0003B8" />
                  {data.fecha_nacimiento && <Chip label={`${calcEdad(data.fecha_nacimiento)} años`} color="#0080FF" />}
                  {data.sexo_label && <Chip label={data.sexo_label} color="#00A896" />}
                  {data.tipo_seguro_label && <Chip label={data.tipo_seguro_label} color="#5C6BC0" />}
                </div>
              </div>
            </div>

            {/* Botón Perfil de Riesgo */}
            <button
              onClick={() => navigate(`/pacientes/${id}/riesgos`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: '#0003B8', color: 'white',
                border: 'none', borderRadius: '10px',
                padding: '10px 18px', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              🫀 Perfil de Riesgo Clínico
            </button>
          </div>

          {/* ── Datos generales ── */}
          <Section titulo="Datos Generales">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              <InfoBox label="Fecha de nacimiento" value={fechaCorta(data.fecha_nacimiento)} />
              <InfoBox label="Sexo"                value={txt(data.sexo_label)} />
              <InfoBox label="Autoidentificación"  value={txt(data.autoidentificacion_label)} />
              <InfoBox label="Teléfono"            value={txt(data.telefono)} />
              <InfoBox label="Dirección"           value={txt(data.direccion)} />
              <InfoBox label="Tipo de seguro"      value={txt(data.tipo_seguro_label)} />
              <InfoBox label="N° asegurado"        value={txt(data.numero_asegurado)} />
            </div>
          </Section>

          {/* ── Antecedentes médicos ── */}
          <Section
            titulo="Antecedentes Médicos"
            accion={puedeEditarAntecedentes ? (
              <button
                onClick={() => navigate(`/pacientes/${id}/antecedentes/editar`)}
                style={{
                  background: '#0003B8', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '7px 16px',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                }}
              >
                ✏️ Editar
              </button>
            ) : undefined}
          >
            {!data.antecedentes ? (
              <p style={{ color: '#888', margin: 0 }}>Sin antecedentes registrados.</p>
            ) : (
              <>
                {/* Grupo sanguíneo */}
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Grupo sanguíneo
                  </span>
                  <div style={{ marginTop: '6px' }}>
                    <span style={{
                      display: 'inline-block',
                      background: data.antecedentes.grupo_sanguineo === '?' ? '#F5F5F5' : '#E3F2FD',
                      color: data.antecedentes.grupo_sanguineo === '?' ? '#aaa' : '#1565C0',
                      fontWeight: 700, fontSize: '15px',
                      padding: '4px 16px', borderRadius: '20px',
                      border: `1px solid ${data.antecedentes.grupo_sanguineo === '?' ? '#ddd' : '#90CAF9'}`,
                    }}>
                      {data.antecedentes.grupo_sanguineo === '?' ? 'Desconocido' : data.antecedentes.grupo_sanguineo}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  <AntBox label="Alergias"                   value={data.antecedentes.alergias} />
                  <AntBox label="Antecedentes patológicos"   value={data.antecedentes.ant_patologicos} />
                  <AntBox label="No patológicos"             value={data.antecedentes.ant_no_patologicos} />
                  <AntBox label="Quirúrgicos"                value={data.antecedentes.ant_quirurgicos} />
                  <AntBox label="Familiares"                 value={data.antecedentes.ant_familiares} />
                  <AntBox label="Gineco-obstétricos"         value={data.antecedentes.ant_gineco_obstetricos} />
                  <AntBox label="Medicación actual"          value={data.antecedentes.medicacion_actual} />
                  <AntBox label="Esquema de vacunación"      value={data.antecedentes.esquema_vacunacion} />
                </div>
              </>
            )}
          </Section>

          {/* ── Historial ── */}
          <Section titulo="Historial Clínico">

            {/* Triajes */}
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0003B8', margin: '0 0 12px 0', opacity: 0.8 }}>
              TRIAJES ({data.triajes?.length ?? 0})
            </h3>
            {!data.triajes || data.triajes.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '24px' }}>Sin registros de triaje.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginBottom: '28px' }}>
                {data.triajes.map(t => {
                  const urg = t.nivel_urgencia ?? ''
                  const style = URGENCIA_STYLE[urg] ?? { bg: '#F5F5F5', color: '#555', border: '#ddd' }
                  return (
                    <div key={t.id} style={{
                      background: 'white', border: `1px solid ${style.border}`,
                      borderRadius: '12px', overflow: 'hidden',
                    }}>
                      <div style={{ background: style.bg, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: style.color }}>
                          {t.nivel_urgencia_label ?? urg}
                        </span>
                        <span style={{ fontSize: '11px', color: style.color, opacity: 0.75 }}>{fechaHora(t.hora_triaje)}</span>
                      </div>
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#333' }}>
                          <strong>Motivo:</strong> {txt(t.motivo_consulta_triaje)}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <VitalChip label="FC" value={t.frecuencia_cardiaca ? `${t.frecuencia_cardiaca} lpm` : '—'} />
                          <VitalChip label="SpO₂" value={t.saturacion_oxigeno ? `${t.saturacion_oxigeno}%` : '—'} />
                          <VitalChip label="Temp" value={t.temperatura_celsius ? `${t.temperatura_celsius}°C` : '—'} />
                          <VitalChip label="PA" value={t.presion_arterial ?? '—'} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Consultas */}
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0003B8', margin: '0 0 12px 0', opacity: 0.8 }}>
              CONSULTAS ({data.consultas?.length ?? 0})
            </h3>
            {!data.consultas || data.consultas.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '13px' }}>Sin consultas registradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.consultas.map(c => {
                  const est = c.estado ?? ''
                  const estStyle = ESTADO_STYLE[est] ?? { bg: '#F5F5F5', color: '#555' }
                  return (
                    <div key={c.id} style={{
                      background: 'white', border: '1px solid #E7EEFF',
                      borderRadius: '12px', overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '10px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid #F0F6FF',
                      }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{
                            background: estStyle.bg, color: estStyle.color,
                            fontSize: '11px', fontWeight: 700,
                            padding: '3px 10px', borderRadius: '20px',
                          }}>
                            {c.estado_label ?? est}
                          </span>
                          {c.codigo_cie10_principal && (
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0003B8', opacity: 0.7 }}>
                              {c.codigo_cie10_principal}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: '#888' }}>{fechaHora(c.creado_en)}</span>
                      </div>
                      <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.55, margin: '0 0 3px', textTransform: 'uppercase' }}>Motivo</p>
                          <p style={{ fontSize: '13px', color: '#333', margin: 0 }}>{txt(c.motivo_consulta)}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.55, margin: '0 0 3px', textTransform: 'uppercase' }}>Diagnóstico</p>
                          <p style={{ fontSize: '13px', color: '#333', margin: 0 }}>{txt(c.impresion_diagnostica)}</p>
                          {c.descripcion_cie10 && (
                            <p style={{ fontSize: '12px', color: '#888', margin: '3px 0 0' }}>{c.descripcion_cie10}</p>
                          )}
                        </div>
                        {c.plan_tratamiento && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.55, margin: '0 0 3px', textTransform: 'uppercase' }}>Plan de tratamiento</p>
                            <p style={{ fontSize: '13px', color: '#333', margin: 0, whiteSpace: 'pre-line' }}>{c.plan_tratamiento}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      )}

      {!loading && showBreakGlass && !forceBreakGlassView && id && (
        <BreakGlassSolicitudPanel
          pacienteId={Number(id)}
          pacienteNombre={breakGlassPacienteNombre}
          solicitudInicial={breakGlassSolicitud}
          onVerExpediente={() => {
            setSearchParams({})
            setShowBreakGlass(false)
            window.location.reload()
          }}
        />
      )}

      {!loading && forceBreakGlassView && id && (
        <BreakGlassSolicitudPanel
          pacienteId={Number(id)}
          pacienteNombre={
            breakGlassPacienteNombre ||
            (data ? `${data.nombres} ${data.apellido_paterno} ${data.apellido_materno ?? ''}`.trim() : '')
          }
          solicitudInicial={breakGlassSolicitud}
          onVerExpediente={() => {
            setSearchParams({})
            setShowBreakGlass(false)
          }}
        />
      )}
    </div>
  )
}

// ── helpers UI ────────────────────────────────────────────────────────────────
function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}18`, color,
      fontSize: '12px', fontWeight: 600,
      padding: '3px 10px', borderRadius: '20px',
      border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  )
}

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: '12px', color: '#555' }}>
      <strong style={{ color: '#0003B8' }}>{label}</strong> {value}
    </span>
  )
}

function Section({ titulo, accion, children }: {
  titulo: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'white', borderRadius: '14px',
      padding: '22px 26px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0003B8', margin: 0 }}>{titulo}</h2>
        {accion}
      </div>
      {children}
    </div>
  )
}

function BreakGlassSolicitudPanel({
  pacienteId,
  pacienteNombre,
  solicitudInicial,
  onVerExpediente,
}: {
  pacienteId: number
  pacienteNombre: string
  solicitudInicial: BreakGlassSolicitudItem | null
  onVerExpediente: () => void
}) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const [justificacion, setJustificacion] = useState('')
  const [nivelUrgencia, setNivelUrgencia] = useState<BreakGlassUrgencia>('MEDIA')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [solicitud, setSolicitud] = useState<BreakGlassSolicitudItem | null>(solicitudInicial)
  const [ahora, setAhora] = useState(Date.now())
  const chars = justificacion.trim().length
  const minChars = 20

  useEffect(() => {
    setSolicitud(solicitudInicial)
  }, [solicitudInicial])

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const solicitudes = await listarMisSolicitudesBreakGlass()
        const ultima = solicitudes
          .filter((s) => s.paciente_id === pacienteId)
          .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())[0]
        if (ultima) setSolicitud(ultima)
      } catch {
        // polling silencioso
      }
    }, 10000)
    return () => clearInterval(t)
  }, [pacienteId])

  const onSubmit = async () => {
    setError('')
    setMsg('')
    if (chars < minChars) {
      setError(`La justificación debe tener al menos ${minChars} caracteres.`)
      return
    }
    try {
      setSending(true)
      const created = await solicitarBreakGlass({
        paciente_id: pacienteId,
        justificacion: justificacion.trim(),
        nivel_urgencia: nivelUrgencia,
      })
      setSolicitud(created)
      setMsg(created.advertencia ?? 'Solicitud enviada. Quedó registrada para revisión.')
    } catch (e: any) {
      const status = e?.response?.status
      const data = e?.response?.data
      if (status === 400) {
        const raw = typeof data === 'object' && data ? JSON.stringify(data) : ''
        if (raw.includes('justificación') || raw.includes('justificacion')) {
          setError('La justificación no es válida. Verifica que sea clara y suficiente.')
        } else if (raw.includes('pendiente') || raw.includes('acceso activo')) {
          setError('Ya existe una solicitud pendiente o un acceso temporal activo para este paciente.')
        } else {
          setError('No se pudo registrar la solicitud. Revisa los datos ingresados.')
        }
      } else if (status === 401) {
        setError('Tu sesión expiró. Inicia sesión nuevamente.')
      } else if (status === 403) {
        setError('Tu usuario no tiene permisos para solicitar acceso de emergencia.')
      } else if (status === 404) {
        setError('El paciente no existe o ya no está disponible.')
      } else {
        setError('Ocurrió un error inesperado. Intenta nuevamente.')
      }
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase()
      if (ev.ctrlKey && key === 'f') {
        ev.preventDefault()
        textAreaRef.current?.focus()
      }
      if (ev.ctrlKey && key === 's') {
        ev.preventDefault()
        void onSubmit()
      }
      if (key === 'escape') {
        ev.preventDefault()
        onVerExpediente()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    const dirty = justificacion.trim().length > 0 && !sending
    if (!dirty) return
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      ev.preventDefault()
      ev.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [justificacion, sending])

  const accesoHastaMs = solicitud?.acceso_hasta ? new Date(solicitud.acceso_hasta).getTime() : null
  const restanteMs = accesoHastaMs ? accesoHastaMs - ahora : 0
  const accesoActivo = Boolean(solicitud?.acceso_activo && restanteMs > 0)
  const restanteTxt = accesoActivo ? formatRemaining(restanteMs) : null

  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: 24,
      boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
      border: '1px solid #E7EEFF',
    }}>
      <h2 style={{ fontSize: 20, color: '#0003B8', margin: '0 0 8px 0' }}>Solicitud de Acceso de Emergencia</h2>
      <p style={{ margin: '0 0 12px 0', color: '#334' }}>
        Paciente: <strong>{pacienteNombre || `Paciente #${pacienteId}`}</strong>
      </p>
      <p style={{ margin: '0 0 18px 0', color: '#334' }}>
        No tienes permiso para acceder a este expediente. Puedes solicitar acceso de emergencia si existe una
        situación clínica justificada.
      </p>

      {solicitud && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, border: '1px solid #D7E6FF', background: '#F7FAFF' }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Estado actual: <strong>{solicitud.estado}</strong> | Urgencia: <strong>{solicitud.nivel_urgencia}</strong>
          </p>
          {accesoActivo && (
            <p style={{ margin: '8px 0 0 0', color: '#0B5', fontWeight: 600 }}>
              Acceso temporal concedido por emergencia. Vence en {restanteTxt}.
            </p>
          )}
          {!accesoActivo && solicitud.estado === 'PENDIENTE' && (
            <p style={{ margin: '8px 0 0 0', color: '#555' }}>Solicitud pendiente de revisión.</p>
          )}
          {accesoActivo && (
            <button
              onClick={onVerExpediente}
              style={{
                marginTop: 10,
                background: '#0003B8',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Ver expediente
            </button>
          )}
        </div>
      )}

      <label style={{ display: 'block', fontWeight: 600, color: '#0003B8', marginBottom: 8 }}>Justificación clínica</label>
      <textarea
        ref={textAreaRef}
        value={justificacion}
        onChange={(e) => setJustificacion(e.target.value)}
        rows={5}
        placeholder="Describe la emergencia clínica y por qué necesitas acceso inmediato..."
        style={{
          width: '100%',
          borderRadius: 10,
          border: '1px solid #C9D9FF',
          padding: 12,
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <p style={{ marginTop: 6, fontSize: 12, color: chars >= minChars ? '#2E7D32' : '#888' }}>
        {chars}/{minChars} caracteres mínimos
      </p>

      <label style={{ display: 'block', fontWeight: 600, color: '#0003B8', margin: '14px 0 8px 0' }}>Nivel de urgencia</label>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { value: 'ALTA', title: 'ALTA', desc: 'Vida en peligro' },
          { value: 'MEDIA', title: 'MEDIA', desc: 'Urgencia clínica' },
          { value: 'BAJA', title: 'BAJA', desc: 'Administrativo' },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setNivelUrgencia(opt.value as BreakGlassUrgencia)}
            style={{
              textAlign: 'left',
              padding: 10,
              borderRadius: 10,
              border: nivelUrgencia === opt.value ? '2px solid #0003B8' : '1px solid #D4DDF4',
              background: nivelUrgencia === opt.value ? '#EEF3FF' : 'white',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, color: '#0003B8' }}>{opt.title}</div>
            <div style={{ fontSize: 12, color: '#667' }}>{opt.desc}</div>
          </button>
        ))}
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: '#6B7280' }}>
        Este acceso queda registrado y será auditado.
      </p>

      {error && <div style={{ marginTop: 10, color: '#B91C1C', fontSize: 14 }}>{error}</div>}
      {msg && <div style={{ marginTop: 10, color: '#14532D', fontSize: 14 }}>{msg}</div>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={sending}
        style={{
          marginTop: 14,
          width: '100%',
          borderRadius: 10,
          border: 'none',
          background: '#1D4ED8',
          color: 'white',
          padding: '12px 16px',
          fontWeight: 700,
          cursor: sending ? 'not-allowed' : 'pointer',
          opacity: sending ? 0.7 : 1,
        }}
      >
        {sending ? 'Enviando solicitud...' : 'Solicitar acceso de emergencia'}
      </button>
    </div>
  )
}

function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
