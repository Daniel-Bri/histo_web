import { useNavigate } from 'react-router-dom'

export default function SaasPagoExito() {
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 40,
      }}>
        ✓
      </div>

      <div>
        <h2 style={{ margin: 0, color: '#065f46', fontSize: '1.6rem' }}>Pago de suscripción confirmado</h2>
        <p style={{ marginTop: 8, color: '#6b7280', maxWidth: 440 }}>
          El pago fue procesado correctamente. La suscripción del establecimiento
          quedará activa en breve (Stripe notifica al sistema automáticamente).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => navigate('/admin/tenants')}
          style={{
            padding: '0.6rem 1.4rem', borderRadius: 8, border: 'none',
            background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Volver a Tenants
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '0.6rem 1.4rem', borderRadius: 8,
            border: '1px solid #d1d5db', background: '#fff',
            color: '#374151', cursor: 'pointer',
          }}
        >
          Ir al Dashboard
        </button>
      </div>
    </div>
  )
}
