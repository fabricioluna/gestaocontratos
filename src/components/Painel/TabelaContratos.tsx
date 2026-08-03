// src/components/Painel/TabelaContratos.tsx
import type { Contrato } from '../../types/types';
import { formatarDataBr } from '../../utils/formatters';
import { infoVencimento } from '../../utils/statusContrato';

interface TabelaContratosProps {
  contratosFiltrados: Contrato[];
  loading: boolean;
  isAdmin: boolean;
  termoBusca: string;
  ordenacao: { campo: string; direcao: 'asc' | 'desc' };
  lidarComOrdenacao: (campo: string) => void;
  onDetalhes: (id: string) => void;
  onEditar: (contrato: Contrato) => void;
  onExcluir: (id: string) => void;
  temMais: boolean;
  carregarMaisContratos: () => void;
}

// Tabela de contratos do painel — extraída de Painel.tsx (Fase 7) para
// reduzir o tamanho do arquivo original. Puramente apresentacional: não
// possui estado próprio nem acesso a dados, só recebe a lista já filtrada
// e ordenada e devolve as ações do usuário via callbacks.
export default function TabelaContratos({
  contratosFiltrados, loading, isAdmin, termoBusca, ordenacao, lidarComOrdenacao,
  onDetalhes, onEditar, onExcluir, temMais, carregarMaisContratos
}: TabelaContratosProps) {
  const renderSeta = (campo: string) => {
    if (ordenacao.campo !== campo) return <span style={{ color: '#ccc', marginLeft: '5px' }}>↕</span>;
    return <span style={{ marginLeft: '5px' }}>{ordenacao.direcao === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <>
      <div className="legenda-container" style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '12px', color: '#666' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#ffd5d5', border: '1px solid #ff000033' }}></div> Vencimento em menos de 1 mês</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#fff9c4', border: '1px solid #ffc10733' }}></div> Vencimento em menos de 3 meses</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#64748b', border: '1px solid #475569' }}></div> Contrato Vencido</div>
      </div>

      <table className="tabela-contratos">
        <thead>
          <tr>
            <th onClick={() => lidarComOrdenacao('numeroContrato')} style={{ cursor: 'pointer' }}>Nº Contrato {renderSeta('numeroContrato')}</th>
            <th onClick={() => lidarComOrdenacao('objetoResumido')} style={{ cursor: 'pointer' }}>Objeto Resumido {renderSeta('objetoResumido')}</th>
            <th onClick={() => lidarComOrdenacao('fornecedor')} style={{ cursor: 'pointer' }}>Fornecedor {renderSeta('fornecedor')}</th>
            <th onClick={() => lidarComOrdenacao('cnpjFornecedor')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>CPF / CNPJ {renderSeta('cnpjFornecedor')}</th>
            <th onClick={() => lidarComOrdenacao('dataFim')} style={{ cursor: 'pointer' }}>Validade {renderSeta('dataFim')}</th>
            <th onClick={() => lidarComOrdenacao('valorTotal')} style={{ cursor: 'pointer' }}>Valor Global {renderSeta('valorTotal')}</th>
            <th onClick={() => lidarComOrdenacao('fiscalContrato')} style={{ cursor: 'pointer' }}>Fiscal {renderSeta('fiscalContrato')}</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {contratosFiltrados.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: 'center' }}>{termoBusca ? 'Nenhum contrato encontrado.' : 'Nenhum contrato cadastrado.'}</td></tr>
          ) : (
            contratosFiltrados.map((c) => {
              const { style: styleVencimento, titulo: tituloVencimento } = infoVencimento(c.dataFim);
              const isVencido = styleVencimento.backgroundColor === '#64748b';

              return (
                <tr key={c.id} style={styleVencimento} title={tituloVencimento}>
                  <td>
                    <span style={{ fontWeight: 'bold' }}>{c.numeroContrato}</span>
                    {c.aditivos && c.aditivos.length > 0 && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 6px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }} title={`${c.aditivos.length} aditivo(s) registado(s)`}>📝 +{c.aditivos.length}</span>
                    )}
                  </td>
                  <td>{c.objetoResumido}</td>
                  <td>{c.fornecedor}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.cnpjFornecedor || '-'}</td>
                  <td style={{ fontWeight: 'bold' }}>{formatarDataBr(c.dataFim)}</td>
                  <td style={{ fontWeight: 'bold', color: isVencido ? '#ffffff' : '#004a99' }}>{Number(c.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{c.fiscalContrato || '-'}</td>
                  <td style={{ display: 'flex', gap: '5px' }}>
                    <button style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => onDetalhes(c.id!)}>Detalhes</button>

                    {isAdmin && !c.dataDistrato && <button style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => onEditar(c)}>✏️</button>}
                    {isAdmin && <button style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => onExcluir(c.id!)} disabled={loading}>🗑️</button>}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {temMais && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <button onClick={carregarMaisContratos} className="btn-cancelar" style={{ backgroundColor: 'white' }}>
            Carregar mais contratos
          </button>
        </div>
      )}
    </>
  );
}
