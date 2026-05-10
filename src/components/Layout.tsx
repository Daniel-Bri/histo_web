import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getStoredUser } from '../utils/auth'

// ── Pacientes recientes (guardados en sessionStorage) ─────────────────────────
interface PacienteReciente { id: number; nombre: string; ci: string }

function getPacientesRecientes(): PacienteReciente[] {
  try { return JSON.parse(sessionStorage.getItem('pacientes_recientes') ?? '[]') as PacienteReciente[] }
  catch { return [] }
}

export function registrarPacienteReciente(p: PacienteReciente) {
  const lista = getPacientesRecientes().filter(x => x.id !== p.id)
  lista.unshift(p)
  sessionStorage.setItem('pacientes_recientes', JSON.stringify(lista.slice(0, 5)))
  window.dispatchEvent(new Event('pacientes-recientes-updated'))
}

// ── Iconos SVG monocromáticos ─────────────────────────────────────────────
function Icon({ name, size = 15 }: { name: string; size?: number }) {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 } as const
  const p = { fill: 'none', strokeWidth: '1.6', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  const icons = {
    users: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <circle cx="6" cy="5" r="2.5" />
        <path d="M1 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
        <circle cx="12.5" cy="5.5" r="2" />
        <path d="M15 13.5c0-1.8-1.3-3.3-3-3.8" />
      </svg>
    ),
    'user-plus': (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <circle cx="7" cy="5" r="3" />
        <path d="M1 14c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
        <line x1="12" y1="3" x2="16" y2="3" />
        <line x1="14" y1="1" x2="14" y2="5" />
      </svg>
    ),
    clipboard: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <path d="M5 2H3a1 1 0 00-1 1v11a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1h-2" />
        <rect x="5" y="1" width="6" height="2.5" rx="1" />
        <line x1="5" y1="8" x2="11" y2="8" />
        <line x1="5" y1="11" x2="9" y2="11" />
      </svg>
    ),
    flask: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <path d="M6 1.5h4" />
        <path d="M7 1.5v4l-4.2 7a1.1 1.1 0 001 1.7h8.4a1.1 1.1 0 001-1.7l-4.2-7v-4" />
        <path d="M5.2 9h5.6" />
      </svg>
    ),
    file: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z" />
        <polyline points="9 1 9 5 13 5" />
        <line x1="5" y1="9" x2="11" y2="9" />
        <line x1="5" y1="12" x2="9" y2="12" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <rect x="1" y="3" width="14" height="12" rx="1.5" />
        <line x1="1" y1="7" x2="15" y2="7" />
        <line x1="5" y1="1" x2="5" y2="5" />
        <line x1="11" y1="1" x2="11" y2="5" />
      </svg>
    ),
    cpu: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <rect x="4" y="4" width="8" height="8" rx="1" />
        <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" />
        <line x1="6" y1="12" x2="6" y2="15" /><line x1="10" y1="12" x2="10" y2="15" />
        <line x1="1" y1="6" x2="4" y2="6" /><line x1="1" y1="10" x2="4" y2="10" />
        <line x1="12" y1="6" x2="15" y2="6" /><line x1="12" y1="10" x2="15" y2="10" />
      </svg>
    ),
    activity: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <polyline points="1 10 4 6 7 9 10 3 13 7 15 5" />
      </svg>
    ),
    link: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7 4" />
        <path d="M9.5 6.5a3.5 3.5 0 00-5 0L2.5 8.5a3.5 3.5 0 005 5L9 12" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <path d="M8 1.5l5.5 2v4C13.5 11.5 11 14 8 15 5 14 2.5 11.5 2.5 7.5v-4z" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15" />
        <path d="M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
      </svg>
    ),
    key: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <circle cx="11" cy="5.5" r="3" />
        <path d="M8 8.5L2.5 14" />
        <line x1="2.5" y1="12" x2="4.5" y2="12" />
        <line x1="4.5" y1="14" x2="4.5" y2="12" />
      </svg>
    ),
    logout: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <path d="M6 2.5H3a1 1 0 00-1 1v9a1 1 0 001 1h3" />
        <polyline points="10.5 11 14 8 10.5 5" />
        <line x1="14" y1="8" x2="6" y2="8" />
      </svg>
    ),
    menu: (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <line x1="1" y1="4" x2="15" y2="4" />
        <line x1="1" y1="8" x2="15" y2="8" />
        <line x1="1" y1="12" x2="15" y2="12" />
      </svg>
    ),
    'chevron-left': (
      <svg viewBox="0 0 16 16" style={s} {...p}>
        <polyline points="10 3 5 8 10 13" />
      </svg>
    ),
  }

  return icons[name as keyof typeof icons] ?? null
}

