import { useState, useEffect } from 'react'
import { api } from '../../api/axiosConfig'
import { getStoredUser } from '../../utils/auth'

interface UsuarioItem {
  id: number
  user_id: number
  username: string
  nombre: string
  email: string
  rol: string
  especialidad: string | null
  item_min_salud: string
  activo: boolean
}

interface ClinicaGroup {
  tenant_id: number | null
  tenant_nombre: string
  tenant_activo: boolean | null
  usuarios: UsuarioItem[]
}

const ROL_LABEL: Record<string, string> = {
  medico:    'Médico',
  enfermera: 'Enfermera',
  admin:     'Administrativo',
}

const ROL_COLOR: Record<string, { bg: string; color: string }> = {
  medico:    { bg: '#EFF6FF', color: '#1D4ED8' },
  enfermera: { bg: '#F0FDF4', color: '#15803D' },
  admin:     { bg: '#FFF7ED', color: '#C2410C' },
}

export default function UsuariosPorClinica() {
  const user = getStoredUser()
  if (!user?.is_staff) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
        Acceso restringido — solo superadmin.
      </div>
    )
  }

  const [clinicas, setClinicas]   = useState<ClinicaGroup[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [busqueda, setBusqueda]   = useState('')
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [expandidos, setExpandidos] = useState<Set<number | null>>(new Set())

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<ClinicaGroup[]>('tenants/usuarios/')
        setClinicas(res.data)
        // Expandir todas por defecto
        setExpandidos(new Set(res.data.map(c => c.tenant_id)))
      } catch {
        setError('No se pudo cargar la lista de usuarios.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleExpand = (id: number | null) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clinicasFiltradas = clinicas.map(c => ({
    ...c,
    usuarios: c.usuarios.filter(u => {
      const matchBusq = !busqueda.trim() ||
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.username.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.item_min_salud.toLowerCase().includes(busqueda.toLowerCase())
      const matchRol = rolFiltro === 'todos' || u.rol === rolFiltro
      return matchBusq && matchRol
    }),
  })).filter(c => c.usuarios.length > 0)

  const totalUsuarios = clinicas.reduce((acc, c) => acc + c.usuarios.length, 0)
  const totalActivos  = clinicas.reduce((acc, c) => acc + c.usuarios.filter(u => u.activo).length, 0)

  return (
    <div style={{ padding: '28px 32px', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
          Usuarios por Clínica
        </h1>
        <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>
          Lista completa de personal de salud registrado en todas las clínicas del sistema.
        </p>
      </div>

      {/* Estadísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Clínicas',       value: clinicas.length,  color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'Total usuarios', value: totalUsuarios,    color: '#8B5CF6', bg: '#F5F3FF' },
          { label: 'Activos',        value: totalActivos,     color: '#10B981', bg: '#ECFDF5' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: '12px', padding: '16px 20px',
            textAlign: 'center', border: `1px solid ${s.color}22`,
          }}>
            <p style={{ fontSize: '28px', fontWeight: 800, color: s.color, margin: '0 0 2px' }}>{s.value}</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0',
        padding: '14px 20px', marginBottom: '20px',
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, usuario, email o ítem..."
          style={{
            flex: 1, minWidth: '220px', padding: '8px 12px',
            fontSize: '13px', borderRadius: '8px',
            border: '1px solid #D1D5DB', outline: 'none',
          }}
        />
        <select
          value={rolFiltro}
          onChange={e => setRolFiltro(e.target.value)}
          style={{
            padding: '8px 12px', fontSize: '13px', borderRadius: '8px',
            border: '1px solid #D1D5DB', color: '#374151', background: '#fff', cursor: 'pointer',
          }}
        >
          <option value="todos">Todos los roles</option>
          <option value="medico">Médico</option>
          <option value="enfermera">Enfermera</option>
          <option value="admin">Administrativo</option>
        </select>
        {(busqueda || rolFiltro !== 'todos') && (
          <button
            onClick={() => { setBusqueda(''); setRolFiltro('todos') }}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              borderRadius: '8px', border: '1px solid #CBD5E1',
              background: '#F1F5F9', color: '#475569', cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '14px', color: '#991B1B', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94A3B8', padding: '60px' }}>Cargando usuarios…</p>
      ) : clinicasFiltradas.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94A3B8', padding: '60px' }}>No se encontraron usuarios con los filtros aplicados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {clinicasFiltradas.map(clinica => {
            const expandido = expandidos.has(clinica.tenant_id)
            const activos   = clinica.usuarios.filter(u => u.activo).length
            return (
              <div key={clinica.tenant_id ?? 'sin-clinica'} style={{
                background: '#fff', borderRadius: '12px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}>
                {/* Header clínica */}
                <button
                  onClick={() => toggleExpand(clinica.tenant_id)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none',
                    border: 'none', cursor: 'pointer', padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    borderBottom: expandido ? '1px solid #F1F5F9' : 'none',
                  }}
                >
                  {/* Ícono clínica */}
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                    background: clinica.tenant_activo === false ? '#F1F5F9' : '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px',
                  }}>
                    🏥
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                        {clinica.tenant_nombre}
                      </span>
                      {clinica.tenant_activo === false && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#F1F5F9', color: '#64748B' }}>
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                      {clinica.usuarios.length} usuario{clinica.usuarios.length !== 1 ? 's' : ''}
                      {' · '}{activos} activo{activos !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: '16px', color: '#94A3B8' }}>{expandido ? '▲' : '▼'}</span>
                </button>

                {/* Tabla de usuarios */}
                {expandido && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          {['Nombre', 'Usuario', 'Email', 'Rol', 'Especialidad', 'Ítem MIN Salud', 'Estado'].map(h => (
                            <th key={h} style={{
                              padding: '10px 16px', textAlign: 'left',
                              fontSize: '11px', fontWeight: 700, color: '#64748B',
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                              borderBottom: '1px solid #F1F5F9',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {clinica.usuarios.map((u, i) => {
                          const rolStyle = ROL_COLOR[u.rol] ?? { bg: '#F1F5F9', color: '#475569' }
                          return (
                            <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderTop: '1px solid #F1F5F9', opacity: u.activo ? 1 : 0.55 }}>
                              <td style={{ padding: '11px 16px', fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                                {u.nombre}
                              </td>
                              <td style={{ padding: '11px 16px', fontSize: '13px', color: '#475569' }}>
                                <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                                  {u.username}
                                </code>
                              </td>
                              <td style={{ padding: '11px 16px', fontSize: '13px', color: '#64748B' }}>
                                {u.email || '—'}
                              </td>
                              <td style={{ padding: '11px 16px' }}>
                                <span style={{
                                  fontSize: '12px', fontWeight: 600,
                                  padding: '3px 10px', borderRadius: '20px',
                                  background: rolStyle.bg, color: rolStyle.color,
                                }}>
                                  {ROL_LABEL[u.rol] ?? u.rol}
                                </span>
                              </td>
                              <td style={{ padding: '11px 16px', fontSize: '13px', color: '#64748B' }}>
                                {u.especialidad || '—'}
                              </td>
                              <td style={{ padding: '11px 16px', fontSize: '13px', fontFamily: 'monospace', color: '#475569' }}>
                                {u.item_min_salud}
                              </td>
                              <td style={{ padding: '11px 16px' }}>
                                <span style={{
                                  fontSize: '11px', fontWeight: 700,
                                  padding: '3px 10px', borderRadius: '20px',
                                  background: u.activo ? '#DCFCE7' : '#FEF2F2',
                                  color:      u.activo ? '#15803D' : '#DC2626',
                                }}>
                                  {u.activo ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
