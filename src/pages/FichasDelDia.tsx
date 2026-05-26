import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { hasRole } from '../utils/auth';
import { fichaService } from '../services/fichaService';
import { fetchEspecialidades } from '../services/especialidadService';
import type { Especialidad } from '../services/especialidadService';
import type { FichaBrief, NivelUrgencia } from '../types/triaje.types';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertError from '../components/AlertError';
import ConfirmModal from '../components/ConfirmModal';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

const BOLIVIA_TZ = 'America/La_Paz';

// Estados Meta (Colors from prompt)
const ESTADO_META: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  PENDIENTE:     { label: 'Pendiente',     bg: '#F59E0B', text: '#fff', icon: '⏳' },
  EN_ATENCION:   { label: 'En atención',   bg: '#3B82F6', text: '#fff', icon: '👨‍⚕️' },
  EN_ENFERMERIA: { label: 'Enfermería',    bg: '#06B6D4', text: '#fff', icon: '💉' },
  EN_LABORATORIO:{ label: 'Laboratorio',   bg: '#8B5CF6', text: '#fff', icon: '🔬' },
  FINALIZADO:    { label: 'Finalizado',    bg: '#10B981', text: '#fff', icon: '✅' },
  CANCELADO:     { label: 'Cancelado',     bg: '#6B7280', text: '#fff', icon: '❌' },
  DERIVADO:      { label: 'Derivado',      bg: '#F97316', text: '#fff', icon: '🚑' },
};

// Urgencia Meta
const URGENCIA_META: Record<string, { label: string; bar: string; bg: string; icon: string }> = {
  ALTA:    { label: 'Alta',    bar: '#EF4444', bg: '#FEE2E2', icon: '🚨' },
  MEDIA:   { label: 'Media',   bar: '#F97316', bg: '#FFEDD5', icon: '⚠️' },
  BAJA:    { label: 'Baja',    bar: '#22C55E', bg: '#DCFCE7', icon: '✅' },
  NINGUNA: { label: '📋',     bar: '#9CA3AF', bg: '#F3F4F6', icon: '📋' },
};

function mapNivelToMeta(nivel?: NivelUrgencia) {
  if (!nivel) return URGENCIA_META.NINGUNA;
  if (nivel === 'ROJO' || nivel === 'NARANJA') return URGENCIA_META.ALTA;
  if (nivel === 'AMARILLO') return URGENCIA_META.MEDIA;
  return URGENCIA_META.BAJA;
}

