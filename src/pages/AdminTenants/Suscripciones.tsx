import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listarSuscripciones,
  crearPagoSaaS,
  PLAN_LABELS,
  ESTADO_LABELS,
  ESTADO_COLOR,
  type SuscripcionTenant,
} from '../../services/saasService'
import { getStoredUser } from '../../utils/auth'

export default function Suscripciones() {
  const navigate = useNavigate()
  const user     = getStoredUser()

  if (!user?.is_staff) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>Acceso restringido.</div>
  }

  const [lista,    setLista]    = useState<SuscripcionTenant[]>([])
  const [loading,  setLoading]  = useState(true)
  const [paying,   setPaying]   = useState<number | null>(null)
  const [msg,      setMsg]      = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  useEffect(() => {
    listarSuscripciones()
      .then(setLista)
      .catch(() => setMsg({ tipo: 'err', texto: 'No se pudo cargar la lista de suscripciones.' }))
      .finally(() => setLoading(false))
  }, [])

  function flash(tipo: 'ok' | 'err', texto: string) {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  async function handlePago(tenantId: number) {
    setPaying(tenantId)
    try {
      const { checkout_url } = await crearPagoSaaS(tenantId)
      window.open(checkout_url, '_blank')
      flash('ok', 'Link de pago generado y abierto en nueva pestaña.')
    } catch {
      flash('err', 'Error al generar el link de pago.')
    } finally {
      setPaying(null)
    }
  }

  const activas    = lista.filter(s => s.estado === 'ACTIVA').length
  const pendientes = lista.filter(s => s.estado === 'PENDIENTE').length
  const expiradas  = lista.filter(s => s.estado === 'EXPIRADA' || s.estado === 'SUSPENDIDA').length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0 }}>Suscripciones SaaS</h1>
          <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>
            Gestiona los pagos mensuales de cada clínica
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Activas',   count: activas,    color: '#15803D', bg: '#ECFDF5' },
          { label: 'Pendientes', count: pendientes, color: '#B45309', bg: '#FFFBEB' },
          { label: 'Vencidas',  count: expiradas,  color: '#DC2626', bg: '#FEF2F2' },
        ].map(c => (
          <div key={c.label} style={{
            background: c.bg, borderRadius: 12, padding: '16px 20px',
            border: `1px solid ${c.color}22`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.count}</div>
            <div style={{ fontSize: 13, color: c.color, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Flash */}
      {msg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500,
          background: msg.tipo === 'ok' ? '#ECFDF5' : '#FEF2F2',
          color:      msg.tipo === 'ok' ? '#065F46' : '#991B1B',
          border:     `1px solid ${msg.tipo === 'ok' ? '#A7F3D0' : '#FECACA'}`,
        }}>
          {msg.texto}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#94A3B8', padding: 60 }}>Cargando…</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Clínica', 'Plan', 'Estado', 'Monto/mes', 'Vence', 'Último pago', 'Acción'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: i < lista.length - 1 ? '1px solid #F1F5F9' : 'none',
                    background: i % 2 === 0 ? '#fff' : '#FAFAFA',
                  }}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#1E293B' }}>{s.tenant_nombre}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.tenant_slug}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#334155' }}>
                    {PLAN_LABELS[s.plan]}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: `${ESTADO_COLOR[s.estado]}18`,
                      color: ESTADO_COLOR[s.estado],
                    }}>
                      {ESTADO_LABELS[s.estado]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1d4ed8' }}>
                    ${parseFloat(s.monto_mensual).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748B' }}>
                    {s.fecha_vencimiento ? new Date(s.fecha_vencimiento).toLocaleDateString('es-BO') : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748B' }}>
                    {s.fecha_ultimo_pago ? new Date(s.fecha_ultimo_pago).toLocaleDateString('es-BO') : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => void handlePago(s.tenant)}
                        disabled={paying === s.tenant}
                        style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none',
                          background: '#1d4ed8', color: '#fff', fontSize: 12,
                          fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {paying === s.tenant ? '…' : '💳 Cobrar'}
                      </button>
                      <button
                        onClick={() => navigate(`/admin/tenants/${s.tenant}`)}
                        style={{
                          padding: '5px 12px', borderRadius: 6,
                          border: '1px solid #E2E8F0', background: '#F8FAFC',
                          color: '#64748B', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                    No hay suscripciones registradas aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
