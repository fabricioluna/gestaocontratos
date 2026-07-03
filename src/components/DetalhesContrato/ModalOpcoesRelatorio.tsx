// src/components/DetalhesContrato/ModalOpcoesRelatorio.tsx

interface ModalOpcoesRelatorioProps {
  isOpen: boolean;
  onClose: () => void;
  opcIncluirAditivos: boolean;
  setOpcIncluirAditivos: (val: boolean) => void;
  gerarRelatorioPDF: () => void;
  gerarRelatorioExcel?: () => void; // A nova prop para o botão Excel
}

export default function ModalOpcoesRelatorio({ 
  isOpen, onClose, opcIncluirAditivos, setOpcIncluirAditivos, gerarRelatorioPDF, gerarRelatorioExcel 
}: ModalOpcoesRelatorioProps) {
  
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '450px', padding: '30px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '20px' }}>Opções de Exportação</h3>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
          Selecione o formato desejado para extrair o catálogo de itens e o balanço financeiro deste contrato.
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '25px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <input 
            type="checkbox" 
            id="inc-aditivos" 
            checked={opcIncluirAditivos} 
            onChange={(e) => setOpcIncluirAditivos(e.target.checked)} 
            style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
          />
          <label htmlFor="inc-aditivos" style={{ cursor: 'pointer', fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>
            Incluir modificações de Termos Aditivos
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ background: '#004a99', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }} onClick={gerarRelatorioPDF}>
            📄 Gerar PDF
          </button>
          
          {gerarRelatorioExcel && (
            <button style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }} onClick={gerarRelatorioExcel}>
              📊 Gerar Excel
            </button>
          )}
          
          <button style={{ background: 'white', color: '#64748b', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}