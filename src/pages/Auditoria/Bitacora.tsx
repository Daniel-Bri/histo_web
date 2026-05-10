import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Navigate } from 'react-router-dom';
import { hasRole } from '../../utils/auth';
import { auditoriaService } from '../../services/auditoriaService';
import { fetchUsuariosSinPerfil } from '../../services/usuarioService';
import type { UsuarioSinPerfil } from '../../services/usuarioService';
import type { BitacoraEntry, BitacoraFilters } from '../../types/auditoria.types';
import LoadingSpinner from '../../components/LoadingSpinner';
import AlertError from '../../components/AlertError';
import SelectField from '../../components/ui/SelectField';

dayjs.extend(utc);
dayjs.extend(timezone);

const BOLIVIA_TZ = 'America/La_Paz';

const ACCIONES = [
  { label: 'CREAR', value: 'CREAR' },
  { label: 'LEER', value: 'LEER' },
  { label: 'ACTUALIZAR', value: 'ACTUALIZAR' },
  { label: 'ELIMINAR', value: 'ELIMINAR' },
  { label: 'LOGIN', value: 'LOGIN' },
  { label: 'LOGOUT', value: 'LOGOUT' },
  { label: 'EXPORTAR', value: 'EXPORTAR' },
];

const MODULOS = [
  { label: 'ATENCIÓN CLÍNICA', value: 'ATENCION_CLINICA' },
  { label: 'USUARIOS', value: 'USUARIOS' },
  { label: 'PACIENTES', value: 'PACIENTES' },
  { label: 'INVENTARIO', value: 'INVENTARIO' },
  { label: 'REPORTES', value: 'REPORTES' },
  { label: 'CONFIGURACIÓN', value: 'CONFIGURACION' },
  { label: 'APERTURA FICHA', value: 'APERTURA_FICHA' },
];

