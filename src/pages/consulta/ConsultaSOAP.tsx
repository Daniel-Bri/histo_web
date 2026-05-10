import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  consultaService
} from '../../services/consultaService';
import type {
  ConsultaMedica, 
  DiagnosticoCIE10, 
  UpdateConsultaDTO,
  FichaQueue
} from '../../services/consultaService';
import api from '../../api/axios'; // Para cargar triaje
import LoadingButton from '../../components/ui/LoadingButton';
import LoadingSpinner from '../../components/LoadingSpinner';

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
  cursor: 'pointer'
});

export default function ConsultaSOAP() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [consulta, setConsulta] = useState<ConsultaMedica | null>(null);
  const [triajeData, setTriajeData] = useState<any>(null);
  const [queue, setQueue] = useState<FichaQueue[]>([]);
  const [historial, setHistorial] = useState<ConsultaMedica[]>([]);
  // Nuevo estado para persistencia local de demos
  const [demoHistorial, setDemoHistorial] = useState<ConsultaMedica[]>(() => {
    const saved = localStorage.getItem('histolink_demo_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [cieResults, setCieResults] = useState<DiagnosticoCIE10[]>([]);
  const [searchingCie, setSearchingCie] = useState(false);

  const isReadOnly = consulta?.estado === 'COMPLETADA' || consulta?.estado === 'FIRMADA';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!id) {
        const [queueRes, historyRes] = await Promise.all([
          consultaService.getQueue().catch(() => ({ data: { results: [] } })),
          consultaService.getAll().catch(() => ({ data: { results: [] } }))
        ]);
        setQueue(queueRes.data.results || []);
        setHistorial(historyRes.data.results || []);
      } else {
        // MODO DEMO PARA IDS 101, 102, 103 (Los del botón generar)
        if (['101', '102', '103'].includes(id)) {
          // Verificar si ya está en el historial local
          const consultaGuardada = demoHistorial.find(c => c.id === Number(id));
          if (consultaGuardada) {
            setConsulta(consultaGuardada);
            setLoading(false);
            return;
          }

          const names: any = { '101': 'Juan Pérez Test', '102': 'María García López', '103': 'Ricardo Suárez' };
          setConsulta({
            id: Number(id),
            ficha: Number(id),
            paciente_nombre: names[id],
            ficha_correlativo: `FIC-2026-00${id.slice(-1)}`,
            medico: 1,
            triaje: Number(id),
            estado: 'BORRADOR',
            motivo_consulta: '',
            historia_enfermedad_actual: '',
            examen_fisico: '',
            impresion_diagnostica: '',
            codigo_cie10_principal: '',
            codigo_cie10_secundario: '',
            descripcion_cie10: '',
            plan_tratamiento: '',
            indicaciones_alta: '',
            creado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString()
          });
          
          // Datos de triaje simulados para el demo
          setTriajeData({
            paciente_edad: id === '101' ? 34 : id === '102' ? 28 : 45,
            paciente_genero: id === '102' ? 'F' : 'M',
            frecuencia_cardiaca: 80,
            presion_arterial_sistolica: 120,
            presion_arterial_diastolica: 80,
            temperatura: 36.8,
            saturacion_oxigeno: 98,
            frecuencia_respiratoria: 18,
            glasgow: 15
          });
          setLoading(false);
          return;
        }

        const res = await consultaService.getById(Number(id));
        setConsulta(res.data);
        
        // Cargar datos de triaje si existe
        if (res.data.triaje) {
          try {
            const tRes = await api.get(`/api/triaje/${res.data.triaje}/`);
            setTriajeData(tRes.data);
          } catch (e) { console.error("No triaje found"); }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar datos del servidor.');
    } finally {
      setLoading(false);
    }
  }, [id]);

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
  };

  const handleSave = async (silent = false) => {
    if (!consulta || saving || isReadOnly) return;
    
    // MODO DEMO: No llamar al backend si es un ID de prueba
    if ([101, 102, 103].includes(consulta.id)) {
      if (!silent) alert('MODO PRUEBA: Borrador guardado exitosamente (Simulado).');
      return;
    }

    try {
      if (!silent) setSaving(true);
      await consultaService.update(consulta.id, consulta);
      if (!silent) alert('Borrador guardado exitosamente.');
    } catch (err) { if (!silent) alert('Error al guardar.'); } finally { if (!silent) setSaving(false); }
  };

  const handleCompletar = async (nuevoEstado: 'COMPLETADA' | 'FIRMADA') => {
    if (!consulta || isReadOnly) return;
    if (!consulta.motivo_consulta || !consulta.codigo_cie10_principal) {
      alert('El diagnóstico CIE-10 es obligatorio.');
      return;
    }
    if (!window.confirm(`¿Marcar como ${nuevoEstado}?`)) return;

    // MODO DEMO: No llamar al backend si es un ID de prueba
    if ([101, 102, 103].includes(consulta.id)) {
      setSaving(true);
      setTimeout(() => {
        const nuevaConsulta = { ...consulta, estado: nuevoEstado };
        setConsulta(nuevaConsulta);
        
        // Guardar en el historial demo local
        const nuevoHistorial = [nuevaConsulta, ...demoHistorial.filter(c => c.id !== consulta.id)];
        setDemoHistorial(nuevoHistorial);
        localStorage.setItem('histolink_demo_history', JSON.stringify(nuevoHistorial));

        alert(`MODO PRUEBA: Consulta ${nuevoEstado.toLowerCase()} con éxito (Simulado).`);
        setSaving(false);
        navigate('/consulta'); // Redirigir al panel para ver el cambio
      }, 800);
      return;
    }

    try {
      setSaving(true);
      await consultaService.update(consulta.id, { ...consulta, estado: nuevoEstado });
      alert(`Consulta ${nuevoEstado.toLowerCase()} con éxito.`);
      fetchData();
    } catch (err) { alert('Error al actualizar estado.'); } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  if (!id) {
    return (
      <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: '#0F172A', fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>Gestión de Consultas — HOAP</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Columna: Cola de Atención */}
          <div style={sectionBox('#3B82F6')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={labelStyle('#1D4ED8')}>
                🕒 Pacientes en Espera
              </h2>
              <button 
                onClick={() => {
                  const demoQueue: FichaQueue[] = [
                    { id: 101, correlativo: 'FIC-2026-001', paciente_nombre: 'Juan Pérez Test', paciente_edad: 34, paciente_genero: 'M', estado: 'EN_TRIAJE', fecha_apertura: '' },
                    { id: 102, correlativo: 'FIC-2026-002', paciente_nombre: 'María García López', paciente_edad: 28, paciente_genero: 'F', estado: 'EN_TRIAJE', fecha_apertura: '' },
                    { id: 103, correlativo: 'FIC-2026-003', paciente_nombre: 'Ricardo Suárez', paciente_edad: 45, paciente_genero: 'M', estado: 'EN_TRIAJE', fecha_apertura: '' }
                  ];
                  setQueue(demoQueue);
                }}
                style={{ background: '#F0F6FF', color: '#0003B8', border: '1px dashed #0003B8', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                🧪 Generar Pacientes (Demo)
              </button>
            </div>
            
            {queue.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                No hay pacientes en espera.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {queue.map(f => (
                  <div key={f.id} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1E293B' }}>{f.paciente_nombre}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>Ficha: {f.correlativo} | {f.paciente_edad} años</div>
                    </div>
                    <button onClick={() => navigate(`/consulta/${f.id}`)} style={actionBtn('#0EA5E9')}>Atender</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Columna: Historial Reciente */}
          <div style={sectionBox('#10B981')}>
            <h2 style={labelStyle('#047857')}>
              📁 Panel de Consultas
            </h2>
            {historial.length === 0 && demoHistorial.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                No hay consultas registradas.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {[...demoHistorial, ...historial].map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => navigate(`/consulta/${c.id}`)} 
                    style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 700, color: '#1E293B' }}>{c.paciente_nombre}</div>
                      <div style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: c.estado === 'BORRADOR' ? '#FEF3C7' : '#D1FAE5', color: c.estado === 'BORRADOR' ? '#92400E' : '#065F46', fontWeight: 700 }}>
                        {c.estado}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{c.codigo_cie10_principal || 'Sin Dx'} | {new Date(c.creado_en).toLocaleDateString()}</div>
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
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', background: '#F0F9FF', minHeight: '100vh' }}>
      
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
              <strong style={{ fontSize: '18px' }}>{triajeData?.paciente_edad || '--'}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', opacity: 0.8 }}>Sexo</span>
              <strong style={{ fontSize: '18px' }}>{triajeData?.paciente_genero || '--'}</strong>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)' }}>
            {consulta.estado}
          </div>
        </div>
      </div>

      {/* GRID PRINCIPAL 2 COLUMNAS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* COLUMNA IZQUIERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={sectionBox('#3B82F6')}>
            <h3 style={labelStyle('#1D4ED8')}>
              <span>📝</span> Subjetivo (S)
            </h3>
            <textarea 
              style={textareaStyle}
              value={consulta.motivo_consulta}
              onChange={e => handleUpdateField('motivo_consulta', e.target.value)}
              disabled={isReadOnly}
              placeholder="Motivo de consulta y síntomas..."
            />
          </div>

          <div style={sectionBox('#10B981')}>
            <h3 style={labelStyle('#047857')}>
              <span>📊</span> Objetivo (O)
            </h3>
            {triajeData && (
              <div style={triajeGrid}>
                <div>FC: <strong style={{ color: '#111827' }}>{triajeData.frecuencia_cardiaca} lpm</strong></div>
                <div>PA: <strong style={{ color: '#111827' }}>{triajeData.presion_arterial_sistolica}/{triajeData.presion_arterial_diastolica} mmHg</strong></div>
                <div>T°: <strong style={{ color: '#111827' }}>{triajeData.temperatura} °C</strong></div>
                <div>SpO2: <strong style={{ color: '#111827' }}>{triajeData.saturacion_oxigeno} %</strong></div>
                <div>Resp: <strong style={{ color: '#111827' }}>{triajeData.frecuencia_respiratoria} rpm</strong></div>
                <div>Glasgow: <strong style={{ color: '#111827' }}>{triajeData.glasgow}/15</strong></div>
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
          
          <div style={{ ...sectionBox('#64748B'), justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' }}>
             <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => alert("Módulo de Recetas en construcción")} style={{ background: '#ECFDF5', color: '#065F46', padding: '12px 20px', borderRadius: '8px', border: '1px solid #A7F3D0', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>💊</span> Emitir Receta
                </button>
                <button onClick={() => alert("Módulo de Estudios en construcción")} style={{ background: '#EFF6FF', color: '#1E40AF', padding: '12px 20px', borderRadius: '8px', border: '1px solid #BFDBFE', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔬</span> Solicitar Estudios
                </button>
             </div>
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

      <div style={{ height: '30px' }}></div>

      {/* BOTONES DE ACCIÓN - IDÉNTICOS A LA IMAGEN */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
        {!isReadOnly ? (
          <>
            <button onClick={() => handleSave()} style={actionBtn('#334155')}>💾 Guardar Borrador</button>
            <button onClick={() => handleCompletar('COMPLETADA')} style={actionBtn('#F59E0B')}>✔️ Marcar Completada</button>
            <button onClick={() => handleCompletar('FIRMADA')} style={actionBtn('#059669')}>🖋️ Marcar Firmada</button>
          </>
        ) : (
          <div style={{ background: '#E2E8F0', padding: '12px 40px', borderRadius: '8px', fontWeight: 700, color: '#475569' }}>
            CONSULTA {consulta.estado} - SOLO LECTURA
          </div>
        )}
      </div>

    </div>
  );
}