// ── Datos de navegación ───────────────────────────────────────────────────
interface NavItem {
  label: string
  path?: string
  icon: string
  soon?: boolean
  roles?: string[]
  staffOnly?: boolean
}
interface NavSection {
  title: string
  items: NavItem[]
  staffOnly?: boolean
}

const NAV: NavSection[] = [
  {
    title: 'Gestión de Usuarios',
    items: [
      { label: 'Pacientes',         path: '/pacientes', icon: 'users' },
      { label: 'Personal de Salud', path: '/personal',  icon: 'user-plus', roles: ['Administrativo', 'Director'] },
    ],
  },
  {
    title: 'Atención Clínica',
    items: [
      { label: 'Nueva Consulta SOAP', path: '/consulta', icon: 'clipboard', roles: ['Médico', 'Director', 'ADMIN', 'Admin'] },
      { label: 'Historial Clínico', icon: 'file', soon: true },
      { label: 'Documentos', icon: 'file', soon: true },
      { label: 'Agenda', icon: 'calendar', soon: true },
      { label: 'Apertura de ficha', path: '/fichas/cola-dia', icon: 'clipboard', roles: ['Administrativo', 'Director'] },
      { label: 'Urgencias',          path: '/urgencias',                   icon: 'activity',  roles: ['Médico', 'Enfermera', 'Administrativo', 'Director'] },
      { label: 'Solicitar estudio',  path: '/estudios/solicitud',          icon: 'clipboard', roles: ['Médico', 'Administrativo', 'Director'] },
      { label: 'Cola laboratorio',   path: '/estudios/cola-laboratorio',   icon: 'flask',     roles: ['Laboratorio', 'Administrativo', 'Director'] },
      { label: 'Reportes producción', path: '/reportes/produccion',        icon: 'activity',  roles: ['ADMIN', 'Admin', 'Administrativo', 'Auditor', 'Médico', 'Director'] },
      { label: 'Recetas',           path: '/recetas',    icon: 'clipboard', roles: ['Médico', 'Farmacia', 'Administrativo', 'Director'] },
    ],
  },
  {
    title: 'IA + Blockchain',
    items: [
      { label: 'Clasificación IA', icon: 'cpu',      soon: true },
      { label: 'Riesgo Clínico',   icon: 'activity', soon: true },
      { label: 'Blockchain',       icon: 'link',     soon: true },
    ],
  },
  {
    title: 'Seguridad y Admin',
    items: [
      { label: 'Auditoría',      path: '/auditoria/bitacora', icon: 'shield', roles: ['Auditor', 'Director', 'ADMIN', 'Admin'] },
      { label: 'Configuración',  path: '/configuracion', icon: 'settings', roles: ['Administrativo', 'Director'] },
    ],
  },
  {
    title: 'Superadmin',
    staffOnly: true,
    items: [
      { label: 'Panel SaaS', path: '/admin/tenants', icon: 'cpu', staffOnly: true },
      { label: 'Usuarios por Clínica', path: '/admin/usuarios-clinica', icon: 'users', staffOnly: true },
    ],
  },
]

// Colores de rol adaptados para fondo oscuro
const ROL_COLORS: Record<string, { bg: string; text: string }> = {
  'Médico':         { bg: 'rgba(59,130,246,0.18)',  text: '#93C5FD' },
  'Enfermera':      { bg: 'rgba(16,185,129,0.18)',  text: '#6EE7B7' },
  'Administrativo': { bg: 'rgba(245,158,11,0.18)',  text: '#FCD34D' },
  'Auditor':        { bg: 'rgba(139,92,246,0.18)',  text: '#C4B5FD' },
  'Director':       { bg: 'rgba(236,72,153,0.18)',  text: '#F9A8D4' },
  'Laboratorio':    { bg: 'rgba(6,182,212,0.18)',   text: '#67E8F9' },
  'Farmacia':       { bg: 'rgba(234,179,8,0.18)',   text: '#FDE68A' },
}

