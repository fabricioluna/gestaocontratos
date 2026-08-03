// src/views/DetalhesContrato.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import logo from '../assets/logopmp.png';
import './DetalhesContrato.css';

import { formatarDataBr } from '../utils/formatters';
import { diasAteVencimento } from '../domain/vencimento';
import { carregarJsPDF, quebrarTexto } from '../utils/pdfGerador';
import type { RowInput } from 'jspdf-autotable';
import { gerarPlanilhaXlsx } from '../utils/xlsxGerador';
import { NOMES_ORGAOS } from '../utils/orgaos';
import { useDetalhesContrato } from '../hooks/useDetalhesContrato';
import { useAuth } from '../hooks/useAuth';
import type { Item } from '../types/types';

import ModalAditivo from '../components/DetalhesContrato/ModalAditivo';
import ModalDistrato from '../components/DetalhesContrato/ModalDistrato';
import ModalOpcoesRelatorio from '../components/DetalhesContrato/ModalOpcoesRelatorio';
import ModalEmitirOS from '../components/DetalhesContrato/ModalEmitirOS';
import ModalEditarItemCatalogo from '../components/DetalhesContrato/ModalEditarItemCatalogo';
import CatalogoItensContrato from '../components/DetalhesContrato/CatalogoItensContrato';
import HistoricoAditivos from '../components/DetalhesContrato/HistoricoAditivos';

