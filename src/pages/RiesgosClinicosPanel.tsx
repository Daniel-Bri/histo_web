import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/axiosConfig'

// ── Types ─────────────────────────────────────────────────────────────────────
interface PatologiaData {
  probabilidad: number
  clasificacion: string
  nivel_alerta: string
  recomendacion: string
}

// La API devuelve un objeto plano con una clave por patología
interface RiesgoResponse {
  paciente_id: number
  fecha_calculo: string
  diabetes_tipo2?: PatologiaData
  hipertension?: PatologiaData
  enfermedad_renal?: PatologiaData
  evento_cardiovascular?: PatologiaData
}

interface RiesgoNormalizado extends PatologiaData {
  tipo: string
}

// El endpoint pacientes/pacientes/:id/ devuelve nombre/apellido (no nombres/apellido_paterno)
interface PacienteBasico {
  nombre: string
  apellido: string
  apellido_materno?: string
}

// ── Normalización: objeto plano → array ordenado ──────────────────────────────
const PATOLOGIA_KEYS: Array<keyof Omit<RiesgoResponse, 'paciente_id' | 'fecha_calculo'>> = [
  'hipertension',
  'diabetes_tipo2',
  'enfermedad_renal',
  'evento_cardiovascular',
]

function normalizarRiesgos(data: RiesgoResponse): RiesgoNormalizado[] {
  return PATOLOGIA_KEYS
    .filter(k => data[k] != null)
    .map(k => ({ tipo: k, ...data[k]! }))
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  hipertension:          'Hipertensión Arterial',
  diabetes_tipo2:        'Diabetes Tipo 2',
  enfermedad_renal:      'Enfermedad Renal',
  evento_cardiovascular: 'Evento Cardiovascular',
}

const TIPO_ICON: Record<string, string> = {
  hipertension:          '🫀',
  diabetes_tipo2:        '🩸',
  enfermedad_renal:      '🫘',
  evento_cardiovascular: '❤️',
}

