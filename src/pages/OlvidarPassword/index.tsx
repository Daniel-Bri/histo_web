import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/axiosConfig'

type Step = 'email' | 'code' | 'password' | 'success'

const PRIMARY = '#0023B8'
const ACCENT  = '#00A896'
const ERROR   = '#E53935'
const FONDO   = '#F0F6FF'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid #D1D5DB',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  background: PRIMARY,
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '8px',
}

const btnOutline: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  background: 'transparent',
  color: PRIMARY,
  border: `1.5px solid ${PRIMARY}`,
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  marginTop: '6px',
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: FONDO }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '380px', boxShadow: '0 4px 24px rgba(0,35,184,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={{ background: ACCENT, borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
            HL
          </div>
          <span style={{ fontWeight: 700, fontSize: '20px', color: PRIMARY }}>HistoLink</span>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function OlvidarPassword() {
  const navigate = useNavigate()

  const [step, setStep]         = useState<Step>('email')
  const [email, setEmail]       = useState('')
  const [code, setCode]         = useState('')
  const [pass1, setPass1]       = useState('')
  const [pass2, setPass2]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // ── Paso 1: solicitar código ────────────────────────────────────────
  const handleSendCode = async () => {
    setError('')
    if (!email.trim()) { setError('Ingresa tu correo electrónico.'); return }
    setLoading(true)
    try {
      await api.post('auth/forgot-password/', { email: email.trim().toLowerCase() })
      setStep('code')
    } catch {
      setError('Error al enviar el código. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 2: verificar código (avanzar a paso 3) ─────────────────────
  const handleVerifyCode = () => {
    setError('')
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('El código debe ser de 6 dígitos numéricos.')
      return
    }
    setStep('password')
  }

  // ── Paso 3: nueva contraseña ────────────────────────────────────────
  const handleReset = async () => {
    setError('')
    if (pass1.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pass1 !== pass2)  { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      await api.post('auth/reset-password/', {
        email:                email.trim().toLowerCase(),
        code,
        new_password:         pass1,
        new_password_confirm: pass2,
      })
      setStep('success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Código inválido o expirado.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Vista: éxito ────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Card>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>✅</div>
          <h2 style={{ color: PRIMARY, fontSize: '20px', marginBottom: '8px' }}>¡Contraseña actualizada!</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '28px' }}>
            Tu contraseña fue cambiada exitosamente. Ya puedes iniciar sesión.
          </p>
          <button style={btnPrimary} onClick={() => navigate('/login')}>
            Ir al Login
          </button>
        </div>
      </Card>
    )
  }

  // ── Vista: paso 3 — nueva contraseña ───────────────────────────────
  if (step === 'password') {
    return (
      <Card>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: PRIMARY, marginBottom: '6px' }}>Nueva contraseña</h2>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>
          Ingresa tu nueva contraseña (mínimo 8 caracteres).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={pass1}
            onChange={e => setPass1(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={pass2}
            onChange={e => setPass2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReset()}
            style={inputStyle}
          />
          {error && <p style={{ color: ERROR, fontSize: '13px', margin: 0 }}>{error}</p>}
          <button style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleReset} disabled={loading}>
            {loading ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
          <button style={btnOutline} onClick={() => setStep('code')}>← Volver</button>
        </div>
      </Card>
    )
  }

  // ── Vista: paso 2 — código ──────────────────────────────────────────
  if (step === 'code') {
    return (
      <Card>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: PRIMARY, marginBottom: '6px' }}>Código de verificación</h2>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>
          Ingresa el código de 6 dígitos que enviamos a:
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, color: PRIMARY, marginBottom: '24px' }}>{email}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            placeholder="Código de 6 dígitos"
            value={code}
            maxLength={6}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
            style={{ ...inputStyle, letterSpacing: '8px', fontSize: '20px', fontWeight: 700, textAlign: 'center' }}
          />
          {error && <p style={{ color: ERROR, fontSize: '13px', margin: 0 }}>{error}</p>}
          <button style={btnPrimary} onClick={handleVerifyCode}>
            Verificar código
          </button>
          <button
            style={{ ...btnOutline, color: '#6B7280', borderColor: '#D1D5DB' }}
            onClick={handleSendCode}
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Reenviar código'}
          </button>
          <button style={btnOutline} onClick={() => setStep('email')}>← Volver</button>
        </div>
      </Card>
    )
  }

  // ── Vista: paso 1 — email ───────────────────────────────────────────
  return (
    <Card>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: PRIMARY, marginBottom: '6px' }}>¿Olvidaste tu contraseña?</h2>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>
        Ingresa tu correo y te enviaremos un código de 6 dígitos para recuperar tu cuenta.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="email"
          placeholder="tu@gmail.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendCode()}
          style={inputStyle}
        />
        {error && <p style={{ color: ERROR, fontSize: '13px', margin: 0 }}>{error}</p>}
        <button style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleSendCode} disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar código'}
        </button>
        <button style={btnOutline} onClick={() => navigate('/login')}>← Volver al login</button>
      </div>
    </Card>
  )
}
