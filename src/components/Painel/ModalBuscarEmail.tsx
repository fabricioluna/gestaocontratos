// src/components/Painel/ModalBuscarEmail.tsx

interface Props {
  sugestoesEmails: string[];
  onSelecionar: (email: string) => void;
  onClose: () => void;
}

// Sub-modal "Buscar E-mail Existente" de ModalNovoContrato.tsx — extraído
// na Fase 7 para reduzir o tamanho do arquivo original. Puramente
// apresentacional, sem estado próprio.
export default function ModalBuscarEmail({ sugestoesEmails, onSelecionar, onClose }: Props) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Selecione um E-mail Cadastrado</h3>
        <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
          {sugestoesEmails.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666' }}>Nenhum e-mail encontrado no sistema.</p>
          ) : (
            sugestoesEmails.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => onSelecionar(e)}
                style={{ padding: '12px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', cursor: 'pointer', transition: '0.2s' }}
                onMouseEnter={(ev) => ev.currentTarget.style.backgroundColor = '#e2e8f0'}
                onMouseLeave={(ev) => ev.currentTarget.style.backgroundColor = '#f8fafc'}
              >
                📧 {e}
              </button>
            ))
          )}
        </div>
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button type="button" className="btn-cancelar" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
