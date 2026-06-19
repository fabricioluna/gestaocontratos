// src/views/DetalhesContrato.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/logopmp.png';
import './DetalhesContrato.css';

// IMPORTAÇÃO DOS COMPONENTES MODULARES (UI)
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';
import ModalLancarConsumo from '../components/DetalhesContrato/ModalLancarConsumo';
import ModalOpcoesRelatorio from '../components/DetalhesContrato/ModalOpcoesRelatorio';
import ModalAditivo from '../components/DetalhesContrato/ModalAditivo';
import ModalDistrato from '../components/DetalhesContrato/ModalDistrato';

// IMPORTAÇÃO DO NOSSO NOVO HOOK (LÓGICA)
import { useDetalhesContrato } from '../hooks/useDetalhesContrato';

const formatarDataBr = (dataString: string) => {
  if (!dataString) return 'N/A';
  const partes = dataString.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return dataString;
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

  // CONSUMINDO A LÓGICA DE NEGÓCIO DO HOOK
  const hookState = useDetalhesContrato(id);
  const {
    contrato, itensCatalogo, itensConsumo, loading,
    gerarTabelaSaldos, tabelaDeSaldosTela,
    valorGlobalAtualizado, totalAditivosAplicados, valorOriginal, totalConsumido,
    fecharModalAditivoState, abrirEdicaoAditivo, excluirAditivo, excluirContrato
  } = hookState;

  // ESTADOS DE UI (Apenas para controlar a visibilidade dos modais)
  const [isModalLancamentoOpen, setIsModalLancamentoOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [isModalRelatorioOpen, setIsModalRelatorioOpen] = useState(false);
  const [isModalAditivoOpen, setIsModalAditivoOpen] = useState(false);
  const [isModalDistratoOpen, setIsModalDistratoOpen] = useState(false);

  // Opções do PDF
  const [opcIncluirAditivos, setOpcIncluirAditivos] = useState(true);
  const [opcIncluirEmpenhos, setOpcIncluirEmpenhos] = useState(true);

  // FECHAR COM ESC E INTEGRAÇÃO DO HOOK
  const fecharModalAditivo = () => {
    setIsModalAditivoOpen(false);
    fecharModalAditivoState();
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalLancamentoOpen(false);
        setIsModalEditOpen(false);
        setIsModalDistratoOpen(false);
        setIsModalRelatorioOpen(false);
        fecharModalAditivo();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (!contrato) return <div style={{textAlign: 'center', padding: '50px'}}>A carregar relatório...</div>;

  // LÓGICA VISUAL DE CORES E STATUS
  const hoje = new Date();
  const vencimento = new Date(contrato.dataFim);
  const diffDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
  
  let corValidade = diffDias <= 30 ? '#dc3545' : diffDias <= 90 ? '#856404' : '#334155';
  let fundoValidade = diffDias <= 30 ? '#ffebee' : diffDias <= 90 ? '#fff9c4' : '#f8fafc';
  let borderValidade = diffDias <= 30 ? '#ff000033' : diffDias <= 90 ? '#ffc10733' : '#e2e8f0';
  let labelValidade = diffDias < 0 ? "Vencido" : diffDias <= 30 ? `Vence em ${diffDias} dias` : diffDias <= 90 ? `Restam ${diffDias} dias` : "Válido";

  if (contrato.dataDistrato) {
    corValidade = '#dc3545';
    fundoValidade = '#ffebee';
    borderValidade = '#dc3545';
    labelValidade = "Encerrado (Distratado)";
  }

  const percentualSaldo = (contrato.saldoContrato / valorGlobalAtualizado);
  const alertaSaldoCritico = percentualSaldo < 0.3;

  const totalItens = itensConsumo.length;
  const totalUnidades = itensConsumo.reduce((acc, curr) => acc + curr.quantidade, 0);

  // GERAÇÃO DO PDF
  const gerarRelatorioPDF = () => {
    setIsModalRelatorioOpen(false); 
    const docPdf = new jsPDF('landscape'); 
    
    const gerarConteudo = () => {
      docPdf.setFontSize(16);
      docPdf.setTextColor(0, 74, 153);
      docPdf.text(`Relatório de Contrato: ${contrato.numeroContrato}`, 45, 20);
      
      docPdf.setFontSize(10);
      docPdf.setTextColor(100, 100, 100);
      let statusTexto = `Órgão: ${nomesOrgaos[contrato.orgaoId] || ''} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
      if (contrato.dataDistrato) {
        statusTexto += ` | STATUS: DISTRATADO EM ${formatarDataBr(contrato.dataDistrato)}`;
      }
      docPdf.text(statusTexto, 45, 26);

      let currentY = 40;

      docPdf.setFontSize(12);
      docPdf.setTextColor(contrato.dataDistrato ? 220 : 0, contrato.dataDistrato ? 53 : 74, contrato.dataDistrato ? 69 : 153);
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
      
      if (contrato.observacao && contrato.observacao.trim() !== '') {
        docPdf.text(`Observações: ${contrato.observacao}`, 14, currentY); 
        currentY += 10;
      } else {
        currentY += 5; 
      }

      docPdf.setFontSize(12);
      docPdf.setTextColor(40, 167, 69);
      docPdf.text('Posição Financeira', 14, currentY);
      currentY += 6;

      docPdf.setFontSize(10);
      docPdf.setTextColor(50, 50, 50);
      
      const valorGlobalRelatorio = opcIncluirAditivos ? valorGlobalAtualizado : valorOriginal;
      const saldoAtualRelatorio = opcIncluirAditivos ? contrato.saldoContrato : (valorOriginal - totalConsumido);

      if (opcIncluirAditivos) {
        docPdf.text(`Valor Inicial do Contrato: ${valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}  |  Total em Aditivos: ${totalAditivosAplicados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY); 
        currentY += 6;
      }

      docPdf.text(`Global ${opcIncluirAditivos ? 'Atualizado' : 'Original'}: ${valorGlobalRelatorio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}  |  Valor Consumido: ${totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}  |  Saldo Atual Disponível: ${saldoAtualRelatorio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY); 
      currentY += 12;

      if (opcIncluirAditivos && contrato.aditivos && contrato.aditivos.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(255, 140, 0); 
        docPdf.text('Histórico de Aditivos (Lei 14.133)', 14, currentY);
        currentY += 4;

        const aditivosData: any[] = [];
        contrato.aditivos.forEach(ad => {
           aditivosData.push([
             ad.descricao,
             formatarDataBr(ad.dataAditivo), 
             ad.tipo.toUpperCase(),
             ad.novaDataFim && ad.novaDataFim !== "" ? formatarDataBr(ad.novaDataFim) : '-',
             ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'
           ]);
           
           if (ad.itensAditivados && ad.itensAditivados.length > 0) {
             ad.itensAditivados.forEach(itemAd => {
               aditivosData.push([
                 `  -> Lote ${itemAd.numeroLote} - Item ${itemAd.numeroItem}: ${itemAd.discriminacao}`,
                 '', 
                 '',
                 `${itemAd.quantidade >= 0 ? '+' : ''}${itemAd.quantidade} ${itemAd.unidade}`,
                 `Vl. Total: ${itemAd.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
               ]);
             });
           }
        });

        autoTable(docPdf, {
          startY: currentY,
          head: [['Descrição / Itens', 'Data Assinatura', 'Tipo', 'Nova Validade', 'Vl. Global Aditivado / Qtd']],
          body: aditivosData,
          theme: 'striped',
          headStyles: { fillColor: [255, 140, 0] },
          styles: { fontSize: 8, cellPadding: 2 }
        });
        currentY = (docPdf as any).lastAutoTable.finalY + 12;
      }

      if (itensCatalogo.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }
        
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

      const tabelaDeSaldosRelatorio = gerarTabelaSaldos(opcIncluirAditivos);

      if (tabelaDeSaldosRelatorio.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(46, 125, 50);
        docPdf.text('Controle Físico-Financeiro (Saldos por Item)', 14, currentY);
        currentY += 4;

        const saldosData = tabelaDeSaldosRelatorio.map(linha => {
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

      if (opcIncluirEmpenhos && itensConsumo.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(220, 53, 69);
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

      const pdfBlob = docPdf.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    };

    const img = new Image();
    img.src = logo;
    img.onload = () => { docPdf.addImage(img, 'PNG', 14, 10, 25, 25); gerarConteudo(); };
    img.onerror = () => { gerarConteudo(); };
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
        
        {contrato.dataDistrato && (
          <div style={{ backgroundColor: '#dc3545', color: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            ⚠️ CONTRATO DISTRATADO EM {formatarDataBr(contrato.dataDistrato)}
            {contrato.motivoDistrato && <div style={{ fontSize: '14px', marginTop: '5px', fontWeight: 'normal' }}>Motivo: {contrato.motivoDistrato}</div>}
          </div>
        )}

        <div className="acoes-relatorio">
          <button className="btn-acao btn-gerar" onClick={() => setIsModalRelatorioOpen(true)}>📄 Opções de Relatório</button>
          <button className="btn-acao btn-aditivo" onClick={() => setIsModalAditivoOpen(true)} disabled={!!contrato.dataDistrato}>➕ Aditivo</button>
          <button className="btn-acao btn-distrato" onClick={() => setIsModalDistratoOpen(true)} disabled={!!contrato.dataDistrato}>🛑 Distrato</button>
          <button className="btn-acao btn-editar" onClick={() => setIsModalEditOpen(true)} disabled={!!contrato.dataDistrato}>✏️ Editar</button>
          <button className="btn-acao btn-excluir" onClick={() => excluirContrato(() => navigate('/painel'))} disabled={loading}>🗑️ Excluir</button>
          
          <button 
            className="btn-acao btn-lancar" 
            onClick={() => setIsModalLancamentoOpen(true)}
            disabled={!!contrato.dataDistrato}
            title={contrato.dataDistrato ? "Contrato Distratado" : "Lançar novo empenho de consumo"}
          >
            + Lançar Consumo
          </button>
        </div>

        <div className="painel-relatorio">
          <div className="card-relatorio">
            <h3 style={{ color: '#1e293b', marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              Dados Gerais do Contrato
            </h3>
            
            <h4 className="fornecedor-destaque">{contrato.fornecedor}</h4>
            <p className="objeto-destaque">{contrato.objetoResumido}</p>

            <div className="dashboard-cards">
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
              {contrato.numeroAta && contrato.numeroAta.trim() !== '' && (
                <div className="info-card">
                  <span className="card-label">Ata Nº</span>
                  <span className="card-value">{contrato.numeroAta}</span>
                </div>
              )}
              <div className="info-card">
                <span className="card-label">Data Início</span>
                <span className="card-value">{formatarDataBr(contrato.dataInicio)}</span>
              </div>
              <div className="info-card" style={{ backgroundColor: fundoValidade, borderColor: borderValidade }}>
                <span className="card-label" style={{ color: contrato.dataDistrato ? '#dc3545' : diffDias <= 90 ? corValidade : '#94a3b8' }}>Validade</span>
                <span className="card-value" style={{ color: corValidade }}>
                  {formatarDataBr(contrato.dataFim)}
                  <span style={{ display: 'block', fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>
                    {labelValidade}
                  </span>
                </span>
              </div>
              <div className="info-card" style={{ gridColumn: 'span 2' }}>
                <span className="card-label">Fiscal Responsável</span>
                <span className="card-value">{contrato.fiscalContrato || 'Não informado'}</span>
              </div>
            </div>

            {contrato.observacao && contrato.observacao.trim() !== '' && (
              <div className="observacao-bloco">
                <span className="card-label">Observações</span>
                <span className="card-value small">{contrato.observacao}</span>
              </div>
            )}
          </div>

          <div className="card-financeiro">
            <div>
              <h3 style={{ color: '#10b981', marginTop: 0, textAlign: 'center' }}>Posição Financeira</h3>
              <div className="bloco-saldo">
                
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Valor Inicial:</span>
                  <strong>{valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                
                <div style={{ fontSize: '13px', color: totalAditivosAplicados < 0 ? '#ef4444' : (totalAditivosAplicados > 0 ? '#10b981' : '#64748b'), marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Aditivos/Supressões:</span>
                  <strong>{totalAditivosAplicados > 0 ? '+' : ''}{totalAditivosAplicados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>

                <div style={{ fontSize: '15px', color: '#0f172a', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                  <span>Global Atualizado:</span>
                  <strong>{valorGlobalAtualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>

                <div style={{ fontSize: '15px', color: '#ef4444', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Valor Consumido:</span>
                  <strong>{totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }}></div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Saldo Atual Disponível</div>
                
                <div className={`valor-saldo ${contrato.saldoContrato >= 0 ? 'saldo-positivo' : 'saldo-negativo'}`} style={alertaSaldoCritico && !contrato.dataDistrato ? { color: '#ea580c', border: '2px solid #ea580c', padding: '10px', backgroundColor: '#fff7ed', borderRadius: '8px' } : { borderRadius: '8px' }}>
                  {alertaSaldoCritico && !contrato.dataDistrato && <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>⚠️ SALDO INFERIOR A 30%</div>}
                  {contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>Atualizado em: {contrato.dataUltimaAtualizacao || 'N/A'}</div>
              </div>
            </div>
            <div className="metricas-itens">
              <div><strong>{totalItens}</strong> Nº de Lançamentos</div>
              <div><strong>{totalUnidades.toLocaleString('pt-BR')}</strong> Unidades Consumidas</div>
            </div>
          </div>
        </div>

        {/* --- EXIBIÇÃO DE ADITIVOS NA TELA --- */}
        {contrato.aditivos && contrato.aditivos.length > 0 && (
          <div className="secao-itens">
            <h3 style={{ color: '#f59e0b' }}>📑 Histórico de Aditivos</h3>
            <table className="tabela-itens">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Assinatura</th>
                  <th>Tipo</th>
                  <th>Nova Validade</th>
                  <th>Valor Aditivado/Suprimido</th>
                  <th>Itens Aditivados</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contrato.aditivos.map(ad => (
                  <tr key={ad.id}>
                    <td style={{ fontWeight: '600' }}>{ad.descricao}</td>
                    <td style={{ fontWeight: '600' }}>{formatarDataBr(ad.dataAditivo)}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: '12px' }}>{ad.tipo}</td>
                    <td style={{ fontWeight: '600' }}>{ad.novaDataFim && ad.novaDataFim !== "" ? formatarDataBr(ad.novaDataFim) : '-'}</td>
                    <td style={{ color: ad.valorAditivado < 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                      {ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {ad.itensAditivados && ad.itensAditivados.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '15px' }}>
                          {ad.itensAditivados.map((item, idx) => (
                            <li key={idx}>{item.quantidade >= 0 ? '+' : ''}{item.quantidade}x Item {item.numeroItem}</li>
                          ))}
                        </ul>
                      ) : 'Nenhum item alterado'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }} onClick={() => { abrirEdicaoAditivo(ad); setIsModalAditivoOpen(true); }} disabled={!!contrato.dataDistrato} title="Editar Aditivo">✏️</button>
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => excluirAditivo(ad)} disabled={!!contrato.dataDistrato} title="Excluir Aditivo">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- EXIBIÇÃO DE PLANILHA ORIGINAL --- */}
        {itensCatalogo.length > 0 ? (
          <div className="secao-itens">
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
          <div className="secao-itens" style={{ textAlign: 'center', color: '#666' }}>
            <h3 style={{ color: '#004a99' }}>📋 Planilha Original do Contrato</h3>
            <p>Nenhum item original foi importado na criação deste contrato.</p>
          </div>
        )}

        {/* --- EXIBIÇÃO CONTROLE FÍSICO FINANCEIRO --- */}
        {tabelaDeSaldosTela.length > 0 && (
          <div className="secao-itens">
            <h3 style={{ color: '#2e7d32' }}>📊 Controle Físico-Financeiro (Saldos por Item Consolidados)</h3>
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
                {tabelaDeSaldosTela.map((linha, index) => {
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

        {/* --- EXIBIÇÃO HISTÓRICO DE CONSUMO --- */}
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
                <tr><td colSpan={6} style={{textAlign: 'center'}}>Nenhum empenho/consumo registado ainda.</td></tr>
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

      {/* RENDERIZAÇÃO DOS COMPONENTES MODULARES */}
      <ModalLancarConsumo isOpen={isModalLancamentoOpen} onClose={() => setIsModalLancamentoOpen(false)} contratoId={id!} saldoContrato={contrato.saldoContrato} />
      <ModalEditarContrato isOpen={isModalEditOpen} onClose={() => setIsModalEditOpen(false)} contratoOriginal={contrato} />
      
      <ModalOpcoesRelatorio 
        isOpen={isModalRelatorioOpen} 
        onClose={() => setIsModalRelatorioOpen(false)}
        opcIncluirAditivos={opcIncluirAditivos} setOpcIncluirAditivos={setOpcIncluirAditivos}
        opcIncluirEmpenhos={opcIncluirEmpenhos} setOpcIncluirEmpenhos={setOpcIncluirEmpenhos}
        gerarRelatorioPDF={gerarRelatorioPDF}
      />

      <ModalDistrato 
        isOpen={isModalDistratoOpen} 
        onClose={() => setIsModalDistratoOpen(false)}
        {...hookState}
      />

      <ModalAditivo 
        isOpen={isModalAditivoOpen} 
        onClose={fecharModalAditivo}
        {...hookState}
      />
    </div>
  );
}