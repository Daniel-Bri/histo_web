import React from 'react';
import { Shield, Info } from 'lucide-react';

interface HashAuditoriaSectionProps {
  hash?: string;
  fechaFirma?: string;
}

const HashAuditoriaSection: React.FC<HashAuditoriaSectionProps> = ({ hash, fechaFirma }) => {
  if (!hash) return null;

  return (
    <div style={{ 
      marginTop: '20px', 
      padding: '18px', 
      background: 'white', 
      borderRadius: '12px', 
      border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Shield size={18} style={{ color: '#0F172A' }} />
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
          Seguridad y Auditoría Digital
        </h4>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            FIRMA ELECTRÓNICA (HASH SHA-256):
          </span>
          <code style={{ 
            display: 'block', 
            padding: '10px', 
            background: '#F8FAFC', 
            borderRadius: '6px', 
            fontSize: '11px', 
            wordBreak: 'break-all',
            color: '#475569',
            border: '1px solid #F1F5F9',
            fontFamily: 'monospace'
          }}>
            {hash}
          </code>
        </div>
        
        {fechaFirma && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <Info size={14} style={{ color: '#3B82F6' }} />
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Este registro clínico fue sellado y validado el {new Date(fechaFirma).toLocaleString('es-ES')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HashAuditoriaSection;
