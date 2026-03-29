// src/views/DetalhesContrato.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './DetalhesContrato.css';

// IMPORTAÇÃO DOS COMPONENTES MODULARES
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';
import ModalLancarConsumo from '../components/DetalhesContrato/ModalLancarConsumo';

interface ItemExtendido {
  id?: string;
  contratoId: string;
  numeroLote: string;
  numeroItem: string;
  discriminacao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  dataAdicao?: string;
  tipoRegistro?: 'catalogo' | 'consumo';
}

const formatarDataBr = (dataString: string) => {
  if (!dataString) return 'N/A';
  const partes = dataString.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return dataString;
};

const siglasOrgaos: { [key: string]: string } = {
  'prefeitura': 'PMP',
  'fmas': 'FMAS',
  'fme': 'FME',
  'fms': 'FMS'
};

export default function DetalhesContrato() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itens, setItens] = useState<ItemExtendido[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalLancamentoOpen, setIsModalLancamentoOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);

  // --- MELHORIA UX: FECHAR MODAIS COM ESC ---
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalLancamentoOpen(false);
        setIsModalEditOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!id) return;
    
    const unsubContrato = onSnapshot(doc(db, 'contratos', id), (docSnap) => {
      if (docSnap.exists()) {
        const dados = { id: docSnap.id, ...docSnap.data() } as Contrato;
        setContrato(dados);
      }
    });

    const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
    const unsubItens = onSnapshot(qItens, (querySnapshot) => {
      const lista: ItemExtendido[] = [];
      querySnapshot.forEach((d) => lista.push({ id: d.id, ...d.data() } as ItemExtendido));
      
      lista.sort((a, b) => {
        const loteA = a.numeroLote || '';
        const loteB = b.numeroLote || '';
        const cmpLote = loteA.localeCompare(loteB, undefined, { numeric: true });
        if (cmpLote !== 0) return cmpLote;
        const itemA = a.numeroItem || '';
        const itemB = b.numeroItem || '';
        return itemA.localeCompare(itemB, undefined, { numeric: true });
      });
      setItens(lista);
    });

    return () => { unsubContrato(); unsubItens(); };
  }, [id]);

  const excluirContrato = async () => {
    if (!id) return;
    if (window.confirm("Tem certeza que deseja excluir este contrato e TODO o seu histórico? Esta ação não pode ser desfeita.")) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', id));
        
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
        const querySnapshot = await getDocs(qItens);
        
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((itemDoc) => {
            batch.delete(itemDoc.ref);
          });
          await batch.commit();
        }
        
        alert("Contrato excluído com sucesso!");
        navigate('/painel');
      } catch (error) {
        alert("Erro ao excluir contrato.");
        setLoading(false);
      }
    }
  };

  if (!contrato) return <div style={{textAlign: 'center', padding: '50px'}}>A carregar relatório...</div>;

  // --- LÓGICA DE ALERTAS E CORES ---
  const hoje = new Date();
  const vencimento = new Date(contrato.dataFim);
  const diffDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
  
  const corValidade = diffDias <= 30 ? '#dc3545' : diffDias <= 90 ? '#856404' : 'inherit';
  const fundoValidade = diffDias <= 30 ? '#ffebee' : diffDias <= 90 ? '#fff9c4' : 'transparent';
  const labelValidade = diffDias < 0 ? "Contrato Vencido!" : diffDias <= 30 ? `Atenção: Vence em ${diffDias} dias` : diffDias <= 90 ? `Aviso: Restam ${diffDias} dias` : "";

  const percentualSaldo = (contrato.saldoContrato / contrato.valorTotal);
  const alertaSaldoCritico = percentualSaldo < 0.3;

  const itensCatalogo = itens.filter(i => i.tipoRegistro === 'catalogo' || !i.tipoRegistro);
  const itensConsumo = itens.filter(i => i.tipoRegistro === 'consumo');

  const totalItens = itensConsumo.length;
  const totalUnidades = itensConsumo.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalConsumido = itensConsumo.reduce((acc, curr) => acc + curr.valorTotalItem, 0);

  const gerarTabelaSaldos = () => {
    const mapaSaldos = new Map();

    itensCatalogo.forEach(cat => {
      const chave = `${cat.numeroLote}|${cat.numeroItem}`;
      mapaSaldos.set(chave, {
        lote: cat.numeroLote,
        item: cat.numeroItem,
        descricao: cat.discriminacao,
        unidade: cat.unidade,
        qtdContratada: cat.quantidade,
        vlUnitario: cat.valorUnitario,
        vlContratado: cat.valorTotalItem,
        qtdConsumida: 0,
        vlConsumido: 0
      });
    });

    itensConsumo.forEach(cons => {
      const chave = `${cons.numeroLote}|${cons.numeroItem}`;
      if (mapaSaldos.has(chave)) {
        const existente = mapaSaldos.get(chave);
        existente.qtdConsumida += cons.quantidade;
        existente.vlConsumido += cons.valorTotalItem;
      } else {
        mapaSaldos.set(chave, {
          lote: cons.numeroLote,
          item: cons.numeroItem,
          descricao: cons.discriminacao,
          unidade: cons.unidade,
          qtdContratada: 0,
          vlUnitario: cons.valorUnitario,
          vlContratado: 0,
          qtdConsumida: cons.quantidade,
          vlConsumido: cons.valorTotalItem
        });
      }
    });

    const arraySaldos = Array.from(mapaSaldos.values());
    arraySaldos.sort((a, b) => {
      const cmpLote = (a.lote || '').localeCompare(b.lote || '', undefined, { numeric: true });
      if (cmpLote !== 0) return cmpLote;
      return (a.item || '').localeCompare(b.item || '', undefined, { numeric: true });
    });

    return arraySaldos;
  };

  const tabelaDeSaldos = gerarTabelaSaldos();

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={`Relatório de Contrato: ${contrato.numeroContrato} / ${contrato.dataInicio.substring(0, 4)} / ${siglasOrgaos[contrato.orgaoId] || ''}`}>
            Relatório de Contrato: {contrato.numeroContrato} / {contrato.dataInicio.substring(0, 4)} / {siglasOrgaos[contrato.orgaoId] || ''}
          </h2>
        </div>
        <button className="btn-sair" onClick={() => navigate('/painel')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Voltar
        </button>
      </header>

      <main className="detalhes-container">
        
        <div className="acoes-relatorio">
          <button className="btn-acao" style={{ backgroundColor: '#dc3545', color: 'white' }} onClick={excluirContrato} disabled={loading}>🗑️ Excluir Contrato</button>
          <button className="btn-acao btn-editar" onClick={() => setIsModalEditOpen(true)}>✏️ Editar Contrato</button>
          <button className="btn-acao btn-lancar" onClick={() => setIsModalLancamentoOpen(true)}>+ Lançar Consumo (Empenho)</button>
        </div>

        <div className="painel-relatorio">
          <div className="card-relatorio">
            <h3 style={{ color: '#004a99', marginTop: 0 }}>Dados Gerais</h3>
            <p><strong>Fornecedor:</strong> {contrato.fornecedor}</p>
            <p><strong>Objeto:</strong> {contrato.objetoResumido}</p>
            <div className="dados-grid">
              <p><strong>Nº Processo:</strong> {contrato.numeroProcesso}</p>
              
              {/* SEPARAÇÃO MODALIDADE E NÚMERO */}
              <p><strong>Modalidade:</strong> {contrato.modalidade || '-'}</p>
              <p><strong>Nº da Modalidade:</strong> {contrato.numeroModalidade || contrato.numeroPregao || '-'}</p>
              
              <p><strong>Nº da Ata:</strong> {contrato.numeroAta || '-'}</p>
              <p><strong>Início:</strong> {formatarDataBr(contrato.dataInicio)}</p>
              
              {/* ALERTA DE VALIDADE */}
              <p style={{ backgroundColor: fundoValidade, padding: '4px', borderRadius: '4px' }}>
                <strong>Validade:</strong> <span style={{ color: corValidade, fontWeight: 'bold' }}>{formatarDataBr(contrato.dataFim)}</span>
                {labelValidade && <span style={{ fontSize: '11px', display: 'block', color: corValidade }}>{labelValidade}</span>}
              </p>
              
              <p><strong>Fiscal:</strong> {contrato.fiscalContrato || 'Não informado'}</p>
              <p><strong>Observação:</strong> {contrato.observacao || 'Nenhuma'}</p>
            </div>
          </div>

          <div className="card-financeiro">
            <div>
              <h3 style={{ color: '#28a745', marginTop: 0, textAlign: 'center' }}>Posição Financeira</h3>
              <div className="bloco-saldo">
                <div style={{ fontSize: '15px', color: '#555', marginBottom: '5px' }}>
                  <strong>Global Autorizado:</strong> {contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div style={{ fontSize: '15px', color: '#dc3545', marginBottom: '10px' }}>
                  <strong>Valor Consumido:</strong> {totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div style={{ borderTop: '1px solid #ddd', margin: '10px 0' }}></div>
                <div style={{ fontSize: '12px', color: '#666' }}>Saldo Atual Disponível</div>
                
                {/* ALERTA DE SALDO CRÍTICO */}
                <div className={`valor-saldo ${contrato.saldoContrato >= 0 ? 'saldo-positivo' : 'saldo-negativo'}`} style={alertaSaldoCritico ? { color: '#e65100', border: '2px solid #e65100', padding: '10px', backgroundColor: '#fff3e0' } : {}}>
                  {alertaSaldoCritico && <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>⚠️ SALDO INFERIOR A 30%</div>}
                  {contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                
                <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>Atualizado em: {contrato.dataUltimaAtualizacao || 'N/A'}</div>
              </div>
            </div>
            <div className="metricas-itens">
              <div><strong>{totalItens}</strong> Nº de Lançamentos</div>
              <div><strong>{totalUnidades.toLocaleString('pt-BR')}</strong> Unidades Consumidas</div>
            </div>
          </div>
        </div>

        {itensCatalogo.length > 0 ? (
          <div className="secao-itens" style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#004a99' }}>📋 Planilha Original do Contrato</h3>
            <table className="tabela-itens">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Item</th>
                  <th>Descrição</th>
                  <th>Unidade</th>
                  <th>Quantidade</th>
                  <th>Valor Unitário</th>
                  <th>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {itensCatalogo.map(item => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>{item.numeroLote === 'Único' || !item.numeroLote ? '-' : item.numeroLote}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.numeroItem}</td>
                    <td>{item.discriminacao}</td>
                    <td style={{ textAlign: 'center' }}>{item.unidade}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantidade}</td>
                    <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#555', fontWeight: 'bold' }}>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="secao-itens" style={{ marginBottom: '30px', textAlign: 'center', color: '#666' }}>
            <h3 style={{ color: '#004a99' }}>📋 Planilha Original do Contrato</h3>
            <p>Nenhum item original foi importado na criação deste contrato.</p>
          </div>
        )}

        {tabelaDeSaldos.length > 0 && (
          <div className="secao-itens" style={{ marginBottom: '30px', overflowX: 'auto' }}>
            <h3 style={{ color: '#2e7d32' }}>📊 Controle Físico-Financeiro (Saldos por Item)</h3>
            <table className="tabela-saldos">
              <thead>
                <tr>
                  <th>Lote/Item</th>
                  <th>Descrição</th>
                  <th>Und</th>
                  <th>Vl. Unit.</th>
                  <th>Qtd Contratada</th>
                  <th>Vl. Contratado</th>
                  <th style={{ backgroundColor: '#fff3cd', color: '#856404' }}>Qtd Consumida</th>
                  <th style={{ backgroundColor: '#fff3cd', color: '#856404' }}>Vl Consumido</th>
                  <th className="th-saldo">Qtd Saldo</th>
                  <th className="th-saldo">Vl. Saldo</th>
                </tr>
              </thead>
              <tbody>
                {tabelaDeSaldos.map((linha, index) => {
                  const saldoQtd = linha.qtdContratada - linha.qtdConsumida;
                  const saldoValor = linha.vlContratado - linha.vlConsumido;
                  return (
                    <tr key={index}>
                      <td style={{ fontWeight: 'bold' }}>{linha.lote !== 'Único' && linha.lote ? `${linha.lote} / ` : ''}{linha.item}</td>
                      <td className="desc-esquerda">{linha.descricao}</td>
                      <td>{linha.unidade}</td>
                      <td>{linha.vlUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      
                      <td>{linha.qtdContratada}</td>
                      <td>{linha.vlContratado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      
                      <td style={{ backgroundColor: '#fffdf5', fontWeight: 'bold', color: '#856404' }}>{linha.qtdConsumida}</td>
                      <td style={{ backgroundColor: '#fffdf5', fontWeight: 'bold', color: '#856404' }}>{linha.vlConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      
                      <td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold', color: saldoQtd < 0 ? 'red' : '#2e7d32' }}>{saldoQtd}</td>
                      <td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold', color: saldoValor < 0 ? 'red' : '#2e7d32' }}>{saldoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="secao-itens">
          <h3 style={{ color: '#dc3545' }}>📝 Histórico de Lançamentos (Auditoria de Empenhos)</h3>
          <table className="tabela-itens">
            <thead>
              <tr>
                <th>Lote/Item</th>
                <th>Descrição</th>
                <th>Qtd Consumida</th>
                <th>Vl. Unit.</th>
                <th>Valor Consumido</th>
                <th>Data do Log</th>
              </tr>
            </thead>
            <tbody>
              {itensConsumo.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center'}}>Nenhum empenho/consumo registrado ainda.</td></tr>
              ) : (
                itensConsumo.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold' }}>{item.numeroLote !== 'Único' && item.numeroLote ? `${item.numeroLote} / ` : ''}{item.numeroItem}</td>
                    <td>{item.discriminacao}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantidade} {item.unidade}</td>
                    <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#dc3545', fontWeight: 'bold' }}>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#666', fontSize: '12px' }}>{item.dataAdicao}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* COMPONENTES MODULARIZADOS */}
      <ModalLancarConsumo 
        isOpen={isModalLancamentoOpen} 
        onClose={() => setIsModalLancamentoOpen(false)} 
        contratoId={id!} 
        saldoContrato={contrato.saldoContrato} 
      />

      <ModalEditarContrato 
        isOpen={isModalEditOpen} 
        onClose={() => setIsModalEditOpen(false)} 
        contratoOriginal={contrato} 
      />

    </div>
  );
}