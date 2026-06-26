// src/components/DetalhesContrato/ModalAditivo.tsx
import React from 'react';
import type { Aditivo, ItemAditivo, Item } from '../../types/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  aditivoEmEdicao: Aditivo | null;
  aditivoDescricao: string; 
  setAditivoDescricao: (v: string) => void;
  aditivoDataAditivo: string; 
  setAditivoDataAditivo: (v: string) => void;
  aditivoTipo: 'prazo' | 'valor' | 'ambos'; 
  setAditivoTipo: (v: 'prazo' | 'valor' | 'ambos') => void;
  aditivoNovaData: string; 
  setAditivoNovaData: (v: string) => void;
  aditivoOperacao: 'acrescimo' | 'supressao'; 
  setAditivoOperacao: (v: 'acrescimo' | 'supressao') => void;
  aditivoValor: number | ''; 
  setAditivoValor: (v: number | '') => void;
  arquivoPdfAditivo: File | null; // CORREÇÃO: Propriedade adicionada
  setArquivoPdfAditivo: (f: File | null) => void;
  processandoPdfIA: boolean; 
  lidarProcessamentoIA: () => void;
  itemManualSel: string; 
  setItemManualSel: (v: string) => void;
  itemManualQtd: number | ''; 
  setItemManualQtd: (v: number | '') => void;
  itemManualVlUnit: number | ''; 
  setItemManualVlUnit: (v: number | '') => void;
  lidarAdicionarItemManual: () => void;
  itensDoAditivo: ItemAditivo[];
  removerItemAditivo: (idx: number) => void;
  itensCatalogo: Item[]; 
  salvarAditivo: (e: React.FormEvent, onSuccess: () => void) => void;
  loading: boolean;
}

