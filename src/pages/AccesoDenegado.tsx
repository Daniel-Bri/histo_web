import { useNavigate } from 'react-router-dom'

interface Props {
  code?: 401 | 403
  mensaje?: string
}

export default function AccesoDenegado({ code = 403, mensaje }: Props) {
  const navigate = useNavigate()

  const info = code === 401
    ? {
        titulo: 'Sesión expirada',
        descripcion: mensaje ?? 'Tu sesión ha expirado o no tienes credenciales válidas. Inicia sesión para continuar.',
        icono: '🔐',
        accion: () => navigate('/login', { replace: true }),
        labelBtn: 'Ir al login',
        color: '#1D4ED8',
        bg: '#EFF6FF',
        border: '#BFDBFE',
      }
    : {
        titulo: 'Sin acceso',
        descripcion: mensaje ?? 'No tienes permisos para ver esta sección. Contacta a tu administrador si crees que es un error.',
        icono: '🚫',
        accion: () => navigate('/dashboard', { replace: true }),
        labelBtn: 'Volver al inicio',
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
      }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8FAFC', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '56px 48px',
        textAlign: 'center', maxWidth: '440px', width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        border: `1px solid ${info.border}`,
      }}>

        {/* Icono */}
        <div style={{
          width: '88px', height: '88px', borderRadius: '50%',
          background: info.bg, border: `2px solid ${info.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '40px', margin: '0 auto 24px',
        }}>
          {info.icono}
        </div>

        {/* Código HTTP */}
        <p style={{ fontSize: '13px', fontWeight: 700, color: info.color, letterSpacing: '0.1em', margin: '0 0 6px', opacity: 0.7 }}>
          ERROR {code}
        </p>

        {/* Título */}
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: '0 0 12px' }}>
          {info.titulo}
        </h1>

        {/* Descripción */}
        <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, margin: '0 0 32px' }}>
          {info.descripcion}
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={info.accion}
            style={{
              background: info.color, color: '#fff',
              border: 'none', borderRadius: '10px',
              padding: '13px 24px', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', width: '100%',
            }}
          >
            {info.labelBtn}
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent', color: '#64748B',
              border: '1px solid #E2E8F0', borderRadius: '10px',
              padding: '11px 24px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', width: '100%',
            }}
          >
            ← Volver atrás
          </button>
        </div>
      </div>
    </div>
  )
}
