import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/axiosConfig'
import { useAuth } from '../hooks/useAuth'
import type { AuthUser } from '../services/authService'


function ModIcon({ path, color }: { path: string; color: string }) {
  const icons: Record<string, React.ReactElement> = {
    users: <><circle cx="6" cy="5" r="2.5"/><path d="M1 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"/><circle cx="12.5" cy="5.5" r="2"/><path d="M15 13.5c0-1.8-1.3-3.3-3-3.8"/></>,
    clipboard: <><path d="M5 2H3a1 1 0 00-1 1v11a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1h-2"/><rect x="5" y="1" width="6" height="2.5" rx="1"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="5" y1="11" x2="9" y2="11"/></>,
    file: <><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z"/><polyline points="9 1 9 5 13 5"/><line x1="5" y1="9" x2="11" y2="9"/><line x1="5" y1="12" x2="9" y2="12"/></>,
    calendar: <><rect x="1" y="3" width="14" height="12" rx="1.5"/><line x1="1" y1="7" x2="15" y2="7"/><line x1="5" y1="1" x2="5" y2="5"/><line x1="11" y1="1" x2="11" y2="5"/></>,
  }
  return (
    <svg viewBox="0 0 16 16" width="26" height="26"
      fill="none" stroke={color} strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round">
      {icons[path]}
    </svg>
  )
}

type ModuloCard = {
  titulo: string
  desc: string
  icon: string
  color: string
  ruta: string
  soon?: boolean
  roles?: string[]
}

const MODULOS: ModuloCard[] = [
  { titulo: 'Pacientes',  desc: 'Registro, búsqueda y expedientes',  icon: 'users',     color: '#0003B8', ruta: '/pacientes' },
  { titulo: 'Apertura de ficha', desc: 'Apertura y cola de atencion del dia', icon: 'clipboard', color: '#00A896', ruta: '/fichas/cola-dia', roles: ['Administrativo', 'Director'] },
  { titulo: 'Historial',  desc: 'Consultas y diagnósticos previos',   icon: 'clipboard', color: '#00A896', ruta: '/historial', soon: true },
  { titulo: 'Documentos', desc: 'Gestión documental clínica',         icon: 'file',      color: '#0003B8', ruta: '/documentos', soon: true },
  { titulo: 'Agenda',     desc: 'Citas y turnos programados',         icon: 'calendar',  color: '#00A896', ruta: '/agenda',     soon: true },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()

  useEffect(() => {
    api
      .get<AuthUser>('auth/profile/')
      .then((res) => {
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      })
      .catch((err) => {
        console.log('Error profile:', err.response?.status, err.response?.data)
      })
  }, [setUser])

  if (!user) {
    return (
      <div style={{ padding: '40px', color: '#0003B8', fontWeight: 600 }}>Cargando...</div>
    )
  }

  const rol = user.groups?.[0] ?? 'Sin rol'
  const modulosDisponibles = useMemo(
    () => MODULOS.filter((m) => !m.roles || m.roles.some((r) => user.groups?.includes(r))),
    [user.groups],
  )

  return (
    <div style={{ padding: '32px' }}>

      {/* Banner de clínica */}
      {user.tenant && (
        <div style={{
          background: 'linear-gradient(135deg, #0003B8 0%, #0a1f8f 100%)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0,3,184,0.18)',
        }}>
          <div style={{
            width: 48, height: 48, flexShrink: 0,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
              <line x1="12" y1="5" x2="12" y2="9"/>
              <line x1="10" y1="7" x2="14" y2="7"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 600,
              letterSpacing: '0.7px', margin: '0 0 3px 0', textTransform: 'uppercase' }}>
              Establecimiento de Salud
            </p>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700,
              margin: 0, letterSpacing: '0.1px', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.tenant.nombre}
            </h2>
          </div>
          <div style={{
            background: 'rgba(0,168,150,0.25)',
            border: '1px solid rgba(0,168,150,0.5)',
            borderRadius: '20px', padding: '4px 14px',
            color: '#6EFFF4', fontSize: '12px', fontWeight: 600,
            flexShrink: 0,
          }}>
            Activo
          </div>
        </div>
      )}

      {/* Saludo */}
      <div style={{ marginBottom: '32px' }}>
        <p style={{ color: '#00A896', fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0' }}>
          Bienvenido de vuelta
        </p>
        <h1 style={{ fontSize: '26px', color: '#0003B8', fontWeight: 700, margin: '0 0 8px 0' }}>
          {user.first_name} {user.last_name}
        </h1>
        <span style={{
          display: 'inline-block',
          background: '#CCFAF4', color: '#00A896',
          padding: '4px 14px', borderRadius: '20px',
          fontSize: '13px', fontWeight: 600,
        }}>
          {rol}
        </span>
      </div>

      {/* Módulos */}
      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#0003B8', marginBottom: '16px', opacity: 0.7 }}>
        MÓDULOS DISPONIBLES
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {modulosDisponibles.map(mod => (
          <div
            key={mod.titulo}
            onClick={() => navigate(mod.ruta)}
            style={{
              background: 'white',
              borderRadius: '14px',
              padding: '22px 20px',
              borderTop: `4px solid ${mod.color}`,
              boxShadow: '0 2px 10px rgba(0,3,184,0.07)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'box-shadow 0.15s',
            }}
          >
            <div style={{ marginBottom: '14px' }}><ModIcon path={mod.icon} color={mod.color} /></div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0003B8', margin: '0 0 4px 0' }}>
              {mod.titulo}
            </h3>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{mod.desc}</p>
            {mod.soon && (
              <span style={{
                position: 'absolute', top: '12px', right: '12px',
                background: '#F0F6FF', color: '#0003B8',
                fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                borderRadius: '8px', border: '1px solid rgba(0,3,184,0.15)',
                opacity: 0.6,
              }}>
                Pronto
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