export default function DetalhesContrato() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { perfil } = useAuth();
  const isAdmin = perfil === 'admin';

  const {
    contrato, itensCatalogo, loading, erro, valorGlobalAtualizado, totalAditivosAplicados, valorOriginal,
    aditivoEmEdicao, aditivoDataAditivo, setAditivoDataAditivo, aditivoDescricao, setAditivoDescricao, 
    aditivoTipo, setAditivoTipo, aditivoOperacao, setAditivoOperacao, aditivoValor, setAditivoValor,
    aditivoNovaData, setAditivoNovaData, itensDoAditivo, arquivoPdfAditivo, setArquivoPdfAditivo, 
    processandoPdfIA, itemManualSel, setItemManualSel, itemManualQtd, setItemManualQtd, itemManualVlUnit, 
    setItemManualVlUnit, fecharModalAditivoState, lidarProcessamentoIA, lidarAdicionarItemManual, 
    removerItemAditivo, abrirEdicaoAditivo, excluirAditivo, salvarAditivo,
    distratoData, setDistratoData, distratoMotivo, setDistratoMotivo, salvarDistrato, excluirContrato,
    salvarEdicaoItem 
  } = useDetalhesContrato(id || '');

  const [isModalAditivoOpen, setIsModalAditivoOpen] = useState(false);
  const [isModalDistratoOpen, setIsModalDistratoOpen] = useState(false);
  const [isModalRelatorioOpen, setIsModalRelatorioOpen] = useState(false);
  const [isModalOSOpen, setIsModalOSOpen] = useState(false); 
  const [opcIncluirAditivos, setOpcIncluirAditivos] = useState(true);

  const [isModalEditarItemOpen, setIsModalEditarItemOpen] = useState(false);
  const [itemParaEditar, setItemParaEditar] = useState<Item | null>(null);

  if (erro) {
    return (
      <div className="loading">
        <p>{erro}</p>
        <button className="btn-voltar" onClick={() => navigate('/painel')} style={{ marginTop: '15px' }}>Voltar ao Painel</button>
      </div>
    );
  }
  if (!contrato) return <div className="loading">A carregar detalhes do contrato...</div>;

  const getStatus = () => {
    if (contrato.dataDistrato) return { texto: 'Distratado', cor: '#dc3545' };
    if (!contrato.dataFim) return { texto: 'Vigente', cor: '#28a745' };
    if (diasAteVencimento(contrato.dataFim) < 0) return { texto: 'Vencido', cor: '#64748b' };
    return { texto: 'Vigente', cor: '#28a745' };
  };
  
  const status = getStatus();

  const gerarRelatorioPDF = async () => {
    setIsModalRelatorioOpen(false);
    const { jsPDF, autoTable } = await carregarJsPDF();
    // MAGIA DE COMPRESSÃO GLOBAL DO PDF
    const doc = new jsPDF({ compress: true });

    const gerarConteudoPDF = () => {
      const nomeOrgao = contrato.orgaoId && NOMES_ORGAOS[contrato.orgaoId] ? NOMES_ORGAOS[contrato.orgaoId] : 'Prefeitura Municipal de Pesqueira';

      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 74, 153);
      doc.text(nomeOrgao.toUpperCase(), 45, 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(100, 100, 100);
      doc.text('Relatório Analítico de Contrato', 45, 28);
      
      let currentY = 48; doc.setFontSize(11); doc.setTextColor(50, 50, 50);
      
      doc.setFont('helvetica', 'bold'); doc.text('1. DADOS GERAIS', 14, currentY); currentY += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Nº Contrato: ${contrato.numeroContrato || 'Não informado'}`, 14, currentY); currentY += 6;
      doc.text(`Processo: ${contrato.numeroProcesso || 'Não informado'}`, 14, currentY); currentY += 6;
      
      const txtFornecedor = `Fornecedor: ${contrato.fornecedor || 'Não informado'}`;
      const linhasFornecedor = quebrarTexto(doc, txtFornecedor, 182);
      doc.text(linhasFornecedor, 14, currentY); currentY += (linhasFornecedor.length * 6);

      doc.text(`CNPJ do Fornecedor: ${contrato.cnpjFornecedor || 'Não informado'}`, 14, currentY); currentY += 6;

      const txtObjeto = `Objeto: ${contrato.objetoCompleto || contrato.objetoResumido || 'Não informado'}`;
      const linhasObjeto = quebrarTexto(doc, txtObjeto, 182);
      doc.text(linhasObjeto, 14, currentY); currentY += (linhasObjeto.length * 6);

      const txtFiscal = `Fiscal: ${contrato.fiscalContrato || 'Não informado'}`;
      const linhasFiscal = quebrarTexto(doc, txtFiscal, 182);
      doc.text(linhasFiscal, 14, currentY); currentY += (linhasFiscal.length * 6);

      doc.text(`Período Vigência: ${formatarDataBr(contrato.dataInicio || '')} a ${formatarDataBr(contrato.dataFim || '')}`, 14, currentY); currentY += 8;
      
      doc.setFont('helvetica', 'bold');
      if (status.texto === 'Vigente') doc.setTextColor(40, 167, 69); 
      else if (status.texto === 'Distratado') doc.setTextColor(220, 53, 69); 
      else doc.setTextColor(100, 116, 139); 
      
      doc.text(`STATUS ATUAL: ${status.texto.toUpperCase()}`, 14, currentY); currentY += 8;
      doc.setTextColor(50, 50, 50); 

      if (contrato.dataDistrato) {
        doc.setTextColor(220, 53, 69);
        doc.text(`Distratado em: ${formatarDataBr(contrato.dataDistrato || '')}`, 14, currentY); currentY += 6;
        const txtMotivo = `Motivo: ${contrato.motivoDistrato || 'Não informado'}`;
        const linhasMotivo = quebrarTexto(doc, txtMotivo, 182);
        doc.text(linhasMotivo, 14, currentY); currentY += (linhasMotivo.length * 6) + 2;
        doc.setTextColor(50, 50, 50);
      }
      
      currentY += 5;
      doc.setFont('helvetica', 'bold'); doc.text('2. RESUMO FINANCEIRO', 14, currentY); currentY += 8;
      doc.setFont('helvetica', 'normal');
      
      const vOriginal = (opcIncluirAditivos) ? valorOriginal : valorGlobalAtualizado;
      doc.text(`Valor Inicial do Contrato: ${vOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY); currentY += 6;
      
      if (opcIncluirAditivos && totalAditivosAplicados !== 0) {
        const textoAdit = totalAditivosAplicados > 0 ? "Acréscimo por Aditivos" : "Supressão por Aditivos";
        doc.text(`${textoAdit}: ${Math.abs(totalAditivosAplicados).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY); currentY += 6;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor Global Atualizado: ${valorGlobalAtualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY); currentY += 12;
      
      let secNumber = 3;

      if (opcIncluirAditivos && contrato.aditivos && contrato.aditivos.length > 0) {
        doc.setFont('helvetica', 'bold'); doc.text(`${secNumber}. HISTÓRICO DE TERMOS ADITIVOS`, 14, currentY); currentY += 6;
        
        const headAditivos = [['Descrição', 'Tipo', 'Assinatura', 'Nova Validade', 'Valor Alterado']];
        const bodyAditivos = contrato.aditivos.map(ad => [
          ad.descricao, ad.tipo.toUpperCase(), formatarDataBr(ad.dataAditivo || ''),
          ad.novaDataFim ? formatarDataBr(ad.novaDataFim) : '-',
          ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'
        ]);

        autoTable(doc, {
          startY: currentY, head: headAditivos, body: bodyAditivos, theme: 'grid',
          headStyles: { fillColor: [100, 116, 139] }, styles: { fontSize: 8 }
        });
        currentY = doc.lastAutoTable!.finalY + 10; secNumber++;
      }
      
      if (itensCatalogo.length > 0 || (opcIncluirAditivos && contrato.aditivos && contrato.aditivos.some(a => a.itensAditivados && a.itensAditivados.length > 0))) {
        doc.setFont('helvetica', 'bold'); doc.text(`${secNumber}. ITENS CONTRATADOS (E ADITIVOS)`, 14, currentY); currentY += 6;
        
        const headSaldos = [['Lote', 'Item', 'Descrição', 'Qtd', 'Unitário', 'Total']];
        const bodySaldos: RowInput[] = [];
        
        itensCatalogo.forEach(i => {
           bodySaldos.push([
             i.numeroLote || '-', i.numeroItem || '-', i.discriminacao, i.quantidade,
             Number(i.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
             Number(i.valorTotalItem).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
           ]);
        });

        if (opcIncluirAditivos && contrato.aditivos) {
          contrato.aditivos.forEach(aditivo => {
            if (aditivo.itensAditivados) {
              aditivo.itensAditivados.forEach(ia => {
                bodySaldos.push([
                  { content: ia.numeroLote || '-', styles: { fillColor: [240,240,240] } },
                  { content: ia.numeroItem || '-', styles: { fillColor: [240,240,240] } },
                  { content: `${ia.discriminacao} (Ref: ${aditivo.descricao})`, styles: { fillColor: [240,240,240], fontStyle: 'italic' } },
                  { content: ia.quantidade, styles: { fillColor: [240,240,240] } },
                  { content: Number(ia.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { fillColor: [240,240,240] } },
                  { content: Number(ia.valorTotalItem).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { fillColor: [240,240,240] } }
                ]);
              });
            }
          });
        }
        
        autoTable(doc, {
          startY: currentY, head: headSaldos, body: bodySaldos, theme: 'grid',
          headStyles: { fillColor: [0, 74, 153] }, styles: { fontSize: 8 }
        });
      }
      
      const pdfBlob = doc.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    };

    const img = new Image(); img.src = logo;
    // MAGIA DA COMPRESSÃO DE IMAGEM: alias 'logo' e 'FAST'
    img.onload = () => { doc.addImage(img, 'PNG', 14, 10, 25, 25, 'logo', 'FAST'); gerarConteudoPDF(); };
    img.onerror = () => { gerarConteudoPDF(); };
  };

  const gerarRelatorioExcel = async () => {
    setIsModalRelatorioOpen(false);

    if (itensCatalogo.length === 0 && (!contrato.aditivos || contrato.aditivos.length === 0)) {
      toast.error("Este contrato não possui itens no catálogo para exportar.");
      return;
    }

    const dadosPlanilha: Record<string, string | number>[] = [];

    itensCatalogo.forEach(i => {
      dadosPlanilha.push({
        'ITEM': i.numeroItem || '-',
        'DESCRIÇÃO': i.discriminacao,
        'UNID': i.unidade || 'UND',
        'QTDE': i.quantidade,
        'VALOR UNIT': i.valorUnitario,
        'VALOR TOTAL': i.valorTotalItem,
        'LOTE': i.numeroLote || '-',
        'ORIGEM': 'Catálogo Original'
      });
    });

    if (opcIncluirAditivos && contrato.aditivos) {
      contrato.aditivos.forEach(aditivo => {
        if (aditivo.itensAditivados) {
          aditivo.itensAditivados.forEach(ia => {
            dadosPlanilha.push({
              'ITEM': ia.numeroItem || '-',
              'DESCRIÇÃO': ia.discriminacao,
              'UNID': ia.unidade || 'UND',
              'QTDE': ia.quantidade,
              'VALOR UNIT': ia.valorUnitario,
              'VALOR TOTAL': ia.valorTotalItem,
              'LOTE': ia.numeroLote || '-',
              'ORIGEM': `Aditivo: ${aditivo.descricao}`
            });
          });
        }
      });
    }

    await gerarPlanilhaXlsx(dadosPlanilha, 'Itens do Contrato', `Itens_Contrato_${contrato.numeroContrato}.xlsx`);
  };

  return (
    <div className="detalhes-container">
      <header className="detalhes-header">
        <div className="header-logo-detalhes">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2>
            Contrato {contrato.numeroContrato}
            {contrato.aditivos && contrato.aditivos.length > 0 && (
              <span className="badge-aditivo-header">📝 +{contrato.aditivos.length} Aditivo(s)</span>
            )}
          </h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span className="status-badge" style={{ backgroundColor: status.cor }}>{status.texto}</span>
          
          {itensCatalogo.length > 0 && (
            <button 
              className="btn-acao primario" 
              onClick={() => setIsModalOSOpen(true)} 
              style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', fontWeight: 'bold' }}
            >
              📝 Emitir O.S. / Pedido
            </button>
          )}
          
          <button className="btn-acao primario" onClick={() => setIsModalRelatorioOpen(true)} style={{ backgroundColor: 'white', color: '#0a2540', border: 'none' }}>
            📤 Exportar
          </button>
          
          <button className="btn-voltar" onClick={() => navigate('/painel')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Voltar
          </button>
        </div>
      </header>

      <main className="detalhes-conteudo">
        
        <section className="card-detalhe">
          <h3>
            Dados Gerais
            {isAdmin && (
               <div style={{ display: 'flex', gap: '8px' }}>
                 {!contrato.dataDistrato && <button className="btn-acao alerta" onClick={() => setIsModalDistratoOpen(true)}>Distratar Contrato</button>}
                 <button className="btn-acao perigo" onClick={() => excluirContrato(() => { void navigate('/painel'); })}>Excluir Contrato</button>
               </div>
            )}
          </h3>
          <div className="grid-info">
            <div className="info-item"><span>Processo</span><strong>{contrato.numeroProcesso || 'Não informado'}</strong></div>
            <div className="info-item"><span>Modalidade</span><strong>{contrato.modalidade || 'Não informada'} {contrato.numeroModalidade || ''}</strong></div>
            <div className="info-item"><span>Fornecedor</span><strong>{contrato.fornecedor || 'Não informado'}</strong></div>
            <div className="info-item"><span>CNPJ</span><strong>{contrato.cnpjFornecedor || 'Não informado'}</strong></div>
            <div className="info-item"><span>E-mail do Fiscal</span><strong>{contrato.emailSecretaria || 'Não informado'}</strong></div>
            <div className="info-item" style={{ gridColumn: '1 / -1' }}><span>Objeto do Contrato</span><strong>{contrato.objetoCompleto || contrato.objetoResumido}</strong></div>
            <div className="info-item"><span>Data Início</span><strong>{formatarDataBr(contrato.dataInicio || '')}</strong></div>
            <div className="info-item"><span>Validade (Fim)</span><strong>{formatarDataBr(contrato.dataFim || '')}</strong></div>
            <div className="info-item"><span>Fiscal Responsável</span><strong>{contrato.fiscalContrato || 'Não informado'}</strong></div>
          </div>
          
          <div className="valor-destaque">
            <span>Valor Global Atualizado do Contrato</span>
            <strong>{valorGlobalAtualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            {totalAditivosAplicados !== 0 && (
              <span style={{ fontSize: '11px', marginTop: '4px' }}>
                (Original: {valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
              </span>
            )}
          </div>
        </section>

        {contrato.dataDistrato && (
          <div style={{ backgroundColor: '#fff3f3', border: '1px solid #fecaca', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ color: '#dc3545', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ Contrato Distratado</h3>
            <p style={{ margin: 0, color: '#450a0a' }}><strong>Data:</strong> {formatarDataBr(contrato.dataDistrato || '')}</p>
            <p style={{ margin: '5px 0 0 0', color: '#450a0a' }}><strong>Motivo:</strong> {contrato.motivoDistrato || ''}</p>
          </div>
        )}

        <CatalogoItensContrato
          itensCatalogo={itensCatalogo}
          isAdmin={isAdmin}
          contratoDistratado={!!contrato.dataDistrato}
          onEditarItem={(item) => { setItemParaEditar(item); setIsModalEditarItemOpen(true); }}
        />

        <HistoricoAditivos
          aditivos={contrato.aditivos}
          isAdmin={isAdmin}
          contratoDistratado={!!contrato.dataDistrato}
          onNovoAditivo={() => setIsModalAditivoOpen(true)}
          onEditarAditivo={(aditivo) => { abrirEdicaoAditivo(aditivo); setIsModalAditivoOpen(true); }}
          onExcluirAditivo={excluirAditivo}
        />
      </main>

      {isAdmin && <ModalAditivo isOpen={isModalAditivoOpen} onClose={() => { setIsModalAditivoOpen(false); fecharModalAditivoState(); }} aditivoEmEdicao={aditivoEmEdicao} aditivoDataAditivo={aditivoDataAditivo} setAditivoDataAditivo={setAditivoDataAditivo} aditivoDescricao={aditivoDescricao} setAditivoDescricao={setAditivoDescricao} aditivoTipo={aditivoTipo} setAditivoTipo={setAditivoTipo} aditivoOperacao={aditivoOperacao} setAditivoOperacao={setAditivoOperacao} aditivoValor={aditivoValor} setAditivoValor={setAditivoValor} aditivoNovaData={aditivoNovaData} setAditivoNovaData={setAditivoNovaData} itensDoAditivo={itensDoAditivo} arquivoPdfAditivo={arquivoPdfAditivo} setArquivoPdfAditivo={setArquivoPdfAditivo} processandoPdfIA={processandoPdfIA} lidarProcessamentoIA={lidarProcessamentoIA} itensCatalogo={itensCatalogo} itemManualSel={itemManualSel} setItemManualSel={setItemManualSel} itemManualQtd={itemManualQtd} setItemManualQtd={setItemManualQtd} itemManualVlUnit={itemManualVlUnit} setItemManualVlUnit={setItemManualVlUnit} lidarAdicionarItemManual={lidarAdicionarItemManual} removerItemAditivo={removerItemAditivo} salvarAditivo={salvarAditivo} loading={loading} />}
      {isAdmin && <ModalDistrato isOpen={isModalDistratoOpen} onClose={() => setIsModalDistratoOpen(false)} distratoData={distratoData} setDistratoData={setDistratoData} distratoMotivo={distratoMotivo} setDistratoMotivo={setDistratoMotivo} salvarDistrato={salvarDistrato} loading={loading} />}
      
      <ModalOpcoesRelatorio 
        isOpen={isModalRelatorioOpen} 
        onClose={() => setIsModalRelatorioOpen(false)} 
        opcIncluirAditivos={opcIncluirAditivos} 
        setOpcIncluirAditivos={setOpcIncluirAditivos} 
        gerarRelatorioPDF={gerarRelatorioPDF}
        gerarRelatorioExcel={gerarRelatorioExcel} 
      />

      {isModalOSOpen && (
        <ModalEmitirOS
          onClose={() => setIsModalOSOpen(false)}
          contrato={contrato}
          itensCatalogo={itensCatalogo}
        />
      )}

      {isModalEditarItemOpen && itemParaEditar && (
        <ModalEditarItemCatalogo
          onClose={() => setIsModalEditarItemOpen(false)}
          itemOriginal={itemParaEditar}
          salvarEdicao={salvarEdicaoItem}
        />
      )}
    </div>
  );
}