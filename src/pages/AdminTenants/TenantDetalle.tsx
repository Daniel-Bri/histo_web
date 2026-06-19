import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getTenant,
  patchTenant,
  toggleActivoTenant,
  getConfigTenant,
  patchConfigTenant,
  type TenantResumen,
  type ConfiguracionTenant,
} from '../../services/configuracionService'
import {
  getSuscripcion,
  patchSuscripcion,
  crearPagoSaaS,
  PLAN_LABELS,
  ESTADO_LABELS,
  ESTADO_COLOR,
  type SuscripcionTenant,
} from '../../services/saasService'
import { getStoredUser } from '../../utils/auth'

type Tab = 'datos' | 'configuracion' | 'modulos' | 'suscripcion'

const IDIOMAS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
]
const MONEDAS = [
  { value: 'BOB', label: 'Boliviano (BOB)' },
  { value: 'USD', label: 'Dólar (USD)' },
  { value: 'PEN', label: 'Sol (PEN)' },
  { value: 'ARS', label: 'Peso AR (ARS)' },
  { value: 'CLP', label: 'Peso CL (CLP)' },
]

// ── Estilos ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #E2E8F0',
  padding: '24px',
  marginBottom: '16px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
}

const fieldRow: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }
const lbl: React.CSSProperties      = { fontSize: '13px', fontWeight: 600, color: '#374151' }
const inp: React.CSSProperties      = { border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' }
const btnP: React.CSSProperties     = { background: '#00A896', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const btnS: React.CSSProperties     = { background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const btnD: React.CSSProperties     = { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }

// ── Componente ────────────────────────────────────────────────────────────────

export default function TenantDetalle() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = getStoredUser()
  const tenantId = Number(id)

  if (!user?.is_staff) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>Acceso restringido.</div>
  }

  const [tab, setTab]         = useState<Tab>('datos')
  const [tenant, setTenant]   = useState<TenantResumen | null>(null)
  const [config, setConfig]   = useState<ConfiguracionTenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  // Campos del tenant
  const [nombre,    setNombre]    = useState('')
  const [nit,       setNit]       = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [dirtyD,    setDirtyD]    = useState(false)

  // Campos de config
  const [emailContacto, setEmailContacto] = useState('')
  const [sitioWeb,      setSitioWeb]      = useState('')
  const [idioma,        setIdioma]        = useState('es')
  const [moneda,        setMoneda]        = useState('BOB')
  const [zonaHoraria,   setZonaHoraria]   = useState('America/La_Paz')
  const [dirtyC,        setDirtyC]        = useState(false)

  // Módulos
  const [modulosHab, setModulosHab] = useState<string[]>([])

  // Suscripción
  const [sub,        setSub]        = useState<SuscripcionTenant | null>(null)
  const [subPlan,    setSubPlan]    = useState<string>('BASICO')
  const [subEstado,  setSubEstado]  = useState<string>('PENDIENTE')
  const [subMonto,   setSubMonto]   = useState<string>('50.00')
  const [subLoading, setSubLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [t, cfg] = await Promise.all([getTenant(tenantId), getConfigTenant(tenantId)])
        setTenant(t); setConfig(cfg)
        setNombre(t.nombre); setNit(t.nit); setDireccion(t.direccion); setTelefono(t.telefono)
        setEmailContacto(cfg.email_contacto); setSitioWeb(cfg.sitio_web)
        setIdioma(cfg.idioma); setMoneda(cfg.moneda); setZonaHoraria(cfg.zona_horaria)
        setModulosHab(cfg.modulos_habilitados)
        // Cargar suscripción en paralelo
        try {
          const s = await getSuscripcion(tenantId)
          setSub(s); setSubPlan(s.plan); setSubEstado(s.estado); setSubMonto(s.monto_mensual)
        } catch { /* suscripción puede no existir aún */ }
      } catch {
        flash('err', 'No se pudo cargar el establecimiento.')
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantId])

  function flash(tipo: 'ok' | 'err', texto: string) {
    setMsg({ tipo, texto })
    setTimeout(() => setMsg(null), 3500)
  }

  async function handleGuardarDatos() {
    setSaving(true)
    try {
      const upd = await patchTenant(tenantId, { nombre, nit, direccion, telefono })
      setTenant(upd); setDirtyD(false)
      flash('ok', 'Datos del establecimiento guardados.')
    } catch { flash('err', 'Error al guardar.') }
    finally { setSaving(false) }
  }

  async function handleGuardarConfig() {
    setSaving(true)
    try {
      const upd = await patchConfigTenant(tenantId, { email_contacto: emailContacto, sitio_web: sitioWeb, idioma, moneda, zona_horaria: zonaHoraria })
      setConfig(upd); setDirtyC(false)
      flash('ok', 'Configuración guardada.')
    } catch { flash('err', 'Error al guardar.') }
    finally { setSaving(false) }
  }

  async function handleGuardarModulos() {
    setSaving(true)
    try {
      const upd = await patchConfigTenant(tenantId, { modulos_habilitados: modulosHab })
      setConfig(upd)
      flash('ok', 'Módulos actualizados.')
    } catch { flash('err', 'Error al guardar módulos.') }
    finally { setSaving(false) }
  }

  async function handleToggle() {
    try {
      const upd = await toggleActivoTenant(tenantId)
      setTenant(upd)
      flash('ok', `Establecimiento ${upd.activo ? 'activado' : 'desactivado'}.`)
    } catch { flash('err', 'Error al cambiar estado.') }
  }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>Cargando…</div>
  if (!tenant) return <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>Establecimiento no encontrado.</div>

  async function handleGuardarSub() {
    setSubLoading(true)
    try {
      const upd = await patchSuscripcion(tenantId, { plan: subPlan as SuscripcionTenant['plan'], estado: subEstado as SuscripcionTenant['estado'], monto_mensual: subMonto })
      setSub(upd)
      flash('ok', 'Suscripción actualizada.')
    } catch { flash('err', 'Error al guardar suscripción.') }
    finally { setSubLoading(false) }
  }

  async function handleGenerarPago() {
    setPayLoading(true)
    try {
      const { checkout_url } = await crearPagoSaaS(tenantId)
      window.open(checkout_url, '_blank')
      flash('ok', 'Link de pago generado. Se abrió en una nueva pestaña.')
    } catch { flash('err', 'Error al generar el link de pago.') }
    finally { setPayLoading(false) }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'datos',         label: 'Datos del establecimiento' },
    { id: 'configuracion', label: 'Configuración' },
    { id: 'modulos',       label: 'Módulos' },
    { id: 'suscripcion',   label: 'Suscripción' },
  ]

  return (
    <div style={{ padding: '28px 32px', maxWidth: '860px', margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/admin/tenants')}
          style={{ ...btnS, padding: '6px 12px', fontSize: '12px' }}
        >
          ← Volver
        </button>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: tenant.activo ? 'rgba(0,168,150,0.12)' : '#F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 800,
          color: tenant.activo ? '#00A896' : '#94A3B8',
        }}>
          {tenant.nombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>{tenant.nombre}</h1>
          <p style={{ color: '#64748B', fontSize: '12px', margin: '2px 0 0' }}>
            slug: <code style={{ background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>{tenant.slug}</code>
            {' '}·{' '}
            <span style={{ color: tenant.activo ? '#15803D' : '#DC2626', fontWeight: 600 }}>
              {tenant.activo ? 'Activo' : 'Inactivo'}
            </span>
          </p>
        </div>
        <button
          onClick={() => void handleToggle()}
          style={{
            marginLeft: 'auto',
            ...(tenant.activo ? btnD : { ...btnS, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0' }),
          }}
        >
          {tenant.activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>

      {/* Flash */}
      {msg && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px', margin: '16px 0',
          fontSize: '13px', fontWeight: 500,
          background: msg.tipo === 'ok' ? '#ECFDF5' : '#FEF2F2',
          color:      msg.tipo === 'ok' ? '#065F46' : '#991B1B',
          border:     `1px solid ${msg.tipo === 'ok' ? '#A7F3D0' : '#FECACA'}`,
        }}>
          {msg.texto}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', margin: '20px 0', background: '#F1F5F9', borderRadius: '10px', padding: '4px' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '7px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              background: tab === t.id ? '#fff' : 'transparent',
              color:      tab === t.id ? '#0F172A' : '#64748B',
              boxShadow:  tab === t.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Datos ── */}
      {tab === 'datos' && (
        <div style={card}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', margin: '0 0 20px' }}>Datos del establecimiento</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={fieldRow}>
              <label style={lbl}>Nombre</label>
              <input style={inp} value={nombre} onChange={e => { setNombre(e.target.value); setDirtyD(true) }} />
            </div>
            <div style={fieldRow}>
              <label style={lbl}>NIT</label>
              <input style={inp} value={nit} onChange={e => { setNit(e.target.value); setDirtyD(true) }} />
            </div>
            <div style={fieldRow}>
              <label style={lbl}>Teléfono</label>
              <input style={inp} value={telefono} onChange={e => { setTelefono(e.target.value); setDirtyD(true) }} />
            </div>
            <div style={{ ...fieldRow, gridColumn: '1 / -1' }}>
              <label style={lbl}>Dirección</label>
              <input style={inp} value={direccion} onChange={e => { setDireccion(e.target.value); setDirtyD(true) }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={btnP} onClick={() => void handleGuardarDatos()} disabled={saving || !dirtyD}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {dirtyD && (
              <button style={btnS} onClick={() => {
                setNombre(tenant.nombre); setNit(tenant.nit)
                setDireccion(tenant.direccion); setTelefono(tenant.telefono)
                setDirtyD(false)
              }}>
                Descartar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Configuración ── */}
      {tab === 'configuracion' && (
        <div style={card}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', margin: '0 0 20px' }}>Configuración del establecimiento</h2>
          <div style={fieldRow}>
            <label style={lbl}>Email de contacto</label>
            <input style={inp} type="email" value={emailContacto} onChange={e => { setEmailContacto(e.target.value); setDirtyC(true) }} placeholder="contacto@clinica.com" />
          </div>
          <div style={fieldRow}>
            <label style={lbl}>Sitio web</label>
            <input style={inp} value={sitioWeb} onChange={e => { setSitioWeb(e.target.value); setDirtyC(true) }} placeholder="https://www.clinica.com" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div style={fieldRow}>
              <label style={lbl}>Idioma</label>
              <select style={inp} value={idioma} onChange={e => { setIdioma(e.target.value); setDirtyC(true) }}>
                {IDIOMAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div style={fieldRow}>
              <label style={lbl}>Moneda</label>
              <select style={inp} value={moneda} onChange={e => { setMoneda(e.target.value); setDirtyC(true) }}>
                {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div style={fieldRow}>
              <label style={lbl}>Zona horaria</label>
              <input style={inp} value={zonaHoraria} onChange={e => { setZonaHoraria(e.target.value); setDirtyC(true) }} placeholder="America/La_Paz" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={btnP} onClick={() => void handleGuardarConfig()} disabled={saving || !dirtyC}>
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </button>
            {dirtyC && (
              <button style={btnS} onClick={() => {
                setEmailContacto(config?.email_contacto ?? '')
                setSitioWeb(config?.sitio_web ?? '')
                setIdioma(config?.idioma ?? 'es')
                setMoneda(config?.moneda ?? 'BOB')
                setZonaHoraria(config?.zona_horaria ?? 'America/La_Paz')
                setDirtyC(false)
              }}>
                Descartar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Módulos ── */}
      {tab === 'modulos' && (
        <div style={card}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', margin: '0 0 4px' }}>Módulos habilitados</h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px' }}>
            Lista vacía = todos los módulos activos.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {(config?.modulos_disponibles ?? []).map(m => (
              <label
                key={m.codigo}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                  border: `1px solid ${modulosHab.includes(m.codigo) ? '#A7F3D0' : '#E2E8F0'}`,
                  background: modulosHab.includes(m.codigo) ? '#ECFDF5' : '#F8FAFC',
                }}
              >
                <input
                  type="checkbox"
                  checked={modulosHab.includes(m.codigo)}
                  onChange={() => setModulosHab(prev =>
                    prev.includes(m.codigo) ? prev.filter(c => c !== m.codigo) : [...prev, m.codigo],
                  )}
                  style={{ accentColor: '#00A896', width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#1E293B' }}>{m.nombre}</span>
                <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>{m.codigo}</span>
              </label>
            ))}
          </div>
          <button style={btnP} onClick={() => void handleGuardarModulos()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar módulos'}
          </button>
        </div>
      )}

      {/* ── Tab: Suscripción ── */}
      {tab === 'suscripcion' && (
        <div>
          {/* Estado actual */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: sub ? `${ESTADO_COLOR[sub.estado as SuscripcionTenant['estado']]}18` : '#F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>
              {sub?.estado === 'ACTIVA' ? '✓' : sub?.estado === 'SUSPENDIDA' ? '⛔' : sub?.estado === 'EXPIRADA' ? '⚠' : '⏳'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Estado actual</div>
              <div style={{
                fontSize: 20, fontWeight: 700,
                color: sub ? ESTADO_COLOR[sub.estado as SuscripcionTenant['estado']] : '#64748B',
              }}>
                {sub ? ESTADO_LABELS[sub.estado as SuscripcionTenant['estado']] : 'Sin suscripción'}
              </div>
              {sub?.fecha_vencimiento && (
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                  Vence: {new Date(sub.fecha_vencimiento).toLocaleDateString('es-BO')}
                  {sub.fecha_ultimo_pago && (
                    <> · Último pago: {new Date(sub.fecha_ultimo_pago).toLocaleDateString('es-BO')}</>
                  )}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#64748B' }}>Plan</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1E293B' }}>
                {sub ? PLAN_LABELS[sub.plan as SuscripcionTenant['plan']] : '—'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8', marginTop: 2 }}>
                ${sub ? parseFloat(sub.monto_mensual).toFixed(2) : '0.00'} <span style={{ fontSize: 12, fontWeight: 400, color: '#94A3B8' }}>USD/mes</span>
              </div>
            </div>
          </div>

          {/* Edición */}
          <div style={card}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', margin: '0 0 20px' }}>Configurar suscripción</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={fieldRow}>
                <label style={lbl}>Plan</label>
                <select style={inp} value={subPlan} onChange={e => setSubPlan(e.target.value)}>
                  <option value="BASICO">Básico</option>
                  <option value="PROFESIONAL">Profesional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div style={fieldRow}>
                <label style={lbl}>Estado</label>
                <select style={inp} value={subEstado} onChange={e => setSubEstado(e.target.value)}>
                  <option value="PENDIENTE">Pendiente de pago</option>
                  <option value="ACTIVA">Activa</option>
                  <option value="EXPIRADA">Expirada</option>
                  <option value="SUSPENDIDA">Suspendida</option>
                </select>
              </div>
              <div style={fieldRow}>
                <label style={lbl}>Monto mensual (USD)</label>
                <input style={inp} type="number" step="0.01" min="0" value={subMonto} onChange={e => setSubMonto(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button style={btnP} onClick={() => void handleGuardarSub()} disabled={subLoading}>
                {subLoading ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                onClick={() => void handleGenerarPago()}
                disabled={payLoading}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  background: '#1d4ed8', color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {payLoading ? 'Generando…' : '💳 Generar link de pago'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 12 }}>
              Al generar el link de pago se abre Stripe Checkout. Comparte ese link con la clínica para que realice el pago.
              Stripe notificará automáticamente al sistema cuando el pago se confirme.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