export default function FichasDelDia() {
  const [fichas, setFichas] = useState<FichaBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(dayjs().format('YYYY-MM-DD'));
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  
  // Modals
  const [confirmCancel, setConfirmCancel] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [derivarModal, setDerivarModal] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [selectedEspecialidad, setSelectedEspecialidad] = useState<number>(0);

  const fetchFichas = useCallback(async (silently = false) => {
    if (!silently) setLoading(true);
    try {
      const res = await fichaService.listar({
        fecha_desde: fecha,
        fecha_hasta: fecha,
        page_size: 100,
      });
      setFichas(res.data.results || []);
      setError(null);
    } catch (err) {
      console.error(err);
      if (!silently) setError('Error al cargar las fichas del día.');
    } finally {
      if (!silently) setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    fetchFichas();
    const interval = setInterval(() => fetchFichas(true), 30000);
    return () => clearInterval(interval);
  }, [fetchFichas]);

  useEffect(() => {
    fetchEspecialidades().then(setEspecialidades).catch(console.error);
  }, []);

  const handleEstadoChange = async (fichaId: number, nuevoEstado: string) => {
    try {
      await fichaService.cambiarEstado(fichaId, nuevoEstado);
      await fetchFichas(true);
    } catch (err) {
      console.error(err);
      alert('Error al cambiar el estado de la ficha.');
    }
  };

  const handleDerivar = async () => {
    if (!selectedEspecialidad) return;
    try {
      await fichaService.derivar(derivarModal.id, selectedEspecialidad);
      setDerivarModal({ id: 0, open: false });
      await fetchFichas(true);
    } catch (err) {
      console.error(err);
      alert('Error al derivar la ficha.');
    }
  };

  const handleCancelFicha = async () => {
    try {
      await fichaService.cambiarEstado(confirmCancel.id, 'CANCELADO');
      setConfirmCancel({ id: 0, open: false });
      await fetchFichas(true);
    } catch (err) {
      console.error(err);
      alert('Error al cancelar la ficha.');
    }
  };

  const getWaitTime = (apertura: string) => {
    const start = dayjs.utc(apertura);
    const now = dayjs().utc();
    const diff = now.diff(start, 'minute');
    return diff > 0 ? diff : 0;
  };

  const currentBoliviaTime = dayjs().tz(BOLIVIA_TZ).format('HH:mm');

  return (
    <div style={{
      maxWidth: '500px',
      margin: '0 auto',
      background: '#F0F6FF',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Segoe UI', sans-serif"
    }}>
      {/* AppBar */}
      <div style={{
        background: '#122268',
        color: 'white',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Fichas del día</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '12px', opacity: 0.8 }}>Bolivia: {currentBoliviaTime}</span>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>
              {fichas.length} total
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input 
            type="date" 
            value={fecha} 
            onChange={(e) => setFecha(e.target.value)}
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              color: 'white', 
              padding: '6px 10px', 
              borderRadius: '6px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Pull to refresh indicator simulation */}
      {loading && !fichas.length && <div style={{ padding: '40px', textAlign: 'center' }}><LoadingSpinner /></div>}

      {/* List */}
      <div style={{ padding: '16px', flex: 1 }}>
        {error && <AlertError message={error} />}
        
        {!loading && fichas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <p style={{ fontWeight: 600 }}>No hay fichas para el día seleccionado.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fichas.map(ficha => {
              const metaEstado = ESTADO_META[ficha.estado] || { label: ficha.estado, bg: '#E2E8F0', text: '#475569', icon: '📋' };
              const metaUrgencia = mapNivelToMeta(ficha.triaje_resumen?.nivel_urgencia);
              const initials = ficha.paciente.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

              return (
                <div key={ficha.id} style={{
                  background: metaUrgencia.bg,
                  borderRadius: '12px',
                  display: 'flex',
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0,3,184,0.04)',
                  border: '1px solid rgba(0,3,184,0.05)',
                  position: 'relative'
                }}>
                  {/* Urgencia Bar */}
                  <div style={{ width: '6px', background: metaUrgencia.bar, flexShrink: 0 }} />

                  {/* Content */}
                  <div style={{ padding: '16px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{
                        background: metaEstado.bg,
                        color: metaEstado.text,
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{metaEstado.icon}</span> {metaEstado.label}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                        Ficha #{ficha.correlativo}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#122268',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ficha.paciente.nombre_completo}
                        </h3>
                        <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>CI: {ficha.paciente.ci}</p>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#475569', background: 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        🕒 {dayjs.utc(ficha.fecha_apertura).tz(BOLIVIA_TZ).format('HH:mm')}
                      </div>
                      <div style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: 600, background: 'rgba(59,130,246,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                        Espera: {getWaitTime(ficha.fecha_apertura)} min
                      </div>
                      {ficha.triaje_resumen && (
                        <div style={{ fontSize: '11px', color: metaUrgencia.bar, fontWeight: 700, background: 'rgba(255,255,255,0.6)', padding: '4px 8px', borderRadius: '6px', border: `1px solid ${metaUrgencia.bar}22` }}>
                          {metaUrgencia.icon} {metaUrgencia.label}
                        </div>
                      )}
                    </div>

                    {ficha.triaje_resumen?.motivo_consulta_triaje && (
                      <p style={{ 
                        fontSize: '12px', 
                        color: '#475569', 
                        margin: '10px 0 0',
                        fontStyle: 'italic',
                        background: 'rgba(255,255,255,0.4)',
                        padding: '8px',
                        borderRadius: '6px'
                      }}>
                        "{ficha.triaje_resumen.motivo_consulta_triaje.slice(0, 60)}{ficha.triaje_resumen.motivo_consulta_triaje.length > 60 ? '...' : ''}"
                      </p>
                    )}

                    {/* Quick Actions */}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {ficha.estado === 'PENDIENTE' && hasRole('Médico') && (
                        <button 
                          onClick={() => handleEstadoChange(ficha.id, 'EN_ATENCION')}
                          style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Iniciar atención
                        </button>
                      )}
                      {ficha.estado === 'EN_ATENCION' && (
                        <button 
                          onClick={() => handleEstadoChange(ficha.id, 'FINALIZADO')}
                          style={{ background: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Completar
                        </button>
                      )}
                      {(ficha.estado === 'PENDIENTE' || ficha.estado === 'EN_ATENCION') && (
                         <button 
                          onClick={() => setDerivarModal({ id: ficha.id, open: true })}
                          style={{ background: '#F97316', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Derivar
                        </button>
                      )}
                      {ficha.estado !== 'CANCELADO' && ficha.estado !== 'FINALIZADO' && (
                        <button 
                          onClick={() => setConfirmCancel({ id: ficha.id, open: true })}
                          style={{ background: 'transparent', color: '#EF4444', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB Simulation */}
      <button 
        onClick={() => fetchFichas()}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          background: '#122268',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 200
        }}
      >
        ↻
      </button>

      {/* Modals */}
      <ConfirmModal 
        open={confirmCancel.open}
        title="Cancelar Atención"
        message="¿Estás seguro de que deseas cancelar esta ficha? Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        onConfirm={handleCancelFicha}
        onCancel={() => setConfirmCancel({ id: 0, open: false })}
      />

      {derivarModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Derivar Ficha</h2>
            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '16px' }}>Selecciona la especialidad a la que deseas derivar al paciente:</p>
            <select 
              value={selectedEspecialidad}
              onChange={(e) => setSelectedEspecialidad(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '20px' }}
            >
              <option value={0}>Seleccionar especialidad...</option>
              {especialidades.map(esp => (
                <option key={esp.id} value={esp.id}>{esp.nombre}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDerivarModal({ id: 0, open: false })} style={{ padding: '8px 16px', background: '#F1F5F9', border: 'none', borderRadius: '8px' }}>Cancelar</button>
              <button 
                onClick={handleDerivar} 
                disabled={!selectedEspecialidad}
                style={{ padding: '8px 16px', background: '#00A896', color: 'white', border: 'none', borderRadius: '8px', opacity: selectedEspecialidad ? 1 : 0.5 }}
              >
                Derivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
