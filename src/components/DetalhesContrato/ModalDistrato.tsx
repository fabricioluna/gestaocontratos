// src/components/DetalhesContrato/ModalDistrato.tsx
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  distratoData: string;
  setDistratoData: (val: string) => void;
  distratoMotivo: string;
  setDistratoMotivo: (val: string) => void;
  salvarDistrato: (e: React.FormEvent, onSuccess: () => void) => void;
  loading: boolean;
}

export default function ModalDistrato({
  isOpen, onClose, distratoData, setDistratoData,
  distratoMotivo, setDistratoMotivo, salvarDistrato, loading
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <button className="btn-fechar" onClick={onClose}>×</button>
        <h2 style={{ color: '#ef4444', marginTop: 0, borderBottom: '1px solid #fecaca', paddingBottom: '12px' }}>
          Registar Distrato
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
          Atenção: Ao registar o distrato, o contrato será considerado encerrado e não aceitará novos aditivos ou lançamentos.
        </p>
        
        <form onSubmit={(e) => salvarDistrato(e, onClose)} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div className="form-group">
            <label>Data do Distrato:</label>
            <input type="date" required value={distratoData} onChange={e => setDistratoData(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Motivo do Distrato (Opcional):</label>
            <textarea 
              rows={3} 
              value={distratoMotivo} 
              onChange={e => setDistratoMotivo(e.target.value)} 
              placeholder="Informe a justificativa ou embasamento legal..."
            />
          </div>
          
          <div className="modal-acoes">
            <button type="button" className="btn-cancelar" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-salvar" style={{ backgroundColor: '#ef4444' }} disabled={loading}>
              {loading ? 'A registar...' : 'Confirmar Distrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}