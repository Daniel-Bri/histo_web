import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/axiosConfig'
import { RefreshCw, Plus, CheckCircle, Download, Search, User, AlertCircle, X, FileText, Trash2, Eye } from 'lucide-react'
import { hasRole } from '../utils/auth'
import { parseDrfErrorResponse } from '../services/pacienteService'
import type { Paciente } from '../types/paciente.types'

interface TipoConsentimiento {
  id: number
  nombre: string
  requiere_testigo: boolean
}

interface Consentimiento {
  id: number
  paciente_nombre: string
  tipo_nombre: string
  estado: string
  otorgado_en: string
  vigente_hasta: string | null
  registrado_por_nombre: string
  testigo_nombre: string
  es_vigente: boolean
}

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  OTORGADO: { bg: '#DCFCE7', text: '#15803D' },
  RECHAZADO: { bg: '#FEE2E2', text: '#DC2626' },
  REVOCADO: { bg: '#F1F5F9', text: '#64748B' },
}

// --- MOCK DATA (REQUERIDOS) ---
const MOCK_PACIENTES: Paciente[] = [
  { id: 101, nombre: "Lorena", apellido: "García Rocha", ci: "49593002" },
  { id: 102, nombre: "Roberto", apellido: "Chavez Inca", ci: "3001003" },
  { id: 103, nombre: "Maria Elena", apellido: "Torres Vargas", ci: "3001002" },
  { id: 104, nombre: "Juan Carlos", apellido: "Perez Soria", ci: "3001001" },
]

const URGENT_PROCEDURES = [
  "Reanimación cardiopulmonar",
  "Intubación",
  "Cirugía de urgencia",
  "Transfusión sanguínea",
  "Administración de fármacos de alto riesgo",
  "Otro"
]

const JUSTIFICATION_BUBBLES = [
  "Paciente inconsciente",
  "Riesgo vital inminente",
  "Menor de edad sin apoderado",
  "Paciente en estado crítico sin capacidad de decisión"
]

