import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Play, CheckCircle, SkipForward, RefreshCw, XCircle, AlertTriangle } from 'lucide-react'
import { api } from '../api/axiosConfig'
import { fichaService } from '../services/fichaService'
import { parseDrfErrorResponse } from '../services/pacienteService'
import type { Paciente } from '../types/paciente.types'
import type { FichaBrief } from '../types/triaje.types'
import { hasRole } from '../utils/auth'

// --- Estilos y Constantes ---

const COLORS = {
  primary: '#0080FF',
  secondary: '#0003B8',
  success: '#00A896',
  danger: '#DC2626',
  warning: '#EA580C',
  info: '#1D4ED8',
  bg: '#F0F6FF',
  surface: '#FFFFFF',
  border: '#B3D4FF',
  text: '#1E293B',
  textMuted: '#64748B',
  rowHover: '#F1F5F9',
  rowSelected: '#DBEAFE',
}

const ESTADO_META: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  ABIERTA: { label: 'Esperando', bg: '#DBEAFE', text: '#1D4ED8', icon: <RefreshCw size={14} /> },
  EN_TRIAJE: { label: 'En Triaje', bg: '#FEF3C7', text: '#B45309', icon: <AlertTriangle size={14} /> },
  EN_ATENCION: { label: 'En Atención', bg: '#DCFCE7', text: '#15803D', icon: <Play size={14} /> },
  CERRADA: { label: 'Finalizado', bg: '#F1F5F9', text: '#64748B', icon: <CheckCircle size={14} /> },
  CANCELADA: { label: 'Cancelada', bg: '#FEE2E2', text: '#DC2626', icon: <XCircle size={14} /> },
}

