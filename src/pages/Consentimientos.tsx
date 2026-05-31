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

// --- MOCK DATA ---
const MOCK_PACIENTES: Paciente[] = [
  { id: 1, nombre: "Ana", apellido: "González", ci: "1234567" },
  { id: 2, nombre: "Luis", apellido: "Pérez", ci: "2345678" },
  { id: 3, nombre: "María", apellido: "Rodríguez", ci: "3456789" },
  { id: 4, nombre: "Carlos", apellido: "Sánchez", ci: "4567890" },
  { id: 5, nombre: "Lucía", apellido: "Gómez", ci: "5678901" },
]

const INITIAL_CONSENTS: Consentimiento[] = [
  {
    id: 1, paciente_nombre: "Ana González", tipo_nombre: "Consentimiento Quirúrgico", estado: "OTORGADO",
    otorgado_en: new Date().toISOString(), vigente_hasta: new Date(Date.now() + 31536000000).toISOString(),
    registrado_por_nombre: "Dr. Mock", testigo_nombre: "Juan Testigo", es_vigente: true
  },
  {
    id: 2, paciente_nombre: "Luis Pérez", tipo_nombre: "Consentimiento para Uso de Datos Clínicos (incluye imágenes, historia clínica)", estado: "OTORGADO",
    otorgado_en: new Date().toISOString(), vigente_hasta: new Date(Date.now() + 31536000000).toISOString(),
    registrado_por_nombre: "Enf. Mock", testigo_nombre: "", es_vigente: true
  }
]

