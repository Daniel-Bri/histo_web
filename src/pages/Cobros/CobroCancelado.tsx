import { useNavigate } from 'react-router-dom'

export default function CobroCancelado() {
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 40 }}>✕</span>
      </div>

      <div>
        <h2 style={{ margin: 0, color: '#991b1b', fontSize: '1.6rem' }}>Pago cancelado</h2>
        <p style={{ marginTop: 8, color: '#6b7280', maxWidth: 400 }}>
          No se realizó ningún cargo. Puedes intentarlo nuevamente cuando lo desees.
        </p>
      </div>

      <button
        onClick={() => navigate('/cobros')}
        style={{
          padding: '0.6rem 1.4rem', borderRadius: 8, border: 'none',
          background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontWeight: 600,
        }}
      >
        Volver a Cobros
      </button>
    </div>
  )
}
