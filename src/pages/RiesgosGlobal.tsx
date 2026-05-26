import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/axiosConfig'
import type { Paciente } from '../types/paciente.types'
import { getPacientesRecientes, registrarPacienteReciente } from '../components/Layout'

const SEXO_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', O: 'Otro' }

function calcEdad(fechaNac: string) {
  const hoy = new Date(), nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

// ── Fila de paciente ──────────────────────────────────────────────────────────
function PacienteRow({
  id: _id, nombre, apellido, ci, fechaNac, genero, onSelect,
}: {
  id: number; nombre: string; apellido: string
  ci: string; fechaNac?: string; genero?: string
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const inicial = (nombre.charAt(0) + apellido.charAt(0)).toUpperCase()

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 18px',
        background: hovered ? '#F0F6FF' : 'white',
        borderBottom: '1px solid #EFF3FF',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
        background: '#E8EEFF', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#0003B8',
      }}>
        {inicial}
      </div>

      {/* Datos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0003B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nombre} {apellido}
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>CI: {ci}</span>
          {genero && <span style={{ fontSize: '12px', color: '#888' }}>{SEXO_LABEL[genero] ?? genero}</span>}
          {fechaNac && <span style={{ fontSize: '12px', color: '#888' }}>{calcEdad(fechaNac)} años</span>}
        </div>
      </div>

      {/* CTA */}
      <span style={{
        fontSize: '12px', fontWeight: 600,
        color: hovered ? '#0003B8' : '#888',
        whiteSpace: 'nowrap',
        transition: 'color 0.12s',
      }}>
        Ver riesgo →
      </span>
    </div>
  )
}

// ── Vista de pacientes recientes (sessionStorage) ─────────────────────────────
function RecientesSection({ onSelect }: { onSelect: (id: number, nombre: string, ci: string) => void }) {
  const recientes = getPacientesRecientes()

  if (!recientes.length) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '28px', margin: '0 0 10px' }}>🔍</p>
        <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
          Aún no hay pacientes recientes. Busca un paciente por nombre o CI.
        </p>
      </div>
    )
  }

  return (
    <>
      {recientes.map(p => (
        <PacienteRow
          key={p.id}
          id={p.id}
          nombre={p.nombre.split(' ')[0]}
          apellido={p.nombre.split(' ').slice(1).join(' ')}
          ci={p.ci}
          onSelect={() => onSelect(p.id, p.nombre, p.ci)}
        />
      ))}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RiesgosGlobal() {
  const navigate    = useNavigate()
  const [busqueda, setBusqueda]   = useState('')
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [buscando, setBuscando]   = useState(false)
  const [error, setError]         = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscarPacientes = async (term: string) => {
    if (!term.trim()) { setResultados([]); return }
    setBuscando(true)
    setError('')
    try {
      const res = await api.get<{ results: Paciente[] }>('pacientes/pacientes/', {
        params: { search: term, page_size: 20 },
      })
      setResultados(res.data.results)
    } catch {
      setError('Error al buscar pacientes.')
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void buscarPacientes(busqueda) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busqueda])

  const irARiesgos = (id: number, nombre: string, ci: string) => {
    registrarPacienteReciente({ id, nombre, ci })
    navigate(`/pacientes/${id}/riesgos`)
  }

  const buscando_activo = busqueda.trim().length > 0

  return (
    <div style={{ padding: '32px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0003B8', margin: '0 0 4px' }}>
          🫀 Riesgo Clínico por IA
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          Selecciona un paciente para consultar su perfil de riesgo predictivo.
        </p>
      </div>

      {/* Buscador */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '20px 22px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
        marginBottom: '20px',
      }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '16px', pointerEvents: 'none',
          }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o CI…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px 11px 40px',
              borderRadius: '10px',
              border: '1.5px solid #B3D4FF',
              fontSize: '14px', color: '#1a1a2e',
              outline: 'none',
              fontFamily: "'Segoe UI', sans-serif",
            }}
            autoFocus
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '16px', color: '#999', lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div style={{
        background: 'white', borderRadius: '14px',
        boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
        overflow: 'hidden',
      }}>
        {/* Encabezado de sección */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid #EFF3FF',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0003B8', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {buscando_activo ? 'Resultados de búsqueda' : 'Pacientes Recientes'}
          </span>
          {buscando_activo && !buscando && (
            <span style={{ fontSize: '12px', color: '#888' }}>
              {resultados.length} encontrado{resultados.length !== 1 ? 's' : ''}
            </span>
          )}
          {buscando && (
            <span style={{ fontSize: '12px', color: '#0003B8', fontWeight: 600 }}>
              Buscando…
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '16px 18px', background: '#FFF0F0' }}>
            <p style={{ color: '#E53935', fontSize: '13px', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Resultados de búsqueda */}
        {buscando_activo && !buscando && !error && (
          resultados.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '28px', margin: '0 0 10px' }}>😶</p>
              <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
                No se encontraron pacientes con "{busqueda}".
              </p>
            </div>
          ) : (
            resultados.map(p => (
              <PacienteRow
                key={p.id}
                id={p.id}
                nombre={p.nombre}
                apellido={p.apellido}
                ci={p.ci}
                fechaNac={p.fecha_nacimiento}
                genero={p.genero}
                onSelect={() => irARiesgos(p.id, `${p.nombre} ${p.apellido}`, p.ci)}
              />
            ))
          )
        )}

        {/* Pacientes recientes (sin búsqueda activa) */}
        {!buscando_activo && !error && (
          <RecientesSection onSelect={irARiesgos} />
        )}
      </div>
    </div>
  )
}