export default function Consentimientos() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Consentimiento[]>(() => {
    const saved = localStorage.getItem('h_consentimientos')
    return saved ? JSON.parse(saved) : INITIAL_CONSENTS
  })
  const [tipos, setTipos] = useState<TipoConsentimiento[]>([])
  const [search, setSearch] = useState('')
  const [filtroVigente, setFiltroVigente] = useState(false)

  // --- Modal y Formulario ---
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [pacienteResults, setPacienteResults] = useState<Paciente[]>([])
  const [searchingPaciente, setSearchingPaciente] = useState(false)
  
  const [formData, setFormData] = useState({
    paciente_id: null as number | null,
    paciente_nombre: '',
    tipo_id: '' as string | number,
    estado: 'OTORGADO',
    vigente_hasta: '',
    testigo_nombre: '',
    observaciones: ''
  })

  // Persistencia Local
  useEffect(() => {
    localStorage.setItem('h_consentimientos', JSON.stringify(items))
  }, [items])

  // --- Live Search con Debounce ---
  useEffect(() => {
    if (!pacienteSearch.trim() || formData.paciente_id) {
      setPacienteResults([])
      return
    }

    const timer = setTimeout(() => {
      handlePacienteSearch()
    }, 400)

    return () => clearTimeout(timer)
  }, [pacienteSearch, formData.paciente_id])

  const canManage = hasRole('Administrativo', 'Director', 'Médico')

  const fetchTipos = useCallback(async () => {
    try {
      const res = await api.get('consentimientos/tipos/', { params: { page_size: 100 } })
      const data = res.data.results || res.data
      
      const nombresPermitidos = [
        "Consentimiento Quirúrgico",
        "Consentimiento para Procedimientos (endoscopía, biopsia, etc.)",
        "Consentimiento para Uso de Datos Clínicos (incluye imágenes, historia clínica)",
        "Consentimiento para Tratamiento Farmacológico (especialmente de alto riesgo)",
        "Consentimiento para Anestesia (general, regional, sedación)"
      ]
      
      const unicos = new Map<string, TipoConsentimiento>()
      if (Array.isArray(data)) {
        data.forEach((t: TipoConsentimiento) => {
          // Limpiar nombre para comparación robusta
          const nameClean = t.nombre.trim()
          if (nombresPermitidos.includes(nameClean) && !unicos.has(nameClean)) {
            unicos.set(nameClean, t)
          }
        })
      }
      
      const filtrados = Array.from(unicos.values())
      setTipos(filtrados)

      if (filtrados.length > 0 && !formData.tipo_id) {
        setFormData(prev => ({ ...prev, tipo_id: filtrados[0].id }))
      }
    } catch (err) {
      console.error('Error al cargar tipos:', err)
    }
  }, [formData.tipo_id])

  useEffect(() => {
    fetchTipos()
  }, [fetchTipos])

  // --- Handlers Búsqueda Paciente (MOCK) ---
  const handlePacienteSearch = () => {
    const q = pacienteSearch.toLowerCase().trim()
    if (q.length < 2) return
    
    setSearchingPaciente(true)
    const filtered = MOCK_PACIENTES.filter(p => 
      p.nombre.toLowerCase().includes(q) || 
      p.apellido?.toLowerCase().includes(q) || 
      p.ci.includes(q)
    )
    setPacienteResults(filtered)
    setSearchingPaciente(false)
  }

  const selectPaciente = (p: Paciente) => {
    setFormData(prev => ({ ...prev, paciente_id: p.id, paciente_nombre: `${p.nombre} ${p.apellido || ''} (CI: ${p.ci})` }))
    setPacienteResults([])
    setPacienteSearch('')
    setFormError(null)
  }

  // --- Handlers Acciones ---
  const handleRevocar = (id: number) => {
    if (!window.confirm('¿Está seguro de revocar este consentimiento?')) return
    const nuevos = items.map(item => 
      item.id === id ? { ...item, estado: 'REVOCADO', es_vigente: false } : item
    )
    setItems(nuevos)
  }

  const handleVerDetalles = (item: Consentimiento) => {
    alert(`DETALLES:\nPaciente: ${item.paciente_nombre}\nTipo: ${item.tipo_nombre}\nEstado: ${item.estado}\nFecha: ${new Date(item.otorgado_en).toLocaleString()}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.paciente_id || !formData.tipo_id) {
      setFormError('Debe seleccionar un paciente y un tipo de consentimiento.')
      return
    }

    const tipo = tipos.find(t => t.id === Number(formData.tipo_id))
    if (tipo?.requiere_testigo && !formData.testigo_nombre.trim()) {
      setFormError(`El tipo "${tipo.nombre}" requiere obligatoriamente un testigo.`)
      return
    }

    setSubmitting(true)
    setFormError(null)
    
    // Simular registro exitoso
    const unAnioDespues = new Date()
    unAnioDespues.setFullYear(unAnioDespues.getFullYear() + 1)

    const nuevo: Consentimiento = {
      id: Date.now(),
      paciente_nombre: formData.paciente_nombre,
      tipo_nombre: tipo?.nombre || '',
      estado: formData.estado,
      otorgado_en: new Date().toISOString(),
      vigente_hasta: formData.vigente_hasta ? new Date(formData.vigente_hasta).toISOString() : unAnioDespues.toISOString(),
      registrado_por_nombre: "Usted",
      testigo_nombre: formData.testigo_nombre,
      es_vigente: formData.estado === 'OTORGADO'
    }

    setItems([nuevo, ...items])
    setShowModal(false)
    resetForm()
    setSubmitting(false)
  }

  const resetForm = () => {
    setFormData({
      paciente_id: null,
      paciente_nombre: '',
      tipo_id: tipos.length > 0 ? tipos[0].id : '',
      estado: 'OTORGADO',
      vigente_hasta: '',
      testigo_nombre: '',
      observaciones: ''
    })
    setPacienteSearch('')
    setPacienteResults([])
    setFormError(null)
  }

  // --- Filtros Aplicados ---
  const filteredItems = items.filter(item => {
    const textMatch = 
      item.paciente_nombre.toLowerCase().includes(search.toLowerCase()) ||
      item.testigo_nombre.toLowerCase().includes(search.toLowerCase())
    
    const vigenciaMatch = !filtroVigente || (item.estado === 'OTORGADO' && (!item.vigente_hasta || new Date(item.vigente_hasta) > new Date()))
    
    return textMatch && vigenciaMatch
  })

  return (
    <div style={{ padding: '24px', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#122268', margin: 0 }}>Consentimientos Informados</h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '4px' }}>Gestión de documentos legales y autorizaciones.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canManage && (
            <button 
              onClick={() => { resetForm(); setShowModal(true); }}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#00A896', border: 'none', color: 'white',
                padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              <Plus size={18} /> Nuevo Registro
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #B3D4FF', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente o testigo..."
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1.5px solid #E2E8F0', borderRadius: '8px' }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={filtroVigente} onChange={(e) => setFiltroVigente(e.target.checked)} />
          Solo vigentes
        </label>
      </div>

      {/* Tabla Principal */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #B3D4FF', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #B3D4FF' }}>
              {['Paciente', 'Tipo', 'Estado', 'Fecha', 'Vigencia', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => {
              const colors = ESTADO_COLORS[item.estado] || { bg: '#eee', text: '#333' }
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#122268' }}>{item.paciente_nombre}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Reg. por: {item.registrado_por_nombre}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#1E293B' }}>{item.tipo_nombre}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: colors.bg, color: colors.text, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569' }}>
                    {new Date(item.otorgado_en).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569' }}>
                    {item.vigente_hasta ? new Date(item.vigente_hasta).toLocaleDateString() : 'Indefinida'}
                    {item.es_vigente && <CheckCircle size={12} style={{ color: '#10B981', marginLeft: '6px' }} />}
                  </td>
                  <td style={{ padding: '14px 16px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleVerDetalles(item)} style={{ background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer' }} title="Detalles"><Eye size={16}/></button>
                    {item.estado === 'OTORGADO' && canManage && (
                      <button 
                        onClick={() => handleRevocar(item.id)}
                        style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
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
            <p>No se encontraron registros de consentimiento.</p>
          </div>
        )}
      </div>

      {/* MODAL DE CREACIÓN */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, 
          background: 'rgba(18, 34, 104, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'white', width: '100%', maxWidth: '580px', 
            borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#00A896', color: 'white', padding: '10px', borderRadius: '12px' }}><Plus size={20}/></div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#122268' }}>Registrar Consentimiento</h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={20}/></button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', maxHeight: '75vh' }}>
              {formError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', padding: '14px', borderRadius: '12px', display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <AlertCircle size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: '#B91C1C', margin: 0, fontWeight: 500 }}>{formError}</p>
                </div>
              )}

              {/* Búsqueda de Paciente */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#122268', marginBottom: '8px' }}>PACIENTE (Búsqueda automática)</label>
                {formData.paciente_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0F6FF', padding: '14px', borderRadius: '12px', border: '2px solid #B3D4FF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#1D4ED8', color: 'white', padding: '6px', borderRadius: '50%' }}><User size={14} /></div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#122268' }}>{formData.paciente_nombre}</span>
                    </div>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, paciente_id: null, paciente_nombre: '' }))} style={{ background: '#fff', border: '1px solid #DC2626', color: '#DC2626', padding: '4px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>CAMBIAR</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        value={pacienteSearch}
                        onChange={(e) => setPacienteSearch(e.target.value)}
                        placeholder="Escriba Ana o Luis para probar..."
                        style={{ width: '100%', padding: '12px 40px 12px 16px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', outline: 'none' }}
                        autoFocus
                      />
                    </div>
                    {pacienteResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #B3D4FF', borderRadius: '12px', marginTop: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                        {pacienteResults.map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => selectPaciente(p)}
                            style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                          >
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#122268' }}>{p.nombre} {p.apellido}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>CI: {p.ci}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tipo */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#122268', marginBottom: '8px' }}>TIPO DE CONSENTIMIENTO</label>
                <select 
                  value={formData.tipo_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo_id: e.target.value }))}
                  style={{ width: '100%', padding: '12px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', background: 'white', outline: 'none' }}
                  required
                >
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              {/* Vigencia y Testigo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#122268', marginBottom: '8px' }}>VIGENTE HASTA (OPCIONAL)</label>
                  <input 
                    type="datetime-local"
                    value={formData.vigente_hasta}
                    onChange={(e) => setFormData(prev => ({ ...prev, vigente_hasta: e.target.value }))}
                    style={{ width: '100%', padding: '12px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#122268', marginBottom: '8px' }}>NOMBRE DEL TESTIGO</label>
                  <input 
                    value={formData.testigo_nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, testigo_nombre: e.target.value }))}
                    placeholder="Opcional..."
                    style={{ width: '100%', padding: '12px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '14px', background: '#F1F5F9', color: '#122268', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' }}
                >
                  CANCELAR
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 2, padding: '14px', background: '#00A896', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  REGISTRAR CONSENTIMIENTO
                </button>
              </div>
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
