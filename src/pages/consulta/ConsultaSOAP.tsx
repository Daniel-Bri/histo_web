import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  consultaService
} from '../../services/consultaService';
import { fichaService } from '../../services/fichaService';
import type {
  ConsultaMedica,
  DiagnosticoCIE10,
  FichaQueue
} from '../../services/consultaService';
import { api } from '../../api/axiosConfig'; // Usar configuración global
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Shield, Save, FileCheck, Info } from 'lucide-react';

import EstadoBadge from '../../components/consulta/EstadoBadge';
import FirmaModal from '../../components/consulta/FirmaModal';
import HashAuditoriaSection from '../../components/consulta/HashAuditoriaSection';

// --- Estilos de la Imagen (HU013) ---
const sectionBox = (color: string): React.CSSProperties => ({
  background: 'white',
  borderRadius: '12px',
  padding: '18px',
  border: `1px solid ${color}33`,
  borderTop: `4px solid ${color}`,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.2s ease'
});

const labelStyle = (color: string): React.CSSProperties => ({
  fontSize: '16px',
  fontWeight: 700,
  color: color,
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  paddingBottom: '4px',
  width: 'fit-content'
});

const triajeGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '10px',
  background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
  padding: '14px',
  borderRadius: '10px',
  marginBottom: '14px',
  fontSize: '13px',
  color: '#1E40AF',
  border: '1px solid #BFDBFE',
  boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)'
};

const headerBox: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1E40AF 0%, #3B82F6 100%)',
  padding: '20px 24px',
  borderRadius: '12px',
  marginBottom: '24px',
  color: 'white',
  boxShadow: '0 4px 12px rgba(30, 64, 175, 0.2)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  height: '100px',
  border: '1.5px solid #E2E8F0',
  borderRadius: '8px',
  padding: '12px',
  fontSize: '14px',
  lineHeight: '1.5',
  color: '#334155',
  outline: 'none',
  transition: 'border-color 0.2s',
  backgroundColor: '#FCFDFF'
};

const actionBtn = (bg: string): React.CSSProperties => ({
  background: bg,
  color: 'white',
  padding: '10px 24px',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '14px',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
});

const btnToggle = (active: boolean, color: string, bg: string): React.CSSProperties => ({
  background: active ? color : bg,
  color: active ? 'white' : color,
  padding: '10px 18px',
  borderRadius: '8px',
  border: `1.5px solid ${color}`,
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'all 0.2s',
});



