// src/views/DetalhesContrato.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const nomesOrgaos: { [key: string]: string } = {
  'prefeitura': 'Prefeitura Municipal de Pesqueira',
  'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
  'fme': 'Fundo Municipal de Educação (FME)',
  'fms': 'Fundo Municipal de Saúde (FMS)'
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
  
  const corValidade = diffDias <= 30 ? '#dc3545' : diffDias <= 90 ? '#856404' : '#334155';
  const fundoValidade = diffDias <= 30 ? '#ffebee' : diffDias <= 90 ? '#fff9c4' : '#f8fafc';
  const borderValidade = diffDias <= 30 ? '#ff000033' : diffDias <= 90 ? '#ffc10733' : '#e2e8f0';
  const labelValidade = diffDias < 0 ? "Vencido" : diffDias <= 30 ? `Vence em ${diffDias} dias` : diffDias <= 90 ? `Restam ${diffDias} dias` : "Válido";

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

  // --- GERAÇÃO DE RELATÓRIO PDF COMPLETO ---
  const gerarRelatorioPDF = () => {
    const docPdf = new jsPDF('landscape'); 
    
    const gerarConteudo = () => {
      // CABEÇALHO
      docPdf.setFontSize(16);
      docPdf.setTextColor(0, 74, 153);
      docPdf.text(`Relatório de Contrato: ${contrato.numeroContrato}`, 45, 20);
      
      docPdf.setFontSize(10);
      docPdf.setTextColor(100, 100, 100);
      // ALTERAÇÃO AQUI: Usando o nome do órgão por extenso
      docPdf.text(`Órgão: ${nomesOrgaos[contrato.orgaoId] || ''} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 45, 26);

      let currentY = 40;

      // --- 1. DADOS GERAIS ---
      docPdf.setFontSize(12);
      docPdf.setTextColor(0, 74, 153);
      docPdf.text('Dados Gerais do Contrato', 14, currentY);
      currentY += 6;

      docPdf.setFontSize(10);
      docPdf.setTextColor(50, 50, 50);
      docPdf.text(`Fornecedor: ${contrato.fornecedor}`, 14, currentY); currentY += 5;
      docPdf.text(`Objeto: ${contrato.objetoResumido}`, 14, currentY); currentY += 5;
      
      let linhaProcesso = `Processo Nº: ${contrato.numeroProcesso || '-'}`;
      
      const modalidadeTexto = contrato.modalidade;
      const numModalidade = contrato.numeroModalidade || contrato.numeroPregao;
      
      if (modalidadeTexto && numModalidade) {
        linhaProcesso += `  |  ${modalidadeTexto} Nº: ${numModalidade}`;
      } else if (modalidadeTexto) {
        linhaProcesso += `  |  Modalidade: ${modalidadeTexto}`;
      } else if (numModalidade) {
        linhaProcesso += `  |  Modalidade Nº: ${numModalidade}`;
      }

      if (contrato.numeroAta && contrato.numeroAta.trim() !== '') {
        linhaProcesso += `  |  Ata Nº: ${contrato.numeroAta}`;
      }

      docPdf.text(linhaProcesso, 14, currentY); currentY += 5;
      
      docPdf.text(`Data Início: ${formatarDataBr(contrato.dataInicio)}  |  Validade: ${formatarDataBr(contrato.dataFim)}`, 14, currentY); currentY += 5;
      docPdf.text(`Fiscal Responsável: ${contrato.fiscalContrato || 'Não informado'}`, 14, currentY); currentY += 5;
      
      // OBSERVAÇÃO SÓ APARECE SE PREENCHIDA
      if (contrato.observacao && contrato.observacao.trim() !== '') {
        docPdf.text(`Observações: ${contrato.observacao}`, 14, currentY); 
        currentY += 10;
      } else {
        currentY += 5; 
      }

      // --- 2. POSIÇÃO FINANCEIRA ---
      docPdf.setFontSize(12);
      docPdf.setTextColor(40, 167, 69); // Verde
      docPdf.text('Posição Financeira', 14, currentY);
      currentY += 6;

      docPdf.setFontSize(10);
      docPdf.setTextColor(50, 50, 50);
      docPdf.text(`Global Autorizado: ${contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}  |  Valor Consumido: ${totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}  |  Saldo Atual Disponível: ${contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY); 
      currentY += 12;

      // --- 3. TABELA: PLANILHA ORIGINAL ---
      if (itensCatalogo.length > 0) {
        docPdf.setFontSize(12);
        docPdf.setTextColor(0, 74, 153);
        docPdf.text('Planilha Original do Contrato', 14, currentY);
        currentY += 4;

        const catData = itensCatalogo.map(item => [
          item.numeroLote === 'Único' || !item.numeroLote ? '-' : item.numeroLote,
          item.numeroItem,
          item.discriminacao,
          item.unidade,
          item.quantidade.toString(),
          item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]);

        autoTable(docPdf, {
          startY: currentY,
          head: [['Lote', 'Item', 'Descrição', 'Unidade', 'Qtd', 'Vl. Unitário', 'Vl. Total']],
          body: catData,
          theme: 'striped',
          headStyles: { fillColor: [0, 74, 153] },
          styles: { fontSize: 8, cellPadding: 2 }
        });
        currentY = (docPdf as any).lastAutoTable.finalY + 12;
      }

      // --- 4. TABELA: CONTROLE FÍSICO-FINANCEIRO (SALDOS) ---
      if (tabelaDeSaldos.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(46, 125, 50); // Verde
        docPdf.text('Controle Físico-Financeiro (Saldos por Item)', 14, currentY);
        currentY += 4;

        const saldosData = tabelaDeSaldos.map(linha => {
          const saldoQtd = linha.qtdContratada - linha.qtdConsumida;
          const saldoValor = linha.vlContratado - linha.vlConsumido;
          return [
            (linha.lote !== 'Único' && linha.lote ? `${linha.lote} / ` : '') + linha.item,
            linha.descricao,
            linha.unidade,
            linha.vlUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            linha.qtdContratada.toString(),
            linha.vlContratado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            linha.qtdConsumida.toString(),
            linha.vlConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            saldoQtd.toString(),
            saldoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          ];
        });

        autoTable(docPdf, {
          startY: currentY,
          head: [['Lote/Item', 'Descrição', 'Und', 'Vl. Unit.', 'Qtd. Cont.', 'Vl. Cont.', 'Qtd. Cons.', 'Vl. Cons.', 'Sld. Qtd', 'Sld. Valor']],
          body: saldosData,
          theme: 'grid',
          headStyles: { fillColor: [46, 125, 50] },
          styles: { fontSize: 7, cellPadding: 2 }
        });
        currentY = (docPdf as any).lastAutoTable.finalY + 12;
      }

      // --- 5. TABELA: HISTÓRICO DE LANÇAMENTOS ---
      if (itensConsumo.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(220, 53, 69); // Vermelho
        docPdf.text('Histórico de Lançamentos (Auditoria de Empenhos)', 14, currentY);
        currentY += 4;

        const consumoData = itensConsumo.map(item => [
          (item.numeroLote !== 'Único' && item.numeroLote ? `${item.numeroLote} / ` : '') + item.numeroItem,
          item.discriminacao,
          `${item.quantidade} ${item.unidade}`,
          item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          item.dataAdicao || '-'
        ]);

        autoTable(docPdf, {
          startY: currentY,
          head: [['Lote/Item', 'Descrição', 'Qtd Consumida', 'Vl. Unit.', 'Valor Consumido', 'Data do Log']],
          body: consumoData,
          theme: 'striped',
          headStyles: { fillColor: [220, 53, 69] },
          styles: { fontSize: 8, cellPadding: 3 }
        });
      }

      // Salva e abre o PDF
      const pdfBlob = docPdf.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    };

    const img = new Image();
    img.src = logo;
    img.onload = () => {
      docPdf.addImage(img, 'PNG', 14, 10, 25, 25);
      gerarConteudo();
    };
    img.onerror = () => {
      gerarConteudo(); 
    };
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={`Relatório de Contrato: ${contrato.numeroContrato}`}>
            Relatório de Contrato: {contrato.numeroContrato}
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
          <button className="btn-acao" style={{ backgroundColor: '#17a2b8', color: 'white' }} onClick={gerarRelatorioPDF}>📄 Gerar Relatório</button>
          <button className="btn-acao" style={{ backgroundColor: '#dc3545', color: 'white' }} onClick={excluirContrato} disabled={loading}>🗑️ Excluir Contrato</button>
          <button className="btn-acao btn-editar" onClick={() => setIsModalEditOpen(true)}>✏️ Editar Contrato</button>
          <button className="btn-acao btn-lancar" onClick={() => setIsModalLancamentoOpen(true)}>+ Lançar Consumo (Empenho)</button>
        </div>

        <div className="painel-relatorio">
          
          {/* --- NOVO DESIGN DO CARD DE DADOS GERAIS (DASHBOARD) --- */}
          <div className="card-relatorio">
            <h3 style={{ color: '#004a99', marginTop: 0, marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
              Dados Gerais do Contrato
            </h3>
            
            {/* Destaque Principal */}
            <h4 className="fornecedor-destaque">{contrato.fornecedor}</h4>
            <p className="objeto-destaque">{contrato.objetoResumido}</p>

            {/* Grid de Cards Menores */}
            <div className="dashboard-cards">
              
              {/* Identificação */}
              <div className="info-card">
                <span className="card-label">Processo Nº</span>
                <span className="card-value">{contrato.numeroProcesso || '-'}</span>
              </div>

              <div className="info-card">
                <span className="card-label">Modalidade</span>
                <span className="card-value">{contrato.modalidade || '-'}</span>
              </div>

              <div className="info-card">
                <span className="card-label">{contrato.modalidade ? `${contrato.modalidade} Nº` : 'Nº Modalidade'}</span>
                <span className="card-value">{contrato.numeroModalidade || contrato.numeroPregao || '-'}</span>
              </div>

              {/* A ATA SÓ APARECE NO DASHBOARD SE ESTIVER PREENCHIDA */}
              {contrato.numeroAta && contrato.numeroAta.trim() !== '' && (
                <div className="info-card">
                  <span className="card-label">Ata Nº</span>
                  <span className="card-value">{contrato.numeroAta}</span>
                </div>
              )}

              {/* Vigência e Datas */}
              <div className="info-card">
                <span className="card-label">Data Início</span>
                <span className="card-value">{formatarDataBr(contrato.dataInicio)}</span>
              </div>

              <div className="info-card" style={{ backgroundColor: fundoValidade, borderColor: borderValidade }}>
                <span className="card-label" style={{ color: diffDias <= 90 ? corValidade : '#94a3b8' }}>Validade</span>
                <span className="card-value" style={{ color: corValidade }}>
                  {formatarDataBr(contrato.dataFim)}
                  <span style={{ display: 'block', fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>
                    {labelValidade}
                  </span>
                </span>
              </div>

              {/* Responsabilidade */}
              <div className="info-card" style={{ gridColumn: 'span 2' }}>
                <span className="card-label">Fiscal Responsável</span>
                <span className="card-value">{contrato.fiscalContrato || 'Não informado'}</span>
              </div>
            </div>

            {/* AS OBSERVAÇÕES SÓ APARECEM SE PREENCHIDAS */}
            {contrato.observacao && contrato.observacao.trim() !== '' && (
              <div className="observacao-bloco">
                <span className="card-label">Observações</span>
                <span className="card-value small">{contrato.observacao}</span>
              </div>
            )}

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