// ── Componente ────────────────────────────────────────────────────────────
export default function Layout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { logout } = useAuth()
  const user       = getStoredUser()
  const rol        = user?.groups?.[0] ?? 'Sin rol'
  const rolColor   = ROL_COLORS[rol] ?? { bg: 'rgba(148,163,184,0.18)', text: '#94A3B8' }

  const isSuperadmin = user?.is_staff === true

  const [hovered, setHovered]     = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [recientes, setRecientes] = useState<PacienteReciente[]>(getPacientesRecientes)

  // Refrescar lista cuando se registra un paciente reciente desde cualquier pantalla
  useEffect(() => {
    const handler = () => setRecientes(getPacientesRecientes())
    window.addEventListener('pacientes-recientes-updated', handler)
    return () => window.removeEventListener('pacientes-recientes-updated', handler)
  }, [])

  // Atajos de teclado globales
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+F → ir a búsqueda de pacientes
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        navigate('/pacientes')
      }
      // Escape → volver al dashboard desde rutas de detalle
      if (e.key === 'Escape' && location.pathname !== '/dashboard') {
        const parts = location.pathname.split('/')
        if (parts.length > 2) navigate(-1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, location.pathname])

  const isActive = (path?: string) =>
    !!path && (location.pathname === path || location.pathname.startsWith(path + '/'))

  // Colores base del sidebar
  const BG       = '#122268'
  const DIVIDER  = 'rgba(255,255,255,0.15)'
  const ACTIVE_BG     = 'rgba(0,168,150,0.22)'
  const ACTIVE_BORDER = '#00A896'
  const HOVER_BG      = 'rgba(255,255,255,0.09)'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Botón flotante para reabrir sidebar cuando está colapsado */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Abrir menú"
          style={{
            position: 'fixed', top: '16px', left: '12px', zIndex: 300,
            background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '8px', padding: '8px', cursor: 'pointer',
            color: 'rgba(255,255,255,0.85)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="menu" size={16} />
        </button>
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: collapsed ? '0px' : '240px',
        minWidth: collapsed ? '0px' : '240px',
        background: BG,
        display: 'flex', flexDirection: 'column',
        height: '100vh', overflowY: collapsed ? 'hidden' : 'auto',
        overflow: collapsed ? 'hidden' : undefined,
        borderRight: collapsed ? 'none' : `1px solid ${DIVIDER}`,
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1)',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}>

        {/* Logo */}
        <div style={{
          padding: '18px 14px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          borderBottom: `1px solid ${DIVIDER}`, flexShrink: 0,
        }}>
          <div style={{
            background: '#00A896', borderRadius: '9px',
            width: '34px', height: '34px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: '12px', letterSpacing: '0.03em',
          }}>
            HL
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: '15px', margin: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>
              HistoLink
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', margin: '3px 0 0', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              SISTEMA CLÍNICO
            </p>
          </div>
          {/* Botón colapsar */}
          <button
            onClick={() => setCollapsed(true)}
            title="Cerrar menú"
            style={{
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
              padding: '4px', borderRadius: '6px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.95)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          >
            <Icon name="chevron-left" size={16} />
          </button>
        </div>

        {/* Usuario */}
        <div
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${DIVIDER}`,
            cursor: 'pointer', flexShrink: 0,
            background: hovered === '__user' ? HOVER_BG : 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={() => setHovered('__user')}
          onMouseLeave={() => setHovered(null)}
        >
          <p style={{ color: '#ffffff', fontWeight: 600, fontSize: '13px', margin: '0 0 2px' }}>
            {user?.first_name} {user?.last_name}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', margin: '0 0 8px' }}>
            {user?.username}
          </p>
          <span style={{
            display: 'inline-block',
            background: rolColor.bg, color: rolColor.text,
            fontSize: '11px', fontWeight: 600,
            padding: '3px 10px', borderRadius: '20px',
          }}>
            {rol}
          </span>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '6px 0 12px', overflowY: 'auto' }}>
          {NAV.filter(section => !section.staffOnly || isSuperadmin).map(section => (
            <div key={section.title} style={{ marginBottom: '2px' }}>

              {/* Encabezado de sección */}
              <p style={{
                color: section.staffOnly ? 'rgba(251,191,36,0.75)' : 'rgba(255,255,255,0.65)',
                fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '14px 18px 5px', margin: 0,
              }}>
                {section.title}
              </p>

              {section.items.map(item => {
                if (item.staffOnly && !isSuperadmin) return null
                const hasAccess = !item.roles || item.roles.some(r => user?.groups?.includes(r))
                const disabled  = item.soon || !hasAccess
                const active    = isActive(item.path)
                const hover     = hovered === item.label
                return (
                  <button
                    key={item.label}
                    onClick={() => { if (item.path && !disabled) navigate(item.path) }}
                    onMouseEnter={() => !disabled && setHovered(item.label)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '8px 18px',
                      background: active ? ACTIVE_BG : hover ? HOVER_BG : 'transparent',
                      border: 'none',
                      borderLeft: `3px solid ${active ? ACTIVE_BORDER : 'transparent'}`,
                      color: active
                        ? '#ffffff'
                        : disabled
                          ? 'rgba(255,255,255,0.4)'
                          : hover
                            ? '#ffffff'
                            : 'rgba(255,255,255,0.88)',
                      fontSize: '13px', fontWeight: active ? 600 : 500,
                      cursor: disabled ? 'default' : 'pointer',
                      textAlign: 'left', transition: 'background 0.12s, color 0.12s',
                    }}
                  >
                    <Icon name={item.icon} size={15} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.soon && (
                      <span style={{
                        fontSize: '9px', fontWeight: 600,
                        background: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.5)',
                        padding: '2px 7px', borderRadius: '20px',
                        letterSpacing: '0.04em',
                      }}>
                        Pronto
                      </span>
                    )}
                    {!item.soon && !hasAccess && (
                      <span style={{
                        fontSize: '9px', fontWeight: 600,
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.4)',
                        padding: '2px 7px', borderRadius: '20px',
                        letterSpacing: '0.04em',
                      }}>
                        Sin acceso
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Pacientes recientes */}
        {recientes.length > 0 && (
          <div style={{ borderTop: `1px solid ${DIVIDER}`, padding: '10px 0 4px', flexShrink: 0 }}>
            <p style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '4px 18px 6px', margin: 0,
            }}>
              Recientes
            </p>
            {recientes.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/pacientes/${p.id}/expediente`)}
                onMouseEnter={() => setHovered(`__rec_${p.id}`)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '6px 18px',
                  background: hovered === `__rec_${p.id}` ? HOVER_BG : 'transparent',
                  border: 'none', borderLeft: '3px solid transparent',
                  color: 'rgba(255,255,255,0.8)', fontSize: '12px',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                }}
              >
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(0,168,150,0.3)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#6EE7DF',
                }}>
                  {p.nombre.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.nombre}
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{p.ci}</span>
              </button>
            ))}
          </div>
        )}

        {/* Acciones inferiores */}
        <div style={{
          padding: '8px 0 12px',
          borderTop: `1px solid ${DIVIDER}`,
          display: 'flex', flexDirection: 'column',
          flexShrink: 0,
        }}>
          <button
            onClick={() => navigate('/cambiar-password')}
            onMouseEnter={() => setHovered('__pwd')}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 18px', width: '100%',
              background: hovered === '__pwd' ? HOVER_BG : 'transparent',
              border: 'none',
              borderLeft: '3px solid transparent',
              color: hovered === '__pwd' ? '#ffffff' : 'rgba(255,255,255,0.82)',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              textAlign: 'left', transition: 'background 0.12s, color 0.12s',
            }}
          >
            <Icon name="key" size={15} />
            <span>Cambiar contraseña</span>
          </button>

          <button
            onClick={() => void logout()}
            onMouseEnter={() => setHovered('__logout')}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 18px', width: '100%',
              background: hovered === '__logout' ? 'rgba(239,68,68,0.12)' : 'transparent',
              border: 'none',
              borderLeft: '3px solid transparent',
              color: hovered === '__logout' ? '#FCA5A5' : 'rgba(255,180,180,0.85)',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              textAlign: 'left', transition: 'background 0.12s, color 0.12s',
            }}
          >
            <Icon name="logout" size={15} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main style={{ flex: 1, background: '#F0F6FF', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