export default function ConsultaSOAP() {
  const { id, fichaId } = useParams<{ id?: string; fichaId?: string }>();
  const routeFichaId = fichaId ?? null;   // /consulta/ficha/:fichaId
  const routeConsultaId = fichaId ? null : id ?? null;  // /consulta/:id
  const navigate = useNavigate();
  useAuth();
  
  const [consulta, setConsulta] = useState<ConsultaMedica | null>(null);
  const [triajeData, setTriajeData] = useState<any>(null);
  const [queue, setQueue] = useState<FichaQueue[]>([]);
  const [historial, setHistorial] = useState<ConsultaMedica[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const [searchTerm, setSearchTerm] = useState('');
  const [cieResults, setCieResults] = useState<DiagnosticoCIE10[]>([]);
  const [, setSearchingCie] = useState(false);

  // Estados para Firma Digital
  const [isFirmaModalOpen, setIsFirmaModalOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);


  const isEditable = consulta?.estado === 'BORRADOR';
  const isCompletada = consulta?.estado === 'COMPLETADA';
  const isFirmada = consulta?.estado === 'FIRMADA';
  const isReadOnly = isCompletada || isFirmada;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ── Panel principal (sin ID) ──────────────────────────────────────────
      if (!routeFichaId && !routeConsultaId) {
        const [queueRes, historyRes] = await Promise.all([
          consultaService.getQueue().catch(() => ({ data: { results: [] as FichaQueue[] } })),
          consultaService.getAll().catch(() => ({ data: { results: [] as ConsultaMedica[] } }))
        ]);
        setQueue(queueRes.data.results || []);
        const raw = historyRes.data as any;
        setHistorial(Array.isArray(raw) ? raw : (raw.results || []));
        return;
      }

      let consultaData: ConsultaMedica | null = null;

      if (routeFichaId) {
        // ── Ruta /consulta/ficha/:fichaId — siempre busca por ficha ──────────
        const fichaNum = Number(routeFichaId);
        const existing = await consultaService.getByFicha(fichaNum);
        const results = existing.data.results ?? [];
        if (results.length > 0) {
          consultaData = results.find(c => c.estado === 'BORRADOR') ?? results[0];
        } else {
          const created = await consultaService.create(fichaNum);
          consultaData = created.data;
        }
      } else {
        // ── Ruta /consulta/:id — siempre es ID de consulta ───────────────────
        const res = await consultaService.getById(Number(routeConsultaId));
        consultaData = res.data;
      }

      setConsulta(consultaData);

      if (consultaData?.triaje) {
        try {
          const tRes = await api.get(`triaje/${consultaData.triaje}/`);
          setTriajeData(tRes.data);
        } catch { /* triaje opcional */ }
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar datos del servidor.');
    } finally {
      setLoading(false);
    }
  }, [routeFichaId, routeConsultaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 0) {
        setSearchingCie(true);
        try {
          const res = await consultaService.searchCIE10(searchTerm);
          setCieResults(res.data);
        } catch (err) {
          // Si el backend da 404 o error, usamos el mock local sin mostrar error en consola
          const mockResults: DiagnosticoCIE10[] = [
            { codigo: 'A00', descripcion: 'Cólera' },
            { codigo: 'E11.9', descripcion: 'Diabetes Mellitus tipo 2' },
            { codigo: 'I10', descripcion: 'Hipertensión esencial' },
            { codigo: 'J18.9', descripcion: 'Neumonía' },
            { codigo: 'K29.0', descripcion: 'Gastritis aguda' },
            { codigo: 'N39.0', descripcion: 'Infección urinaria' },
          ].filter(x => 
            x.codigo.includes(searchTerm.toUpperCase()) || 
            x.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
          );
          setCieResults(mockResults);
        } finally {
          setSearchingCie(false);
        }
      } else { setCieResults([]); }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleUpdateField = (field: keyof ConsultaMedica, value: any) => {
    if (!consulta || isReadOnly) return;
    setConsulta(prev => prev ? { ...prev, [field]: value } : null);
    setIsDirty(true);
  };

  const handleSave = async (silent = false) => {
    if (!consulta || saving || isReadOnly) return;
    try {
      if (!silent) setSaving(true);
      await consultaService.update(consulta.id, consulta);
      setIsDirty(false);
      if (!silent) alert('Borrador guardado exitosamente.');
    } catch { if (!silent) alert('Error al guardar.'); }
    finally { if (!silent) setSaving(false); }
  };

  // Mantener ref actualizada para el atajo de teclado
  useEffect(() => { saveRef.current = handleSave });

  // Ctrl+S → guardar borrador
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditable && !saving) void saveRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditable, saving]);

  // Advertir al salir si hay cambios sin guardar
  useEffect(() => {
    if (!isDirty || !isEditable) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, isEditable]);

  const handleFirmar = async () => {
    if (!consulta || isSigning || isFirmada) return;
    try {
      setIsSigning(true);
      const res = await consultaService.firmar(consulta.id);
      setConsulta(res.data);
      alert('Consulta firmada digitalmente con éxito.');
      setIsFirmaModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.response?.data?.detail ?? 'Error al firmar la consulta.';
      alert(msg);
    } finally {
      setIsSigning(false);
    }
  };

  const handleCompletar = async () => {
    if (!consulta || isReadOnly) return;
    const camposVacios: string[] = [];
    if (!consulta.motivo_consulta?.trim()) camposVacios.push('Motivo de consulta');
    if (!consulta.historia_enfermedad_actual?.trim()) camposVacios.push('Historia de la enfermedad actual');
    if (!consulta.impresion_diagnostica?.trim()) camposVacios.push('Impresión diagnóstica');
    if (!consulta.codigo_cie10_principal?.trim()) camposVacios.push('Código CIE-10 principal');
    if (camposVacios.length > 0) {
      alert(`Completa los siguientes campos obligatorios antes de finalizar:\n\n• ${camposVacios.join('\n• ')}`);
      return;
    }
    if (!window.confirm('¿Finalizar la consulta? Podrás firmarla digitalmente a continuación.')) return;
    try {
      setSaving(true);
      // Primero guarda el borrador con los datos actuales
      await consultaService.update(consulta.id, consulta);
      // Luego usa el endpoint completar (valida campos obligatorios en el backend)
      const res = await consultaService.completar(consulta.id);
      setConsulta(res.data);
      setIsDirty(false);
    } catch (err: any) {
      const campos = err.response?.data?.campos;
      if (campos) {
        alert(`Faltan campos obligatorios: ${campos.join(', ')}`);
      } else {
        alert(err.response?.data?.error ?? 'Error al finalizar la consulta.');
      }
    } finally {
      setSaving(false);
    }
  };


  if (loading) return <LoadingSpinner />;

  if (!routeFichaId && !routeConsultaId) {
    return (
      <div style={{ padding: '30px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Gestión de Consultas — SOAP</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Columna: Cola de Atención */}
          <div style={sectionBox('#3B82F6')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={labelStyle('#1D4ED8')}>🕒 Pacientes en Espera</h2>
              <button
                onClick={() => fetchData()}
                style={{ background: '#F0F6FF', color: '#0003B8', border: '1px solid #B3D4FF', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                🔄 Actualizar
              </button>
            </div>

            {queue.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                No hay fichas activas en este momento.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {queue.map(f => (
                  <div key={f.id} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1E293B' }}>{f.paciente.nombre_completo}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        Ficha: {f.correlativo} · CI: {f.paciente.ci}
                        {f.estado === 'ABIERTA' && <span style={{ color: '#F59E0B', fontWeight: 600 }}> · Pendiente triaje</span>}
                        {f.estado === 'EN_TRIAJE' && <span style={{ color: '#10B981', fontWeight: 600 }}> · Triaje completo</span>}
                        {f.estado === 'EN_ATENCION' && <span style={{ color: '#3B82F6', fontWeight: 600 }}> · En atención</span>}
                      </div>
                    </div>
                    {f.estado === 'ABIERTA' && (
                      <button
                        onClick={() => navigate(`/urgencias/${f.id}/triaje`)}
                        style={actionBtn('#F59E0B')}
                      >
                        Ir a triaje
                      </button>
                    )}
                    {(f.estado === 'EN_TRIAJE' || f.estado === 'EN_ATENCION') && (
                      <button
                        onClick={async () => {
                          if (f.estado === 'EN_TRIAJE') {
                            await fichaService.cambiarEstado(f.id, 'EN_ATENCION').catch(() => {});
                          }
                          navigate(`/consulta/ficha/${f.id}`);
                        }}
                        style={actionBtn('#0EA5E9')}
                      >
                        Atender
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Columna: Historial de Consultas */}
          <div style={sectionBox('#10B981')}>
            <h2 style={labelStyle('#047857')}>📁 Panel de Consultas</h2>
            {historial.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                No hay consultas registradas aún.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {historial.map(c => (
                  <div
                    key={c.id}
                    style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div
                        style={{ fontWeight: 700, color: '#1E293B', cursor: 'pointer', flex: 1 }}
                        onClick={() => navigate(`/consulta/${c.id}`)}
                      >
                        {c.paciente_nombre}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <EstadoBadge
                          estado={c.estado}
                          firmadoPor={c.firmada_por_nombre}
                          fechaFirma={c.firmada_en}
                        />
                        {c.estado === 'BORRADOR' && (
                          <button
                            title="Eliminar borrador"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')) return;
                              try {
                                await consultaService.eliminar(c.id);
                                setHistorial(prev => prev.filter(x => x.id !== c.id));
                              } catch {
                                alert('No se pudo eliminar el borrador.');
                              }
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '16px', padding: '2px 4px', lineHeight: 1 }}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      style={{ fontSize: '12px', color: '#64748B', cursor: 'pointer' }}
                      onClick={() => navigate(`/consulta/${c.id}`)}
                    >
                      {c.codigo_cie10_principal || 'Sin Dx'} · {new Date(c.creado_en).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!consulta) return null;

  return (
    <div style={{ padding: '20px', background: '#F0F9FF', minHeight: '100vh' }}>
      
      {/* HEADER CON DEGRADADO AZUL */}
      <div style={headerBox}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/consulta')}
            style={{ 
              background: 'rgba(255,255,255,0.15)', 
              border: 'none', 
              color: 'white', 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}
            title="Volver al panel"
          >
            ←
          </button>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'white', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              Consulta Médica SOAP — {consulta.paciente_nombre}
            </h1>
            <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '14px', fontWeight: 500 }}>
              Ficha: #{consulta.ficha_correlativo} | Fecha: {new Date(consulta.creado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', opacity: 0.8 }}>Edad</span>
              <strong style={{ fontSize: '18px' }}>{consulta.paciente_edad ?? '--'}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', opacity: 0.8 }}>Sexo</span>
              <strong style={{ fontSize: '18px' }}>{consulta.paciente_genero || '--'}</strong>
            </div>
          </div>
          <EstadoBadge 
            estado={consulta.estado} 
            firmadoPor={consulta.firmada_por_nombre} 
            fechaFirma={consulta.firmada_en} 
          />
        </div>
      </div>

      {/* AVISO DE CONSULTA COMPLETADA (PENDIENTE FIRMA) */}
      {isCompletada && (
        <div style={{ 
          background: '#EFF6FF', 
          border: '1px solid #BFDBFE', 
          borderRadius: '12px', 
          padding: '16px 24px', 
          marginBottom: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#DBEAFE', padding: '10px', borderRadius: '50%' }}>
              <Info style={{ color: '#2563EB', width: '20px', height: '20px' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#1E40AF', fontSize: '14px' }}>Consulta Lista para Firma Digital</p>
              <p style={{ margin: 0, color: '#3B82F6', fontSize: '12px' }}>El registro ha sido finalizado. Proceda a firmar para sellar el documento permanentemente.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsFirmaModalOpen(true)}
            style={{ ...actionBtn('#2563EB'), padding: '12px 24px' }}
          >
            <Shield style={{ width: '20px', height: '20px' }} />
            Firmar Consulta Digitalmente
          </button>
        </div>
      )}

      {/* GRID PRINCIPAL 2 COLUMNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', minWidth: 0 }}>
        
        {/* COLUMNA IZQUIERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={sectionBox('#3B82F6')}>
            <h3 style={labelStyle('#1D4ED8')}>
              <span>📝</span> Subjetivo (S)
            </h3>
            <label style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Motivo de consulta <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              style={{ ...textareaStyle, height: '80px', marginBottom: '12px' }}
              value={consulta.motivo_consulta}
              onChange={e => handleUpdateField('motivo_consulta', e.target.value)}
              disabled={isReadOnly}
              placeholder="Motivo de consulta y síntomas principales..."
            />
            <label style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Historia de la enfermedad actual <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              style={{ ...textareaStyle, height: '100px' }}
              value={consulta.historia_enfermedad_actual}
              onChange={e => handleUpdateField('historia_enfermedad_actual', e.target.value)}
              disabled={isReadOnly}
              placeholder="Relato cronológico: inicio, evolución, síntomas asociados..."
            />
          </div>

          <div style={sectionBox('#10B981')}>
            <h3 style={labelStyle('#047857')}>
              <span>📊</span> Objetivo (O)
            </h3>
            {triajeData && (
              <div style={triajeGrid}>
                <div>FC: <strong style={{ color: '#111827' }}>{triajeData.frecuencia_cardiaca ?? '--'} lpm</strong></div>
                <div>PA: <strong style={{ color: '#111827' }}>{triajeData.presion_sistolica ?? '--'}/{triajeData.presion_diastolica ?? '--'} mmHg</strong></div>
                <div>T°: <strong style={{ color: '#111827' }}>{triajeData.temperatura_celsius ?? '--'} °C</strong></div>
                <div>SpO2: <strong style={{ color: '#111827' }}>{triajeData.saturacion_oxigeno ?? '--'} %</strong></div>
                <div>Resp: <strong style={{ color: '#111827' }}>{triajeData.frecuencia_respiratoria ?? '--'} rpm</strong></div>
                <div>Glasgow: <strong style={{ color: '#111827' }}>{triajeData.glasgow ?? '--'}/15</strong></div>
              </div>
            )}
            <textarea 
              style={{ ...textareaStyle, height: triajeData ? '120px' : '200px' }}
              value={consulta.examen_fisico}
              onChange={e => handleUpdateField('examen_fisico', e.target.value)}
              disabled={isReadOnly}
              placeholder="[Examen Físico - Notas Médicas]"
            />
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={sectionBox('#8B5CF6')}>
            <h3 style={labelStyle('#6D28D9')}>
              <span>🔬</span> Análisis/Diagnóstico (A)
            </h3>
            <textarea 
              style={{ ...textareaStyle, height: '80px', marginBottom: '15px' }}
              value={consulta.impresion_diagnostica}
              onChange={e => handleUpdateField('impresion_diagnostica', e.target.value)}
              disabled={isReadOnly}
              placeholder="Notas de evaluación inicial..."
            />
            
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '5px' }}>
                Buscador CIE-10 (Búsqueda por Texto o Código)
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  style={{ flex: 1, padding: '10px', border: '1.5px solid #8B5CF6', borderRadius: '6px' }}
                  placeholder="Ej: E11.9 o Diabetes"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  disabled={isReadOnly}
                />
                {consulta.codigo_cie10_principal && (
                  <span style={{ color: '#059669', fontSize: '13px', fontWeight: 700 }}>✓ Válido</span>
                )}
              </div>
              
              {cieResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', zIndex: 100, border: '1px solid #E2E8F0', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                  {cieResults.map(r => (
                    <div key={r.codigo} onClick={() => {
                      handleUpdateField('codigo_cie10_principal', r.codigo);
                      handleUpdateField('descripcion_cie10', r.descripcion);
                      setSearchTerm('');
                      setCieResults([]);
                    }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                      <strong>{r.codigo}</strong> - {r.descripcion}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {consulta.codigo_cie10_principal && (
              <div style={{ marginTop: '10px', padding: '10px', background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#5B21B6' }}><strong>{consulta.codigo_cie10_principal}</strong> - {consulta.descripcion_cie10}</span>
                {!isReadOnly && <span style={{ cursor: 'pointer', color: '#94A3B8' }} onClick={() => handleUpdateField('codigo_cie10_principal', '')}>✕</span>}
              </div>
            )}
          </div>
          
          <div style={sectionBox('#64748B')}>
            <h3 style={labelStyle('#334155')}><span>⚕️</span> Acciones Clínicas</h3>
            {isEditable && (
              <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                Finaliza la consulta para habilitar recetas y órdenes de estudio.
              </p>
            )}
            {isCompletada && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => navigate(`/recetas?consulta=${consulta.id}`)}
                  style={btnToggle(false, '#065F46', '#ECFDF5')}
                >
                  <span>💊</span> Emitir Receta
                </button>
                <button
                  onClick={() => navigate(`/estudios/solicitud?consulta=${consulta.id}`)}
                  style={btnToggle(false, '#1E40AF', '#EFF6FF')}
                >
                  <span>🔬</span> Solicitar Estudios
                </button>
              </div>
            )}
            {isFirmada && (
              <p style={{ margin: 0, fontSize: '13px', color: '#059669', fontWeight: 600 }}>
                ✅ Consulta sellada. Las acciones clínicas pueden gestionarse desde el historial.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN PLAN (P) - ANCHO COMPLETO */}
      <div style={sectionBox('#F59E0B')}>
        <h3 style={labelStyle('#B45309')}>
          <span>💊</span> Plan (P)
        </h3>
        <textarea 
          style={textareaStyle}
          value={consulta.plan_tratamiento}
          onChange={e => handleUpdateField('plan_tratamiento', e.target.value)}
          disabled={isReadOnly}
          placeholder="Indicaciones terapéuticas, medicación y plan de seguimiento..."
        />
      </div>

      {/* SECCIÓN DE HASH Y AUDITORÍA (Solo para FIRMADA) */}
      <HashAuditoriaSection 
        hash={consulta.hash_documento} 
        fechaFirma={consulta.firmada_en} 
      />

      <div style={{ height: '30px' }}></div>

      {/* BOTONES DE ACCIÓN - IDÉNTICOS A LA IMAGEN */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '30px', paddingBottom: '40px' }}>
        {isEditable && (
          <>
            <button onClick={() => handleSave()} disabled={saving} style={actionBtn('#334155')}>
              <Save style={{ width: '18px', height: '18px' }} /> Guardar Borrador
            </button>
            <button onClick={() => handleCompletar()} disabled={saving} style={actionBtn('#F59E0B')}>
               <FileCheck style={{ width: '18px', height: '18px' }} /> Finalizar Consulta
             </button>
          </>
        )}
        
        {isCompletada && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
            <span style={{ color: '#64748B', fontWeight: 600, fontSize: '14px' }}>Estado: Finalizada</span>
            <button 
              onClick={() => setIsFirmaModalOpen(true)} 
              disabled={isSigning} 
              style={actionBtn('#059669')}
            >
              <Shield style={{ width: '18px', height: '18px' }} /> Firmar Consulta Digitalmente
            </button>
          </div>
        )}

        {isFirmada && (
          <div style={{ background: '#DBEAFE', padding: '12px 40px', borderRadius: '8px', fontWeight: 700, color: '#1E40AF', border: '1px solid #93C5FD', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield style={{ width: '20px', height: '20px' }} />
            <span>🔒 REGISTRO CLINICO SELLADO (Inmutable)</span>
          </div>
        )}
      </div>

      {/* MODAL DE FIRMA DIGITAL */}
      <FirmaModal 
        isOpen={isFirmaModalOpen} 
        onClose={() => setIsFirmaModalOpen(false)} 
        onConfirm={handleFirmar} 
        isSigning={isSigning} 
      />

    </div>
  );
}
