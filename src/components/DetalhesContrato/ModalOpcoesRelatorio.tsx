// src/components/DetalhesContrato/ModalOpcoesRelatorio.tsx
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  opcIncluirAditivos: boolean;
  setOpcIncluirAditivos: (val: boolean) => void;
  opcIncluirEmpenhos: boolean;
  setOpcIncluirEmpenhos: (val: boolean) => void;
  gerarRelatorioPDF: () => void;
}

export default function ModalOpcoesRelatorio({
  isOpen, onClose, opcIncluirAditivos, setOpcIncluirAditivos,
  opcIncluirEmpenhos, setOpcIncluirEmpenhos, gerarRelatorioPDF
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <button className="btn-fechar" onClick={onClose}>×</button>
        <h2 style={{ color: '#0f172a', marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          Opções do Relatório
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={opcIncluirAditivos} 
              onChange={e => setOpcIncluirAditivos(e.target.checked)} 
              style={{ width: '18px', height: '18px' }}
            />
            Considerar Termos Aditivos no cálculo financeiro e histórico
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={opcIncluirEmpenhos} 
              onChange={e => setOpcIncluirEmpenhos(e.target.checked)} 
              style={{ width: '18px', height: '18px' }}
            />
            Incluir tabela de Histórico de Lançamentos (Empenhos)
          </label>
        </div>

        <div className="modal-acoes" style={{ marginTop: '25px' }}>
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn-salvar" style={{ backgroundColor: '#10b981' }} onClick={gerarRelatorioPDF}>Gerar PDF</button>
        </div>
      </div>
    </div>
  );
}