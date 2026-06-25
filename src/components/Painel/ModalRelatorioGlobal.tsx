// src/components/Painel/ModalRelatorioGlobal.tsx
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  opcIncluirSaldo: boolean;
  setOpcIncluirSaldo: (val: boolean) => void;
  opcIncluirAditivos: boolean;
  setOpcIncluirAditivos: (val: boolean) => void;
  gerarRelatorioPDF: () => void;
}

export default function ModalRelatorioGlobal({
  isOpen, onClose, opcIncluirSaldo, setOpcIncluirSaldo,
  opcIncluirAditivos, setOpcIncluirAditivos, gerarRelatorioPDF
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <button className="btn-fechar" onClick={onClose}>×</button>
        <h2 style={{ color: '#0f172a', marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          Opções do Relatório Geral
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={opcIncluirSaldo} 
              onChange={e => setOpcIncluirSaldo(e.target.checked)} 
              style={{ width: '18px', height: '18px' }}
            />
            Incluir coluna com o Saldo Atual dos contratos
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={opcIncluirAditivos} 
              onChange={e => setOpcIncluirAditivos(e.target.checked)} 
              style={{ width: '18px', height: '18px' }}
            />
            Incluir histórico de Aditivos (abaixo de cada contrato)
          </label>
        </div>

        <div className="modal-acoes" style={{ marginTop: '25px' }}>
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn-salvar" style={{ backgroundColor: '#10b981' }} onClick={gerarRelatorioPDF}>
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}