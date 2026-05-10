import React from 'react';
import { Shield, X, AlertCircle } from 'lucide-react';

interface FirmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSigning: boolean;
}

const FirmaModal: React.FC<FirmaModalProps> = ({ isOpen, onClose, onConfirm, isSigning }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '450px',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        position: 'relative'
      }}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '20px', 
            right: '20px', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            color: '#94A3B8',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={24} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            background: '#ECFDF5', 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            color: '#059669'
          }}>
            <Shield size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>
            Confirmar Firma Digital
          </h3>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#64748B' }}>
            Procedimiento de sellado de registro clínico
          </p>
        </div>

        <div style={{ 
          background: '#FFFBEB', 
          border: '1px solid #FEF3C7', 
          borderRadius: '12px', 
          padding: '16px', 
          marginBottom: '24px',
          display: 'flex',
          gap: '12px'
        }}>
          <AlertCircle style={{ color: '#D97706', flexShrink: 0 }} size={20} />
          <p style={{ margin: 0, fontSize: '13px', color: '#92400E', lineHeight: '1.5' }}>
            <strong>Atención:</strong> Al firmar esta consulta, el registro se volverá <strong>inmutable</strong>. No podrá realizar más cambios y se generará un hash de auditoría permanente.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onClose} 
            disabled={isSigning}
            style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '10px', 
              border: '1.5px solid #E2E8F0', 
              background: 'white', 
              color: '#64748B',
              fontWeight: 700, 
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isSigning}
            style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '10px', 
              border: 'none', 
              background: '#059669', 
              color: 'white', 
              fontWeight: 700, 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: isSigning ? 0.7 : 1
            }}
          >
            {isSigning ? (
              <>Firmando...</>
            ) : (
              <>
                <Shield size={18} /> Confirmar Firma
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirmaModal;
