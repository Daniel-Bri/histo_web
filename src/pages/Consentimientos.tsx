import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/axiosConfig'
import { RefreshCw, Plus, CheckCircle, Download, Search, User, AlertCircle, X, FileText } from 'lucide-react'
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

export default function Consentimientos() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Consentimiento[]>([])
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

  // --- Live Search con Debounce (Facilidad de uso) ---
  useEffect(() => {
    if (!pacienteSearch.trim() || formData.paciente_id) {
      setPacienteResults([])
      return
    }

    const timer = setTimeout(() => {
      void handlePacienteSearch()
    }, 400)

    return () => clearTimeout(timer)
  }, [pacienteSearch, formData.paciente_id])

  const canManage = hasRole('Administrativo', 'Director', 'Médico')

  const fetchTipos = useCallback(async () => {
    try {
      const res = await api.get('consentimientos/tipos/', { params: { page_size: 100 } })
      const data = res.data.results || res.data
      setTipos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error al cargar tipos:', err)
    }
  }, [])

  const fetchConsentimientos = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { search }
      if (filtroVigente) params.vigente = true
      
      const res = await api.get('consentimientos/', { params })
      setItems(res.data.results || [])
    } catch (err) {
      console.error('Error al cargar consentimientos:', err)
    } finally {
      setLoading(false)
    }
  }, [search, filtroVigente])

  useEffect(() => {
    fetchTipos()
    fetchConsentimientos()
  }, [fetchTipos, fetchConsentimientos])

  // --- Handlers Búsqueda Paciente ---
  const handlePacienteSearch = async () => {
    const q = pacienteSearch.trim()
    if (!q) return
    
    setSearchingPaciente(true)
    setPacienteResults([])
    setFormError(null)
    
    try {
      const res = await api.get('pacientes/pacientes/', { params: { search: q, page_size: 6 } })
      const rows = res.data.results || []
      setPacienteResults(rows)
      if (rows.length === 0 && pacienteSearch.length > 2) setFormError('No se encontraron pacientes.')
    } catch (err) {
      setFormError('Error al conectar con el servidor de pacientes.')
    } finally {
      setSearchingPaciente(false)
    }
  }

  const selectPaciente = (p: Paciente) => {
    setFormData(prev => ({ ...prev, paciente_id: p.id, paciente_nombre: `${p.nombre} ${p.apellido} (CI: ${p.ci})` }))
    setPacienteResults([])
    setPacienteSearch('')
    setFormError(null)
  }

  // --- Handlers Acciones ---
  const handleExportar = async () => {
    try {
      const response = await api.get('consentimientos/exportar/', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `consentimientos_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
    } catch (err) {
      alert('Error al exportar CSV')
    }
  }

  const handleRevocar = async (id: number) => {
    if (!window.confirm('¿Está seguro de revocar este consentimiento?')) return
    try {
      await api.post(`consentimientos/${id}/revocar/`)
      fetchConsentimientos()
    } catch (err) {
      alert('Error al revocar')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
    try {
      // Formatear fecha para el backend (asegurar ISO o null)
      let vigencia = null
      if (formData.vigente_hasta) {
        vigencia = new Date(formData.vigente_hasta).toISOString()
      }

      const payload = {
        paciente: formData.paciente_id,
        tipo: Number(formData.tipo_id),
        estado: formData.estado,
        vigente_hasta: vigencia,
        testigo_nombre: formData.testigo_nombre,
        observaciones: formData.observaciones
      }
      
      await api.post('consentimientos/', payload)
      setShowModal(false)
      resetForm()
      fetchConsentimientos()
    } catch (err: any) {
      const { general, fields } = parseDrfErrorResponse(err.response?.data)
      if (fields && Object.keys(fields).length > 0) {
        const firstField = Object.keys(fields)[0]
        setFormError(`${firstField}: ${fields[firstField]}`)
      } else {
        setFormError(general[0] || 'Error al registrar. Verifique si ya existe un consentimiento activo para este paciente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      paciente_id: null,
      paciente_nombre: '',
      tipo_id: '',
      estado: 'OTORGADO',
      vigente_hasta: '',
      testigo_nombre: '',
      observaciones: ''
    })
    setPacienteSearch('')
    setPacienteResults([])
    setFormError(null)
  }

  return (
    <div style={{ padding: '24px', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#122268', margin: 0 }}>Consentimientos Informados</h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginTop: '4px' }}>Gestión de documentos legales y autorizaciones.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleExportar}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#fff', border: '1px solid #B3D4FF', color: '#1D4ED8',
              padding: '10px 16px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            <Download size={18} /> Exportar CSV
          </button>
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
        <button onClick={() => fetchConsentimientos()} style={{ padding: '10px', background: '#F0F6FF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
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
            {items.map(item => {
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
                  <td style={{ padding: '14px 16px' }}>
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
        {items.length === 0 && !loading && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <FileText size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>No se encontraron registros de consentimiento.</p>
          </div>
        )}
      </div>

      {/* MODAL DE CREACIÓN - FACILIDADES DE USO */}
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

              {/* Búsqueda de Paciente (Live Search) */}
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
                        placeholder="Escriba apellido o CI para buscar..."
                        style={{ width: '100%', padding: '12px 40px 12px 16px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', outline: 'none' }}
                        autoFocus
                      />
                      <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}>
                        {searchingPaciente ? <RefreshCw size={18} className="spin" /> : <Search size={18}/>}
                      </div>
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
                            <div style={{ fontSize: '11px', color: '#64748B' }}>Documento: {p.ci} {p.ci_complemento}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tipo y Estado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#122268', marginBottom: '8px' }}>TIPO DE CONSENTIMIENTO</label>
                  <select 
                    value={formData.tipo_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo_id: e.target.value }))}
                    style={{ width: '100%', padding: '12px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', background: 'white', outline: 'none' }}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#122268', marginBottom: '8px' }}>ESTADO INICIAL</label>
                  <select 
                    value={formData.estado}
                    onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                    style={{ width: '100%', padding: '12px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', background: 'white', outline: 'none' }}
                  >
                    <option value="OTORGADO">OTORGADO</option>
                    <option value="RECHAZADO">RECHAZADO</option>
                  </select>
                </div>
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
                    placeholder={tipos.find(t => t.id === Number(formData.tipo_id))?.requiere_testigo ? "OBLIGATORIO" : "Opcional..."}
                    style={{ 
                      width: '100%', padding: '12px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', outline: 'none',
                      borderColor: (tipos.find(t => t.id === Number(formData.tipo_id))?.requiere_testigo && !formData.testigo_nombre) ? '#FCA5A5' : '#E2E8F0'
                    }}
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#122268', marginBottom: '8px' }}>OBSERVACIONES ADICIONALES</label>
                <textarea 
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Detalles sobre el proceso de firma..."
                  style={{ width: '100%', padding: '12px', border: '2px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', minHeight: '100px', resize: 'vertical', outline: 'none' }}
                />
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '14px', background: '#F1F5F9', color: '#122268', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  CANCELAR
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 2, padding: '14px', background: '#00A896', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0,168,150,0.3)', transition: 'all 0.2s', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'PROCESANDO...' : 'REGISTRAR CONSENTIMIENTO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        form input:focus, form select:focus, form textarea:focus { border-color: #1D4ED8 !important; }
        button:active { transform: scale(0.98); }
      `}</style>
    </div>
  )
}
