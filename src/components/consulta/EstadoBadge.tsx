import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';

interface EstadoBadgeProps {
  estado: string;
  firmadoPor?: string;
  fechaFirma?: string;
}

const EstadoBadge: React.FC<EstadoBadgeProps> = ({ estado, firmadoPor }) => {
  const isFirmada = estado === 'FIRMADA';
  const isCompletada = estado === 'COMPLETADA';

  if (isFirmada) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
        <div style={{ 
          background: '#DCFCE7', 
          color: '#166534', 
          padding: '4px 12px', 
          borderRadius: '9999px', 
          fontSize: '12px', 
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          border: '1px solid #BBF7D0'
        }}>
          <CheckCircle size={14} /> FIRMADA
        </div>
        {firmadoPor && (
          <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
            Por: {firmadoPor}
          </span>
        )}
      </div>
    );
  }

  if (isCompletada) {
    return (
      <div style={{ 
        background: '#FEF3C7', 
        color: '#92400E', 
        padding: '4px 12px', 
        borderRadius: '9999px', 
        fontSize: '12px', 
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        border: '1px solid #FDE68A'
      }}>
        <Clock size={14} /> FINALIZADA
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#F1F5F9', 
      color: '#475569', 
      padding: '4px 12px', 
      borderRadius: '9999px', 
      fontSize: '12px', 
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      border: '1px solid #E2E8F0'
    }}>
      <Clock size={14} /> BORRADOR
    </div>
  );
};

export default EstadoBadge;