export default function Bitacora() {
  // Permisos: Administrador o Auditor
  const isAdminOrAuditor = hasRole('Administrador', 'Auditor');

  if (!isAdminOrAuditor) {
    return <Navigate to="/dashboard" replace />;
  }

  const [entries, setEntries] = useState<BitacoraEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSinPerfil[]>([]);
  
  const [filters, setFilters] = useState<BitacoraFilters>({
    page: 1,
    ordering: '-timestamp'
  });

  const [formFilters, setFormFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    usuario: '',
    accion: '',
    modulo: ''
  });

  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const POR_PAGINA = 20;

  const fetchEntries = useCallback(async (currentFilters: BitacoraFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditoriaService.getBitacora(currentFilters);
      setEntries(data.results);
      setCount(data.count);
      setTotal(data.count);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la bitácora de auditoría.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await fetchUsuariosSinPerfil();
      setUsuarios(data);
    } catch (err) {
      console.error('Error fetching users', err);
    }
  };

  useEffect(() => {
    fetchEntries(filters);
    fetchUsers();
  }, [fetchEntries, filters]);

  const handleApplyFilters = () => {
    const newFilters: BitacoraFilters = {
      ...filters,
      page: 1,
      usuario: formFilters.usuario,
      accion: formFilters.accion,
      modulo: formFilters.modulo,
    };

    if (formFilters.fecha_desde) {
      // Convertir fecha seleccionada en Bolivia (00:00:00) a UTC
      newFilters.fecha_desde = dayjs.tz(formFilters.fecha_desde, BOLIVIA_TZ).startOf('day').utc().format();
    } else {
      newFilters.fecha_desde = undefined;
    }

    if (formFilters.fecha_hasta) {
      // Convertir fecha seleccionada en Bolivia (23:59:59) a UTC
      newFilters.fecha_hasta = dayjs.tz(formFilters.fecha_hasta, BOLIVIA_TZ).endOf('day').utc().format();
    } else {
      newFilters.fecha_hasta = undefined;
    }

    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFormFilters({
      fecha_desde: '',
      fecha_hasta: '',
      usuario: '',
      accion: '',
      modulo: ''
    });
    setFilters({
      page: 1,
      ordering: '-timestamp'
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleExportCSV = async () => {
    try {
      const blob = await auditoriaService.exportBitacora(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = dayjs().tz(BOLIVIA_TZ).format('YYYYMMDD_HHmmss');
      a.href = url;
      a.download = `bitacora_${now}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Error al exportar el archivo CSV.');
    }
  };

  const formatBoliviaDate = (timestamp: string) => {
    return dayjs.utc(timestamp).tz(BOLIVIA_TZ).format('DD/MM/YYYY HH:mm:ss');
  };

  const totalPaginas = Math.ceil(count / POR_PAGINA);

  return (
    <div style={{ padding: '32px' }}>
      {/* Encabezado */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: '16px', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ fontSize: '22px', color: '#0003B8', fontWeight: 700, margin: 0 }}>Bitácora de Auditoría</h1>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0 0' }}>
            {total > 0 ? `Mostrando ${entries.length} de ${total} registros` : 'No hay registros para mostrar'}
          </p>
        </div>
        <button 
          onClick={handleExportCSV}
          style={{
            background: '#0003B8', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 20px', cursor: 'pointer',
            fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span>Exportar a CSV</span>
        </button>
      </div>

      {/* Panel de Filtros */}
      <div style={{
        background: 'white', borderRadius: '12px', padding: '24px',
        marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,3,184,0.06)',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0003B8', marginBottom: '8px', textTransform: 'uppercase' }}>Fecha Desde</label>
            <input 
              type="date"
              value={formFilters.fecha_desde}
              onChange={e => setFormFilters(prev => ({ ...prev, fecha_desde: e.target.value }))}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #B3D4FF' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0003B8', marginBottom: '8px', textTransform: 'uppercase' }}>Fecha Hasta</label>
            <input 
              type="date"
              value={formFilters.fecha_hasta}
              onChange={e => setFormFilters(prev => ({ ...prev, fecha_hasta: e.target.value }))}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #B3D4FF' }}
            />
          </div>
          <SelectField
            label="Usuario"
            value={formFilters.usuario}
            onValueChange={val => setFormFilters(prev => ({ ...prev, usuario: val }))}
            options={[
              { label: 'Todos los usuarios', value: '' },
              ...usuarios.map(u => ({ label: `${u.first_name} ${u.last_name} (${u.username})`, value: u.username }))
            ]}
          />
          <SelectField
            label="Acción"
            value={formFilters.accion}
            onValueChange={val => setFormFilters(prev => ({ ...prev, accion: val }))}
            options={[
              { label: 'Todas las acciones', value: '' },
              ...ACCIONES
            ]}
          />
          <SelectField
            label="Módulo"
            value={formFilters.modulo}
            onValueChange={val => setFormFilters(prev => ({ ...prev, modulo: val }))}
            options={[
              { label: 'Todos los módulos', value: '' },
              ...MODULOS
            ]}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={handleClearFilters}
            style={{
              padding: '10px 24px', background: 'transparent', color: '#0003B8',
              border: '1.5px solid #B3D4FF', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            Limpiar filtros
          </button>
          <button
            onClick={handleApplyFilters}
            style={{
              padding: '10px 24px', background: '#0003B8', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      {error && <AlertError message={error} />}

      {/* Tabla de Registros */}
      <div style={{
        background: 'white', borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,3,184,0.06)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <LoadingSpinner />
            <p style={{ marginTop: '16px', color: '#0003B8', fontWeight: 600 }}>Cargando bitácora...</p>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center', color: '#888' }}>
            No se encontraron registros en la bitácora.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: '#F0F6FF' }}>
                  {['Fecha / Hora', 'Usuario', 'Acción', 'Módulo', 'IP', 'Detalles'].map(h => (
                    <th key={h} style={{
                      padding: '16px', textAlign: 'left',
                      fontSize: '12px', fontWeight: 700, color: '#0003B8',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={entry.id}
                    style={{
                      borderTop: '1px solid #F0F6FF',
                      background: i % 2 === 0 ? 'white' : '#FAFCFF',
                    }}
                  >
                    <td style={{ padding: '16px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                      {formatBoliviaDate(entry.timestamp)}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', fontWeight: 600 }}>
                      {entry.usuario_username}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px' }}>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                        background: getAccionColor(entry.accion), color: 'white'
                      }}>
                        {entry.accion}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px' }}>
                      {entry.modulo.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#666' }}>
                      {entry.ip_address}
                    </td>
                    <td style={{ padding: '16px', fontSize: '13px', color: '#444', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.detalles}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {!loading && totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={() => handlePageChange((filters.page || 1) - 1)}
            disabled={filters.page === 1}
            style={{
              padding: '8px 20px',
              background: filters.page === 1 ? '#F0F6FF' : '#0003B8',
              color: filters.page === 1 ? 'rgba(0,3,184,0.3)' : 'white',
              border: `1px solid ${filters.page === 1 ? 'rgba(0,3,184,0.1)' : '#0003B8'}`,
              borderRadius: '8px',
              cursor: filters.page === 1 ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '14px', color: '#0003B8', fontWeight: 600 }}>
            Página {filters.page} de {totalPaginas}
          </span>
          <button
            onClick={() => handlePageChange((filters.page || 1) + 1)}
            disabled={filters.page === totalPaginas}
            style={{
              padding: '8px 20px',
              background: filters.page === totalPaginas ? '#F0F6FF' : '#0003B8',
              color: filters.page === totalPaginas ? 'rgba(0,3,184,0.3)' : 'white',
              border: `1px solid ${filters.page === totalPaginas ? 'rgba(0,3,184,0.1)' : '#0003B8'}`,
              borderRadius: '8px',
              cursor: filters.page === totalPaginas ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

function getAccionColor(accion: string) {
  switch (accion) {
    case 'CREAR': return '#2E7D32'; // Verde
    case 'ACTUALIZAR': return '#F57C00'; // Naranja
    case 'ELIMINAR': return '#D32F2F'; // Rojo
    case 'LOGIN': return '#0003B8'; // Azul
    case 'LOGOUT': return '#455A64'; // Gris oscuro
    default: return '#1976D2'; // Azul claro
  }
}
