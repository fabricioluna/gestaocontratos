// src/components/Painel/CatalogoItensPreviaForm.tsx
import type React from 'react';
import type { Item } from '../../types/types';

interface FormItemState {
  numeroLote: string;
  numeroItem: string;
  discriminacao: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
}

interface Props {
  formItem: FormItemState;
  onMudancaItem: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAdicionarItem: () => void;
  itensPrevia: Item[];
  onRemoverItem: (index: number) => void;
  onImportarPlanilha: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

// Seção "2. Catálogo de Itens do Contrato" de ModalNovoContrato.tsx —
// extraída na Fase 7 para reduzir o tamanho do arquivo original. Puramente
// apresentacional: o estado de `itensPrevia`/`formItem` e a lógica de
// adicionar/remover/importar continuam no componente pai, que também
// mantém o `valorTotal` do formulário em sincronia com os itens — mover
// isso para cá exigiria replicar essa sincronia, então esta extração se
// limita ao JSX e aos handlers já prontos recebidos via props.
export default function CatalogoItensPreviaForm({
  formItem, onMudancaItem, onAdicionarItem, itensPrevia, onRemoverItem, onImportarPlanilha, fileInputRef
}: Props) {
  return (
    <>
      <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px', marginTop: '30px' }}>2. Catálogo de Itens do Contrato (Opcional)</h3>
      <div className="secao-itens-modal">
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}>
          <input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={onMudancaItem} />
          <input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={onMudancaItem} />
          <input type="text" name="discriminacao" placeholder="Descrição" value={formItem.discriminacao} onChange={onMudancaItem} />
          <input type="text" name="quantidade" placeholder="Qtd" value={formItem.quantidade} onChange={onMudancaItem} />
          <input type="text" name="valorUnitario" placeholder="R$ Unit" value={formItem.valorUnitario} onChange={onMudancaItem} />
          <button type="button" onClick={onAdicionarItem} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add</button>
        </div>
        <div style={{ margin: '15px 0', textAlign: 'center' }}><strong>OU</strong></div>
        <label htmlFor="upload-previa" style={{ display: 'block', textAlign: 'center', backgroundColor: '#28a745', color: 'white', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>📄 Importar Excel <input type="file" accept=".xlsx" ref={fileInputRef} onChange={onImportarPlanilha} style={{ display: 'none' }} id="upload-previa" /></label>
      </div>
      {itensPrevia.length > 0 && (
        <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
          <table className="tabela-previa">
            <thead><tr><th>Lote</th><th>Item</th><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th><th>Ação</th></tr></thead>
            <tbody>
              {itensPrevia.map((item, index) => (
                <tr key={index}>
                  <td>{item.numeroLote}</td><td>{item.numeroItem}</td><td>{item.discriminacao}</td><td>{item.quantidade}</td>
                  <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td><button type="button" onClick={() => onRemoverItem(index)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>❌</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
