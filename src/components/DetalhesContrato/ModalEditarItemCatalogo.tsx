// src/components/DetalhesContrato/ModalEditarItemCatalogo.tsx
import React, { useState } from 'react';
import type { Item } from '../../types/types';

interface Props {
  onClose: () => void;
  itemOriginal: Item;
  salvarEdicao: (itemEditado: Item) => Promise<boolean>;
}

// O pai (DetalhesContrato.tsx) só monta este componente quando o modal
// deve estar aberto, então cada montagem já nasce com o estado
// inicializado a partir de `itemOriginal` via lazy initializer — sem
// precisar de um useEffect para sincronizar prop → state toda vez que
// abre (Fase 7; achado de lint react-hooks/set-state-in-effect da Fase 1).
export default function ModalEditarItemCatalogo({ onClose, itemOriginal, salvarEdicao }: Props) {
  const [item, setItem] = useState<Item>(() => ({ ...itemOriginal }));

  const recalcularTotal = (qtdStr: string, valorStr: string) => {
    const qtd = Number(qtdStr) || 0;
    const valor = Number(valorStr) || 0;
    setItem(prev => ({ ...prev, quantidade: qtd, valorUnitario: valor, valorTotalItem: qtd * valor }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sucesso = await salvarEdicao(item);
    if (sucesso) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>✏️ Editar Item do Catálogo</h2>
        <form onSubmit={submit}>
          <div className="form-group full-width">
            <label>Nº do Item</label>
            <input type="text" value={item.numeroItem || ''} onChange={e => setItem({ ...item, numeroItem: e.target.value })} required />
          </div>
          <div className="form-group full-width">
            <label>Descrição do Produto / Serviço</label>
            <textarea rows={3} value={item.discriminacao} onChange={e => setItem({ ...item, discriminacao: e.target.value })} required></textarea>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label>Unidade</label>
              <input type="text" value={item.unidade || ''} onChange={e => setItem({ ...item, unidade: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Qtd.</label>
              <input type="number" step="0.01" value={item.quantidade} onChange={e => recalcularTotal(e.target.value, String(item.valorUnitario))} required />
            </div>
            <div className="form-group">
              <label>V. Unit. (R$)</label>
              <input type="number" step="0.01" value={item.valorUnitario} onChange={e => recalcularTotal(String(item.quantidade), e.target.value)} required />
            </div>
            <div className="form-group">
              <label>V. Total (R$)</label>
              <input type="text" value={item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disabled style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }} />
            </div>
          </div>
          <div className="modal-acoes" style={{ marginTop: '20px' }}>
            <button type="button" className="btn-cancelar" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-salvar">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
}