// Usado para el gauge y bordes según `clasificacion` (BAJO/MODERADO/ALTO)
const CLASIF_STYLE: Record<string, { color: string; bg: string; border: string; track: string; label: string }> = {
  BAJO:    { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7', track: '#C8E6C9', label: 'Bajo'     },
  MODERADO:{ color: '#E65100', bg: '#FFF3E0', border: '#FFCC80', track: '#FFE0B2', label: 'Moderado' },
  ALTO:    { color: '#C62828', bg: '#FFEBEE', border: '#EF9A9A', track: '#FFCDD2', label: 'Alto'     },
  CRÍTICO: { color: '#6A0080', bg: '#F3E5F5', border: '#CE93D8', track: '#E1BEE7', label: 'Crítico'  },
}

// Usado para el badge de nivel_alerta (puede ser distinto al de clasificacion)
const ALERTA_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  BAJO:    { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
  MODERADO:{ color: '#E65100', bg: '#FFF3E0', border: '#FFCC80' },
  ALTO:    { color: '#C62828', bg: '#FFEBEE', border: '#EF9A9A' },
  CRÍTICO: { color: '#6A0080', bg: '#F3E5F5', border: '#CE93D8' },
}

const DEFAULT_CLASIF = { color: '#555', bg: '#F5F5F5', border: '#DDD', track: '#EEE', label: '—' }
const DEFAULT_ALERTA = { color: '#555', bg: '#F5F5F5', border: '#DDD' }

// ── SVG circular gauge ────────────────────────────────────────────────────────
function CircleGauge({ value, color, track }: { value: number; color: string; track: string }) {
  const r    = 36
  const circ = 2 * Math.PI * r
  const arc  = circ * Math.min(1, Math.max(0, value))

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circ}`}
        transform="rotate(-90 50 50)"
      />
      <text
        x="50" y="46"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: '20px', fontWeight: 700, fill: color, fontFamily: 'inherit' }}
      >
        {Math.round(value * 100)}%
      </text>
      <text
        x="50" y="63"
        textAnchor="middle"
        style={{ fontSize: '8px', fill: color, opacity: 0.65, fontFamily: 'inherit', letterSpacing: '0.06em' }}
      >
        PROBABILIDAD
      </text>
    </svg>
  )
}

// ── Horizontal mini-bar ───────────────────────────────────────────────────────
function MiniBar({ value, color, track }: { value: number; color: string; track: string }) {
  return (
    <div style={{ background: track, borderRadius: '4px', height: '7px', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: color, borderRadius: '4px' }} />
    </div>
  )
}

// ── Helper fecha ──────────────────────────────────────────────────────────────
function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RiesgosClinicosPanel() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [data,     setData]     = useState<RiesgoResponse | null>(null)
  const [riesgos,  setRiesgos]  = useState<RiesgoNormalizado[]>([])
  const [paciente, setPaciente] = useState<PacienteBasico | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!id) { setError('ID de paciente inválido.'); setLoading(false); return }

    Promise.all([
      api.get<RiesgoResponse>('ia/riesgo/', { params: { paciente_id: id } }),
      api.get<PacienteBasico>(`pacientes/pacientes/${id}/`),
    ])
      .then(([rRes, pRes]) => {
        setData(rRes.data)
        setRiesgos(normalizarRiesgos(rRes.data))
        setPaciente(pRes.data)
      })
      .catch(e => setError(e?.response?.data?.error ?? 'No se pudo cargar el perfil de riesgo.'))
      .finally(() => setLoading(false))
  }, [id])

  const nombreCompleto = paciente
    ? `${paciente.nombre} ${paciente.apellido}${paciente.apellido_materno ? ` ${paciente.apellido_materno}` : ''}`
    : `Paciente #${id}`

  return (
    <div style={{ padding: '32px' }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate(`/pacientes/${id}/expediente`)}
          style={{ background: 'transparent', border: 'none', color: '#0080FF', fontSize: '13px', cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          ← Expediente
        </button>
        {paciente && (
          <>
            <span style={{ color: '#B3D4FF' }}>/</span>
            <span style={{ color: '#555', fontSize: '13px' }}>{nombreCompleto}</span>
          </>
        )}
        <span style={{ color: '#B3D4FF' }}>/</span>
        <span style={{ color: '#0003B8', fontSize: '13px', fontWeight: 600 }}>Perfil de Riesgo Clínico</span>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '56px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,3,184,0.06)' }}>
          <p style={{ color: '#0003B8', fontWeight: 600, margin: 0 }}>Consultando perfil de riesgo clínico con IA…</p>
          <p style={{ color: '#888', fontSize: '13px', margin: '8px 0 0' }}>Esto puede tardar unos segundos.</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: '#E53935', fontWeight: 600, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* ── Sin datos ── */}
      {!loading && !error && data && riesgos.length === 0 && (
        <div style={{ background: 'white', borderRadius: '14px', padding: '48px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,3,184,0.06)' }}>
          <p style={{ fontSize: '32px', margin: '0 0 12px' }}>🔍</p>
          <p style={{ color: '#0003B8', fontWeight: 700, fontSize: '15px', margin: '0 0 6px' }}>
            No se encontraron datos predictivos para este paciente
          </p>
          <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
            El modelo de IA no pudo generar un perfil de riesgo con la información clínica disponible.
          </p>
        </div>
      )}

      {/* ── Contenido principal ── */}
      {!loading && !error && data && riesgos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Header */}
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '22px 28px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
          }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0003B8', margin: '0 0 4px' }}>
                Perfil de Riesgo Clínico
              </h1>
              <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>{nombreCompleto}</p>
            </div>
            <span style={{
              fontSize: '12px', color: '#0003B8', background: '#E8EEFF',
              border: '1px solid #C5CEFF', borderRadius: '20px',
              padding: '5px 14px', fontWeight: 600,
            }}>
              🕐 Calculado: {fechaCorta(data.fecha_calculo)}
            </span>
          </div>

          {/* ── Overview cards ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: '14px',
          }}>
            {riesgos.map(r => {
              const st = CLASIF_STYLE[r.clasificacion] ?? DEFAULT_CLASIF
              return (
                <div key={r.tipo} style={{
                  background: 'white', border: `1.5px solid ${st.border}`,
                  borderRadius: '14px', padding: '20px 18px',
                  boxShadow: '0 2px 8px rgba(0,3,184,0.04)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '26px' }}>{TIPO_ICON[r.tipo] ?? '⚕️'}</span>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0003B8', textAlign: 'center', lineHeight: 1.3 }}>
                    {TIPO_LABEL[r.tipo] ?? r.tipo}
                  </p>
                  <CircleGauge value={r.probabilidad} color={st.color} track={st.track} />
                  <span style={{
                    background: st.bg, color: st.color,
                    fontSize: '12px', fontWeight: 700,
                    padding: '4px 14px', borderRadius: '20px',
                    border: `1px solid ${st.border}`,
                  }}>
                    {st.label}
                  </span>
                  <MiniBar value={r.probabilidad} color={st.color} track={st.track} />
                </div>
              )
            })}
          </div>

          {/* ── Detail cards ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {riesgos.map(r => {
              const st  = CLASIF_STYLE[r.clasificacion] ?? DEFAULT_CLASIF
              const alt = ALERTA_STYLE[r.nivel_alerta]  ?? DEFAULT_ALERTA
              return (
                <div key={r.tipo} style={{
                  background: 'white', borderRadius: '14px',
                  boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
                  border: `1px solid ${st.border}`,
                  overflow: 'hidden',
                }}>
                  {/* Card header */}
                  <div style={{
                    background: st.bg, padding: '12px 22px',
                    borderBottom: `1px solid ${st.border}`,
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <span style={{ fontSize: '18px' }}>{TIPO_ICON[r.tipo] ?? '⚕️'}</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: st.color }}>
                      {TIPO_LABEL[r.tipo] ?? r.tipo}
                    </span>
                    {/* Clasificación */}
                    <span style={{
                      background: 'white', color: st.color,
                      fontSize: '12px', fontWeight: 700,
                      padding: '3px 12px', borderRadius: '20px',
                      border: `1px solid ${st.border}`,
                    }}>
                      {st.label}
                    </span>
                    {/* Nivel de alerta (puede diferir de clasificacion) */}
                    {r.nivel_alerta !== r.clasificacion && (
                      <span style={{
                        background: alt.bg, color: alt.color,
                        fontSize: '11px', fontWeight: 700,
                        padding: '3px 12px', borderRadius: '20px',
                        border: `1px solid ${alt.border}`,
                      }}>
                        ⚠ Alerta: {r.nivel_alerta.charAt(0) + r.nivel_alerta.slice(1).toLowerCase()}
                      </span>
                    )}
                  </div>

                  {/* Card body: gauge | recomendación */}
                  <div style={{
                    padding: '22px',
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr',
                    gap: '24px',
                    alignItems: 'start',
                  }}>

                    {/* Gauge */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <CircleGauge value={r.probabilidad} color={st.color} track={st.track} />
                    </div>

                    {/* Recomendación + nivel alerta detalle */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Badge nivel_alerta prominente */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: alt.bg, color: alt.color,
                          fontSize: '13px', fontWeight: 700,
                          padding: '5px 16px', borderRadius: '20px',
                          border: `1px solid ${alt.border}`,
                        }}>
                          Nivel de alerta: {r.nivel_alerta.charAt(0) + r.nivel_alerta.slice(1).toLowerCase()}
                        </span>
                      </div>

                      {/* Recomendación */}
                      <div style={{ background: '#F8FAFF', borderRadius: '10px', padding: '16px' }}>
                        <p style={{
                          fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.6,
                          textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px',
                        }}>
                          Recomendación Clínica
                        </p>
                        <p style={{ fontSize: '13px', color: '#333', margin: 0, lineHeight: 1.65 }}>
                          {r.recomendacion}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}