export default function ModalAditivo({
  isOpen, onClose, aditivoEmEdicao, aditivoDescricao, setAditivoDescricao,
  aditivoDataAditivo, setAditivoDataAditivo, aditivoTipo, setAditivoTipo,
  aditivoNovaData, setAditivoNovaData, aditivoOperacao, setAditivoOperacao,
  aditivoValor, setAditivoValor, arquivoPdfAditivo, setArquivoPdfAditivo,
  processandoPdfIA, lidarProcessamentoIA, itemManualSel, setItemManualSel, itemManualQtd,
  setItemManualQtd, itemManualVlUnit, setItemManualVlUnit, lidarAdicionarItemManual,
  itensDoAditivo, removerItemAditivo, itensCatalogo, salvarAditivo, loading
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="btn-fechar" onClick={onClose}>×</button>
        <h2 style={{ color: '#f59e0b', marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          {aditivoEmEdicao ? 'Editar Aditivo' : 'Registar Aditivo'}
        </h2>
        
        <form onSubmit={(e) => salvarAditivo(e, onClose)} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Descrição do Aditivo:</label>
              <input type="text" required placeholder="Ex: 1º Termo Aditivo de Prazo e Valor" value={aditivoDescricao} onChange={e => setAditivoDescricao(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Data de Assinatura do Aditivo:</label>
              <input type="date" required value={aditivoDataAditivo} onChange={e => setAditivoDataAditivo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Tipo de Aditivo:</label>
              <select value={aditivoTipo} onChange={e => setAditivoTipo(e.target.value as 'prazo' | 'valor' | 'ambos')}>
                <option value="prazo">Apenas Prazo</option>
                <option value="valor">Apenas Valor</option>
                <option value="ambos">Prazo e Valor</option>
              </select>
            </div>
          </div>

          {(aditivoTipo === 'prazo' || aditivoTipo === 'ambos') && (
            <div className="form-group">
              <label>Nova Data de Validade:</label>
              <input type="date" required value={aditivoNovaData} onChange={e => setAditivoNovaData(e.target.value)} />
            </div>
          )}

          {(aditivoTipo === 'valor' || aditivoTipo === 'ambos') && (
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#3b82f6', fontSize: '15px' }}>📄 Importação e Seleção de Itens</h4>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px', display: 'block' }}>Extração Automática via Arquivo (PDF ou DOCX):</label>
                <div className="ia-upload-section">
                  <input type="file" accept=".txt,.pdf,.docx" onChange={e => setArquivoPdfAditivo(e.target.files?.[0] || null)} className="file-upload-box" />
                  <button type="button" onClick={lidarProcessamentoIA} disabled={processandoPdfIA} className="btn-ia">
                    {processandoPdfIA ? '🤖 A ler...' : '🤖 Extrair IA'}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '16px 0', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>OU</div>

              <div className="manual-item-section">
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px', display: 'block' }}>Importar da Planilha Original do Contrato:</label>
                <div className="form-grid" style={{ marginBottom: '10px' }}>
                  <div className="form-group full-width">
                    <select value={itemManualSel} onChange={e => {
                      setItemManualSel(e.target.value);
                      const original = itensCatalogo.find(i => i.id === e.target.value);
                      if (original) setItemManualVlUnit(original.valorUnitario);
                    }}>
                      <option value="">Selecione um item cadastrado...</option>
                      {itensCatalogo.map(i => (
                        <option key={i.id} value={i.id}>Lote {i.numeroLote} - Item {i.numeroItem} | {i.discriminacao}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Qtd (+ ou -):</label>
                    <input type="number" step="0.01" value={itemManualQtd} onChange={e => setItemManualQtd(Number(e.target.value))} placeholder="Ex: 500" />
                  </div>
                  <div className="form-group">
                    <label>Vl. Unit. (R$):</label>
                    <input type="number" step="0.01" value={itemManualVlUnit} onChange={e => setItemManualVlUnit(Number(e.target.value))} />
                  </div>
                </div>
                <button type="button" className="btn-acao btn-gerar" style={{ width: '100%', padding: '10px' }} onClick={lidarAdicionarItemManual}>
                  ➕ Adicionar à Lista do Aditivo
                </button>
              </div>

              {itensDoAditivo.length > 0 && (
                <div style={{ marginTop: '16px', backgroundColor: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#10b981' }}>✓ Itens do Aditivo ({itensDoAditivo.length})</p>
                  <table className="tabela-itens" style={{ fontSize: '11px', marginBottom: 0 }}>
                    <thead>
                      <tr><th>Item</th><th>Qtd</th><th>Vl. Unit</th><th>Vl. Total</th><th></th></tr>
                    </thead>
                    <tbody>
                      {itensDoAditivo.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.discriminacao}</td>
                          <td>{item.quantidade >= 0 ? '+' : ''}{item.quantidade} {item.unidade}</td>
                          <td>R$ {item.valorUnitario}</td>
                          <td>R$ {item.valorTotalItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'center', padding: '4px' }}>
                            <button type="button" onClick={() => removerItemAditivo(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }} title="Remover item">❌</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="form-grid" style={{ marginTop: '16px', marginBottom: '0' }}>
                <div className="form-group">
                  <label>Operação Global:</label>
                  <select value={aditivoOperacao} onChange={e => setAditivoOperacao(e.target.value as 'acrescimo' | 'supressao')}>
                    <option value="acrescimo">Acréscimo (+)</option>
                    <option value="supressao">Supressão (-)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Valor Global Alterado (R$):</label>
                  <input type="number" required min="0.01" step="0.01" value={aditivoValor} onChange={e => setAditivoValor(Number(e.target.value))} placeholder="Ex: 5000.00" />
                  <small style={{ color: '#64748b', fontSize: '10px', display: 'block', marginTop: '4px' }}>Calculado automaticamente ao inserir itens.</small>
                </div>
              </div>
            </div>
          )}

          <div className="modal-acoes">
            <button type="button" className="btn-cancelar" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-salvar" disabled={loading}>
              {loading ? 'A guardar...' : (aditivoEmEdicao ? 'Atualizar Aditivo' : 'Confirmar Aditivo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}