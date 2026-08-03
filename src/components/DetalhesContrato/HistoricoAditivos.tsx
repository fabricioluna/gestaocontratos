// src/components/DetalhesContrato/HistoricoAditivos.tsx
import type { Aditivo } from '../../types/types';
import { formatarDataBr } from '../../utils/formatters';

interface Props {
  aditivos: Aditivo[] | undefined;
  isAdmin: boolean;
  contratoDistratado: boolean;
  onNovoAditivo: () => void;
  onEditarAditivo: (aditivo: Aditivo) => void;
  onExcluirAditivo: (aditivo: Aditivo) => void;
}

// Seção "Histórico de Termos Aditivos" de DetalhesContrato.tsx — extraída
// na Fase 7 para reduzir o tamanho do arquivo original. Puramente
// apresentacional, sem estado próprio.
export default function HistoricoAditivos({
  aditivos, isAdmin, contratoDistratado, onNovoAditivo, onEditarAditivo, onExcluirAditivo
}: Props) {
  return (
    <section className="card-detalhe">
      <h3>
        Histórico de Termos Aditivos
        {isAdmin && !contratoDistratado && (
          <button className="btn-acao secundario" onClick={onNovoAditivo}>+ Registrar Aditivo</button>
        )}
      </h3>

      {(!aditivos || aditivos.length === 0) ? (
        <p style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Não existem aditivos registados para este contrato.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {aditivos.map((aditivo, index) => (
            <div key={aditivo.id || index} className="card-aditivo">

              {isAdmin && (
                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' }}>
                   <button onClick={() => onEditarAditivo(aditivo)} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px', color: '#004a99', cursor: 'pointer' }} title="Editar">✏️</button>
                   <button onClick={() => onExcluirAditivo(aditivo)} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px', color: '#dc3545', cursor: 'pointer' }} title="Excluir">🗑️</button>
                </div>
              )}

              <h4 style={{ margin: '0 0 15px 0', color: '#0f172a', fontSize: '16px' }}>{aditivo.descricao}</h4>
              <div className="grid-info" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="info-item"><span>Assinatura</span><strong>{formatarDataBr(aditivo.dataAditivo || '')}</strong></div>
                <div className="info-item"><span>Tipo</span><strong>{aditivo.tipo.toUpperCase()}</strong></div>
                {aditivo.novaDataFim && <div className="info-item"><span>Nova Validade</span><strong>{formatarDataBr(aditivo.novaDataFim || '')}</strong></div>}
                {aditivo.valorAditivado !== 0 && (
                  <div className="info-item">
                    <span>Valor Alterado</span>
                    <strong style={{ color: aditivo.valorAditivado > 0 ? '#10b981' : '#ef4444' }}>
                      {aditivo.valorAditivado > 0 ? '+' : ''}{aditivo.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                )}
              </div>

              {aditivo.itensAditivados && aditivo.itensAditivados.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Itens Afetados</span>
                  <table className="tabela-contratos" style={{ marginTop: '10px' }}>
                    <thead><tr><th>Lote</th><th>Item</th><th>Descrição</th><th>Qtd</th><th>R$ Total</th></tr></thead>
                    <tbody>
                      {aditivo.itensAditivados.map((ia, idx) => (
                        <tr key={idx}><td>{ia.numeroLote}</td><td>{ia.numeroItem}</td><td>{ia.discriminacao}</td><td>{ia.quantidade}</td><td>{ia.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