function toIsoDay(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// --- Componente Principal ---

export default function AperturaFichaColaDia() {
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Permisos
  const esMedico = useMemo(() => hasRole('Médico', 'Director'), [])
  
  const hoyIso = useMemo(() => toIsoDay(new Date()), [])

  // Estados
  const [loading, setLoading] = useState(false)
  const [fichas, setFichas] = useState<FichaBrief[]>([])
  const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null)
  
  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Paciente[]>([])
  
  // Feedback
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ fichaId: number; nextState: string } | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // --- Lógica de Datos ---

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const cargarColaDia = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fichaService.listar({
        fecha_desde: hoyIso,
        fecha_hasta: hoyIso,
        page_size: 100,
      })
      setFichas(res.data.results ?? [])
    } catch {
      showToast('No se pudo cargar la cola de atención.', 'error')
    } finally {
      setLoading(false)
    }
  }, [hoyIso, showToast])

  useEffect(() => {
    void cargarColaDia()
  }, [cargarColaDia])

  // --- Handlers ---

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await api.get<{ results: Paciente[] }>('pacientes/pacientes/', {
        params: { search: q, page_size: 5 },
      })
      setSearchResults(res.data.results ?? [])
      if (res.data.results.length === 0) showToast('No se encontraron pacientes.', 'info')
    } catch {
      showToast('Error al buscar pacientes.', 'error')
    } finally {
      setSearching(false)
    }
  }

  const handleAbrirFicha = async (pacienteId: number) => {
    // Verificar si ya tiene ficha hoy
    const yaTiene = fichas.find(f => f.paciente.id === pacienteId && f.estado !== 'CANCELADA')
    if (yaTiene) {
      showToast(`${yaTiene.paciente.nombre_completo} ya tiene una ficha abierta hoy.`, 'info')
      setSelectedFichaId(yaTiene.id)
      return
    }

    setLoading(true)
    try {
      const res = await fichaService.crear(pacienteId)
      showToast(`Ficha ${res.data.correlativo} abierta correctamente.`, 'success')
      await cargarColaDia()
      setSearchQuery('')
      setSearchResults([])
    } catch (err: any) {
      const { general } = parseDrfErrorResponse(err.response?.data)
      showToast(general[0] || 'Error al abrir ficha.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCambiarEstado = async (fichaId: number, nextState: string, bypassConfirm = false) => {
    if (nextState === 'CERRADA' && !bypassConfirm && !dontAskAgain) {
      setConfirmModal({ fichaId, nextState })
      return
    }

    setLoading(true)
    try {
      await fichaService.cambiarEstado(fichaId, nextState)
      showToast(`Estado actualizado correctamente.`, 'success')
      await cargarColaDia()
    } catch (err: any) {
      const { general } = parseDrfErrorResponse(err.response?.data)
      showToast(general[0] || 'No se pudo cambiar el estado.', 'error')
    } finally {
      setLoading(false)
      setConfirmModal(null)
    }
  }

  const handleSiguientePaciente = async () => {
    const siguiente = fichas.find(f => f.estado === 'ABIERTA' || f.estado === 'EN_TRIAJE')
    if (!siguiente) {
      showToast('No hay pacientes esperando en la cola.', 'info')
      return
    }
    await handleCambiarEstado(siguiente.id, 'EN_ATENCION')
  }

  // --- Atajos de Teclado ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + B: Buscar
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // F2/F3: Iniciar/Finalizar sobre seleccionado
      if (selectedFichaId) {
        const ficha = fichas.find(f => f.id === selectedFichaId)
        if (!ficha) return

        if (e.key === 'F2' && (ficha.estado === 'ABIERTA' || ficha.estado === 'EN_TRIAJE')) {
          e.preventDefault()
          void handleCambiarEstado(ficha.id, 'EN_ATENCION')
        }
        if (e.key === 'F3' && ficha.estado === 'EN_ATENCION') {
          e.preventDefault()
          void handleCambiarEstado(ficha.id, 'CERRADA')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFichaId, fichas])

  // --- Render Helpers ---

  const renderRow = (ficha: FichaBrief) => {
    const isSelected = selectedFichaId === ficha.id
    const meta = ESTADO_META[ficha.estado] || { label: ficha.estado, bg: '#eee', text: '#333', icon: null }

    const onDoubleClick = () => {
      if (!esMedico) return
      if (ficha.estado === 'ABIERTA' || ficha.estado === 'EN_TRIAJE') {
        void handleCambiarEstado(ficha.id, 'EN_ATENCION')
      } else if (ficha.estado === 'EN_ATENCION') {
        void handleCambiarEstado(ficha.id, 'CERRADA')
      }
    }

    return (
      <tr 
        key={ficha.id}
        onClick={() => setSelectedFichaId(ficha.id)}
        onDoubleClick={onDoubleClick}
        style={{ 
          background: isSelected ? COLORS.rowSelected : 'transparent',
          cursor: 'pointer',
          transition: 'background 0.2s',
          borderBottom: '1px solid #F1F5F9'
        }}
        className="cola-row"
      >
        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: COLORS.info }}>{ficha.correlativo}</td>
        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{ficha.paciente.nombre_completo}</td>
        <td style={{ padding: '12px 16px', fontSize: '13px', color: COLORS.textMuted }}>{ficha.paciente.ci}</td>
        <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS.textMuted }}>
          {new Date(ficha.fecha_apertura).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            background: meta.bg, 
            color: meta.text, 
            fontSize: '11px', 
            fontWeight: 700, 
            padding: '4px 10px', 
            borderRadius: '12px' 
          }}>
            {meta.icon}
            {meta.label}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: toast.type === 'error' ? COLORS.danger : toast.type === 'success' ? COLORS.success : COLORS.info,
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: COLORS.secondary, margin: 0 }}>Gestión de Cola Diaria</h1>
          <p style={{ color: COLORS.textMuted, fontSize: '14px', marginTop: '4px' }}>Control de flujo de pacientes y apertura de fichas.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => void cargarColaDia()}
            style={{ 
              background: 'white', border: `1.5px solid ${COLORS.border}`, color: COLORS.info,
              padding: '10px', borderRadius: '10px', cursor: 'pointer'
            }}
            title="Refrescar cola (F5)"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Botón Flotante Siguiente Paciente */}
      <button 
        onClick={handleSiguientePaciente}
        disabled={loading}
        title="Asignar siguiente paciente en espera (Alt + S)"
        style={{ 
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '10px',
          backgroundColor: COLORS.success, color: 'white',
          padding: '14px 24px', borderRadius: '50px', fontWeight: 800,
          boxShadow: '0 6px 20px rgba(0, 168, 150, 0.3)',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }}
      >
        <SkipForward size={20} /> 
        <span style={{ fontSize: '15px' }}>Siguiente Paciente</span>
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        
        {/* Panel Izquierdo: Cola */}
        <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${COLORS.border}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: '#F8FAFC', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, color: COLORS.text }}>PACIENTES EN COLA</span>
            <span style={{ fontSize: '12px', color: COLORS.textMuted }}>Doble clic para cambiar estado</span>
          </div>
          <div style={{ minHeight: '400px' }}>
            {fichas.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: COLORS.textMuted }}>
                <RefreshCw size={40} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p>No hay pacientes registrados hoy.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: COLORS.textMuted }}>FICHA</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: COLORS.textMuted }}>PACIENTE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: COLORS.textMuted }}>DOCUMENTO</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: COLORS.textMuted }}>HORA</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: COLORS.textMuted }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {fichas.map(renderRow)}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel Derecho: Búsqueda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>Apertura de Ficha</h3>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, marginBottom: '16px' }}>Busque al paciente para iniciar su atención.</p>
            
            <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: '16px' }}>
              <input 
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="CI o Apellido... (Ctrl+B)"
                style={{ width: '100%', padding: '12px 40px 12px 12px', border: `2px solid ${COLORS.border}`, borderRadius: '10px', fontSize: '14px' }}
              />
              <Search 
                size={18} 
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted, cursor: 'pointer' }}
                onClick={() => void handleSearch()}
              />
            </form>

            <button 
              onClick={() => navigate('/pacientes/registro')}
              style={{ 
                width: '100%', padding: '10px', background: 'transparent', border: `1.5px dashed ${COLORS.border}`, 
                borderRadius: '10px', color: COLORS.info, fontWeight: 700, fontSize: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <UserPlus size={16} /> Nuevo Paciente
            </button>
          </div>

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, marginLeft: '8px', marginBottom: '8px' }}>RESULTADOS (Doble clic p/ abrir ficha)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map(p => (
                  <div 
                    key={p.id} 
                    onDoubleClick={() => void handleAbrirFicha(p.id)}
                    style={{ 
                      padding: '10px 14px', borderRadius: '10px', border: '1px solid #F1F5F9', 
                      background: '#F8FAFC', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    className="search-result-item"
                  >
                    <p style={{ fontWeight: 700, fontSize: '13px', margin: 0 }}>{p.nombre} {p.apellido}</p>
                    <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: 0 }}>CI: {p.ci}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Confirmación Finalizar */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '20px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>¿Finalizar atención?</h3>
            <p style={{ fontSize: '14px', color: COLORS.textMuted, lineHeight: 1.5 }}>
              Esta acción marcará al paciente como atendido y cerrará su ficha del día actual.
            </p>
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="dontAsk" 
                checked={dontAskAgain} 
                onChange={(e) => setDontAskAgain(e.target.checked)} 
              />
              <label htmlFor="dontAsk" style={{ fontSize: '13px', cursor: 'pointer' }}>No volver a preguntar hoy</label>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setConfirmModal(null)}
                style={{ flex: 1, padding: '12px', background: '#F1F5F9', color: COLORS.text, border: 'none', borderRadius: '10px', fontWeight: 700 }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleCambiarEstado(confirmModal.fichaId, confirmModal.nextState, true)}
                style={{ flex: 1, padding: '12px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700 }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos locales para animaciones */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .cola-row:hover { background-color: ${COLORS.rowHover} !important; }
        .search-result-item:hover { 
          border-color: ${COLORS.primary} !important; 
          background-color: white !important;
          box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        button:active { transform: scale(0.98); }
        button:disabled { opacity: 0.5; cursor: not-allowed !important; }
      `}</style>
    </div>
  )
}
