// src/components/Painel/ModalCadastrarEmail.tsx

interface Props {
  emailTemp: string;
  setEmailTemp: (email: string) => void;
  verificandoEmail: boolean;
  onSalvar: () => void;
  onClose: () => void;
}

// Sub-modal "Cadastrar Novo Acesso" de ModalNovoContrato.tsx — extraído na
// Fase 7 para reduzir o tamanho do arquivo original. Puramente
// apresentacional, sem estado próprio.
export default function ModalCadastrarEmail({ emailTemp, setEmailTemp, verificandoEmail, onSalvar, onClose }: Props) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={() => !verificandoEmail && onClose()}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Cadastrar Novo Acesso</h3>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
          O sistema criará o acesso no banco de dados e enviará um e-mail com a senha provisória ao novo fiscal.
        </p>
        <div className="form-group full-width">
          <label>E-mail do Novo Fiscal</label>
          <input
            type="email"
            value={emailTemp}
            onChange={e => setEmailTemp(e.target.value)}
            placeholder="exemplo.fiscal@pesqueira.pe.gov.br"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '25px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-cancelar" onClick={onClose} disabled={verificandoEmail}>Cancelar</button>
          <button type="button" className="btn-salvar" onClick={onSalvar} disabled={verificandoEmail}>
            {verificandoEmail ? 'A processar...' : 'Salvar e Utilizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
