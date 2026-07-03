// src/components/Painel/ModalRelatorioGlobal.tsx
import { useState } from 'react';

interface ModalRelatorioGlobalProps {
  isOpen: boolean;
  onClose: () => void;
  opcIncluirAditivos: boolean;
  setOpcIncluirAditivos: (val: boolean) => void;
  gerarRelatorioPDF: (dataInicio: string, dataFim: string) => void;
  gerarRelatorioExcel: (dataInicio: string, dataFim: string) => void;
}

export default function ModalRelatorioGlobal({ 
  isOpen, onClose, opcIncluirAditivos, setOpcIncluirAditivos, gerarRelatorioPDF, gerarRelatorioExcel 
}: ModalRelatorioGlobalProps) {
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px', padding: '30px' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '20px', textAlign: 'center' }}>📊 Exportar Relatório</h3>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>
          Defina os filtros desejados e escolha o formato de exportação.
        </p>

        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>📅 Filtrar por Vencimento (Opcional)</h4>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>Vencimento a partir de:</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>Vencimento até:</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '25px' }}>
          <input type="checkbox" id="inc-aditivos" checked={opcIncluirAditivos} onChange={(e) => setOpcIncluirAditivos(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
          <label htmlFor="inc-aditivos" style={{ cursor: 'pointer', fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>
            Incluir detalhamento de Termos Aditivos
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ background: '#004a99', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => gerarRelatorioPDF(dataInicio, dataFim)}>
            📄 Gerar PDF
          </button>
          
          <button style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => gerarRelatorioExcel(dataInicio, dataFim)}>
            📊 Gerar Excel
          </button>
          
          <button style={{ background: 'white', color: '#dc3545', border: '1px solid #dc3545', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}