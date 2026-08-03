// src/components/DetalhesContrato/CatalogoItensContrato.tsx
import type { Item } from '../../types/types';

interface Props {
  itensCatalogo: Item[];
  isAdmin: boolean;
  contratoDistratado: boolean;
  onEditarItem: (item: Item) => void;
}

// Seção "Catálogo de Itens Contratados" de DetalhesContrato.tsx — extraída
// na Fase 7 para reduzir o tamanho do arquivo original. Puramente
// apresentacional, sem estado próprio.
export default function CatalogoItensContrato({ itensCatalogo, isAdmin, contratoDistratado, onEditarItem }: Props) {
  return (
    <section className="card-detalhe">
      <h3>Catálogo de Itens Contratados</h3>
      {itensCatalogo.length === 0 ? (
        <p style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Nenhum item cadastrado no catálogo.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabela-contratos">
            <thead>
              <tr>
                <th>Lote</th><th>Item</th><th>Descrição</th><th>Unid.</th><th>Qtd</th><th>Valor Unit.</th><th>Valor Total</th>
                {isAdmin && !contratoDistratado && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {itensCatalogo.map((i, index) => (
                <tr key={index}>
                  <td>{i.numeroLote || '-'}</td><td>{i.numeroItem || '-'}</td><td><strong>{i.discriminacao}</strong></td><td>{i.unidade || 'UND'}</td>
                  <td>{i.quantidade}</td>
                  <td>{Number(i.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td style={{ color: '#004a99', fontWeight: 'bold' }}>{Number(i.valorTotalItem).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>

                  {isAdmin && !contratoDistratado && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => onEditarItem(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                        title="Editar Item"
                      >
                        ✏️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