export default function Consentimientos() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Consentimiento[]>(() => {
    const saved = localStorage.getItem('h_emergency_consents')
    return saved ? JSON.parse(saved) : []
  })
  const [search, setSearch] = useState('')
  const [filtroVigente, setFiltroVigente] = useState(false)

  // --- Modal y Formulario ---
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    paciente_id: '' as string | number,
    paciente_nombre: '',
    testigo_nombre: '',
    procedimiento: '',
    justificacion: '',
    timestamp: ''
  })

  // Actualizar timestamp en tiempo real al abrir modal
  useEffect(() => {
    if (showModal) {
      const updateTime = () => {
        const now = new Date();
        const fmt = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setFormData(prev => ({ ...prev, timestamp: fmt }));
      };
      updateTime();
    }
  }, [showModal])

  // Persistencia Local
  useEffect(() => {
    localStorage.setItem('h_emergency_consents', JSON.stringify(items))
  }, [items])

  const canManage = hasRole('Administrativo', 'Director', 'Médico')

  // --- Handlers Acciones ---
  const handleRevocar = (id: number) => {
    if (!window.confirm('¿Está seguro de revocar este consentimiento?')) return
    const nuevos = items.map(item => 
      item.id === id ? { ...item, estado: 'REVOCADO', es_vigente: false } : item
    )
    setItems(nuevos)
  }

  const addJustification = (text: string) => {
    setFormData(prev => {
      const current = prev.justificacion.trim();
      const newValue = current ? `${current}, ${text}` : text;
      return { ...prev, justificacion: newValue };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { paciente_id, testigo_nombre, procedimiento, justificacion, timestamp } = formData
    
    if (!paciente_id || !testigo_nombre || !procedimiento || !justificacion) {
      setFormError('Por favor, complete todos los campos obligatorios.')
      return
    }

    // Validar duplicados (mismo paciente, mismo día)
    const dateOnly = timestamp.split(' ')[0]
    const isDuplicate = items.some(item => 
      item.paciente_id === Number(paciente_id) && 
      item.otorgado_en.split(' ')[0] === dateOnly &&
      item.estado === 'OTORGADO'
    )

    if (isDuplicate) {
      setFormError('Ya existe un consentimiento registrado para este paciente el día de hoy.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    
    const paciente = MOCK_PACIENTES.find(p => p.id === Number(paciente_id))
    const unAnioDespues = new Date()
    unAnioDespues.setFullYear(unAnioDespues.getFullYear() + 1)
    const expFmt = `${String(unAnioDespues.getDate()).padStart(2, '0')}/${String(unAnioDespues.getMonth() + 1).padStart(2, '0')}/${unAnioDespues.getFullYear()}`;

    const nuevo: any = {
      id: Date.now(),
      paciente_id: Number(paciente_id),
      paciente_nombre: `${paciente?.nombre} ${paciente?.apellido} (CI: ${paciente?.ci})`,
      tipo_nombre: `Emergencia: ${procedimiento}`,
      estado: 'OTORGADO',
      otorgado_en: timestamp,
      vigente_hasta: expFmt,
      registrado_por_nombre: "Personal de Emergencia",
      testigo_nombre: testigo_nombre,
      es_vigente: true,
      justificacion: justificacion
    }

    setItems([nuevo, ...items])
    setShowModal(false)
    resetForm()
    setSubmitting(false)
  }

  const resetForm = () => {
    setFormData({
      paciente_id: '',
      paciente_nombre: '',
      testigo_nombre: '',
      procedimiento: '',
      justificacion: '',
      timestamp: ''
    })
    setFormError(null)
  }

  // --- Filtros Aplicados ---
  const filteredItems = items.filter(item => {
    const textMatch = 
      item.paciente_nombre.toLowerCase().includes(search.toLowerCase()) ||
      item.testigo_nombre.toLowerCase().includes(search.toLowerCase())
    
    return textMatch
  })

  return (
    <div style={{ padding: '24px', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#2C7DA0', margin: 0 }}>Consentimientos de Emergencia</h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '4px' }}>Registro rápido para procedimientos urgentes.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canManage && (
            <button 
              onClick={() => { resetForm(); setShowModal(true); }}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#E63946', border: 'none', color: 'white',
                padding: '12px 24px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                fontSize: '15px', boxShadow: '0 4px 6px rgba(230, 57, 70, 0.2)'
              }}
            >
              <Plus size={18} /> REGISTRAR CONSENTIMIENTO
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #2C7DA0', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#2C7DA0' }} />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente o testigo..."
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1.5px solid #E2E8F0', borderRadius: '8px' }}
          />
        </div>
      </div>

      {/* Tabla Principal */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #2C7DA0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #2C7DA0' }}>
              {['Paciente', 'Procedimiento / Justificación', 'Estado', 'Fecha Registro', 'Vigencia', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#2C7DA0', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => {
              const colors = ESTADO_COLORS[item.estado] || { bg: '#eee', text: '#333' }
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>{item.paciente_nombre}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Testigo: {item.testigo_nombre}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', color: '#2C7DA0', fontWeight: 600 }}>{item.tipo_nombre}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '300px' }}>{item.justificacion}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: colors.bg, color: colors.text, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569' }}>
                    {item.otorgado_en}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569' }}>
                    {item.vigente_hasta}
                    {item.es_vigente && <CheckCircle size={12} style={{ color: '#10B981', marginLeft: '6px' }} />}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {item.estado === 'OTORGADO' && (
                      <button 
                        onClick={() => handleRevocar(item.id)}
                        style={{ background: 'none', border: 'none', color: '#E63946', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Revocar
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredItems.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <FileText size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>No hay consentimientos de emergencia registrados.</p>
          </div>
        )}
      </div>

      {/* MODAL DE REGISTRO DE EMERGENCIA */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'white', width: '100%', maxWidth: '600px', 
            borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#2C7DA0' }}>Registro de Consentimiento de Emergencia</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}><X size={24}/></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              {formError && (
                <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: 500 }}>
                  {formError}
                </div>
              )}

              {/* Paciente y Fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#2C7DA0', marginBottom: '6px' }}>PACIENTE *</label>
                  <select 
                    value={formData.paciente_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, paciente_id: e.target.value }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px' }}
                    required
                  >
                    <option value="">Seleccione...</option>
                    {MOCK_PACIENTES.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido} (CI: {p.ci})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#2C7DA0', marginBottom: '6px' }}>FECHA Y HORA</label>
                  <input 
                    readOnly
                    value={formData.timestamp}
                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px', background: '#F3F4F6' }}
                  />
                </div>
              </div>

              {/* Testigo y Procedimiento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#2C7DA0', marginBottom: '6px' }}>NOMBRE DEL TESTIGO *</label>
                  <input 
                    value={formData.testigo_nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, testigo_nombre: e.target.value }))}
                    placeholder="Nombre completo del testigo"
                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#2C7DA0', marginBottom: '6px' }}>PROCEDIMIENTO URGENTE *</label>
                  <select 
                    value={formData.procedimiento}
                    onChange={(e) => setFormData(prev => ({ ...prev, procedimiento: e.target.value }))}
                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px' }}
                    required
                  >
                    <option value="">Seleccione...</option>
                    {URGENT_PROCEDURES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Justificación */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#2C7DA0', marginBottom: '6px' }}>JUSTIFICACIÓN *</label>
                <textarea 
                  value={formData.justificacion}
                  onChange={(e) => setFormData(prev => ({ ...prev, justificacion: e.target.value }))}
                  rows={3}
                  placeholder="Describa la justificación médica..."
                  style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '8px', marginBottom: '10px' }}
                  required
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {JUSTIFICATION_BUBBLES.map(b => (
                    <button 
                      key={b}
                      type="button"
                      onClick={() => addJustification(b)}
                      style={{ background: '#E1F5FE', border: '1px solid #2C7DA0', color: '#2C7DA0', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botón Guardar */}
              <button 
                type="submit"
                disabled={submitting}
                style={{ 
                  width: '100%', padding: '14px', background: '#E63946', color: 'white', 
                  border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '16px', cursor: 'pointer'
                }}
              >
                REGISTRAR CONSENTIMIENTO
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
