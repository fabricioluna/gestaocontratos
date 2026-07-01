// src/views/DetalhesContrato.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/logopmp.png';
import './DetalhesContrato.css';

import { formatarDataBr } from '../utils/formatters';
import { useDetalhesContrato } from '../hooks/useDetalhesContrato';

import ModalAditivo from '../components/DetalhesContrato/ModalAditivo';
import ModalDistrato from '../components/DetalhesContrato/ModalDistrato';
import ModalOpcoesRelatorio from '../components/DetalhesContrato/ModalOpcoesRelatorio';

export default function DetalhesContrato() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // VERIFICAÇÃO DE SEGURANÇA (RBAC)
  const perfilLogado = sessionStorage.getItem('perfilLogado') || 'viewer';
  const isAdmin = perfilLogado === 'admin';

  const {
    contrato, itensCatalogo, loading, valorGlobalAtualizado, totalAditivosAplicados, valorOriginal,
    aditivoEmEdicao, aditivoDataAditivo, setAditivoDataAditivo, aditivoDescricao, setAditivoDescricao, 
    aditivoTipo, setAditivoTipo, aditivoOperacao, setAditivoOperacao, aditivoValor, setAditivoValor,
    aditivoNovaData, setAditivoNovaData, itensDoAditivo, arquivoPdfAditivo, setArquivoPdfAditivo, 
    processandoPdfIA, itemManualSel, setItemManualSel, itemManualQtd, setItemManualQtd, itemManualVlUnit, 
    setItemManualVlUnit, fecharModalAditivoState, lidarProcessamentoIA, lidarAdicionarItemManual, 
    removerItemAditivo, abrirEdicaoAditivo, excluirAditivo, salvarAditivo,
    distratoData, setDistratoData, distratoMotivo, setDistratoMotivo, salvarDistrato, excluirContrato
  } = useDetalhesContrato(id || '');

  const [isModalAditivoOpen, setIsModalAditivoOpen] = useState(false);
  const [isModalDistratoOpen, setIsModalDistratoOpen] = useState(false);
  const [isModalRelatorioOpen, setIsModalRelatorioOpen] = useState(false);
  const [opcIncluirAditivos, setOpcIncluirAditivos] = useState(true);

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Inclusão Social e Cidadania de Pesqueira',
    'fme': 'Fundo Municipal de Educação de Pesqueira',
    'fms': 'Fundo Municipal de Saúde de Pesqueira'
  };

  if (!contrato) return <div className="loading">A carregar detalhes do contrato...</div>;

  const getStatus = () => {
    if (contrato.dataDistrato) return { texto: 'Distratado', cor: '#dc3545' };
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(contrato.dataFim || ''); vencimento.setHours(0, 0, 0, 0);
    if (hoje > vencimento) return { texto: 'Vencido', cor: '#64748b' }; 
    return { texto: 'Vigente', cor: '#28a745' };
  };
  
  const status = getStatus();

  const gerarRelatorioPDF = () => {
    setIsModalRelatorioOpen(false);
    const doc = new jsPDF();
    
    const gerarConteudoPDF = () => {
      const nomeOrgao = contrato.orgaoId && nomesOrgaos[contrato.orgaoId] ? nomesOrgaos[contrato.orgaoId] : 'Prefeitura Municipal de Pesqueira';

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
      const linhasFornecedor = doc.splitTextToSize(txtFornecedor, 182);
      doc.text(linhasFornecedor, 14, currentY); currentY += (linhasFornecedor.length * 6);
      
      doc.text(`CNPJ do Fornecedor: ${contrato.cnpjFornecedor || 'Não informado'}`, 14, currentY); currentY += 6;
      
      const txtObjeto = `Objeto: ${contrato.objetoCompleto || contrato.objetoResumido || 'Não informado'}`;
      const linhasObjeto = doc.splitTextToSize(txtObjeto, 182);
      doc.text(linhasObjeto, 14, currentY); currentY += (linhasObjeto.length * 6);
      
      const txtFiscal = `Fiscal: ${contrato.fiscalContrato || 'Não informado'}`;
      const linhasFiscal = doc.splitTextToSize(txtFiscal, 182);
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
        const linhasMotivo = doc.splitTextToSize(txtMotivo, 182);
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
        currentY = (doc as any).lastAutoTable.finalY + 10; secNumber++;
      }
      
      if (itensCatalogo.length > 0 || (opcIncluirAditivos && contrato.aditivos && contrato.aditivos.some(a => a.itensAditivados && a.itensAditivados.length > 0))) {
        doc.setFont('helvetica', 'bold'); doc.text(`${secNumber}. ITENS CONTRATADOS (E ADITIVOS)`, 14, currentY); currentY += 6;
        
        const headSaldos = [['Lote', 'Item', 'Descrição', 'Qtd', 'Unitário', 'Total']];
        const bodySaldos: any[] = [];
        
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
    img.onload = () => { doc.addImage(img, 'PNG', 14, 10, 25, 25); gerarConteudoPDF(); };
    img.onerror = () => { gerarConteudoPDF(); };
  };

  return (
    <div className="detalhes-container">
      <header className="detalhes-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button className="btn-voltar" onClick={() => navigate('/painel')}>← Voltar</button>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Contrato: {contrato.numeroContrato}
            {contrato.aditivos && contrato.aditivos.length > 0 && (
              <span style={{ fontSize: '12px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>📝 +{contrato.aditivos.length} Aditivo(s)</span>
            )}
          </h2>
          <span className="status-badge" style={{ backgroundColor: status.cor }}>{status.texto}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-acao primario" onClick={() => setIsModalRelatorioOpen(true)}>📄 Imprimir Relatório</button>
        </div>
      </header>

      <main className="detalhes-conteudo">
        <section className="bloco-info principal">
          <h3>Dados Gerais</h3>
          <div className="grid-info">
            <div className="info-item"><span>Processo:</span> {contrato.numeroProcesso || 'Não informado'}</div>
            <div className="info-item"><span>Modalidade:</span> {contrato.modalidade || 'Não informada'} {contrato.numeroModalidade || ''}</div>
            <div className="info-item"><span>Fornecedor:</span> {contrato.fornecedor || 'Não informado'}</div>
            <div className="info-item"><span>CNPJ do Fornecedor:</span> {contrato.cnpjFornecedor || 'Não informado'}</div>
            <div className="info-item"><span>E-mail da Sec. Demandante/Fiscal:</span> {contrato.emailSecretaria || 'Não informado'}</div>
            <div className="info-item" style={{ gridColumn: '1 / -1' }}><span>Objeto:</span> {contrato.objetoCompleto || contrato.objetoResumido}</div>
            
            <div className="info-item"><span>Data Início:</span> {formatarDataBr(contrato.dataInicio || '')}</div>
            <div className="info-item"><span>Validade:</span> {formatarDataBr(contrato.dataFim || '')}</div>
            <div className="info-item"><span>Fiscal:</span> {contrato.fiscalContrato || 'Não informado'}</div>
          </div>
          
          <div className="valor-global-box" style={{ marginTop: '20px', backgroundColor: '#f0f4f8', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #004a99' }}>
            <span style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '5px' }}>Valor Global Atualizado do Contrato</span>
            <strong style={{ fontSize: '24px', color: '#004a99' }}>{valorGlobalAtualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            {totalAditivosAplicados !== 0 && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                (Valor original: {valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
              </div>
            )}
          </div>
        </section>

        {contrato.dataDistrato && (
          <div style={{ backgroundColor: '#fff3f3', border: '1px solid #ffcaca', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ color: '#dc3545', margin: '0 0 10px 0' }}>⚠️ Contrato Distratado</h3>
            <p style={{ margin: 0 }}><strong>Data:</strong> {formatarDataBr(contrato.dataDistrato || '')}</p>
            <p style={{ margin: '5px 0 0 0' }}><strong>Motivo:</strong> {contrato.motivoDistrato || ''}</p>
          </div>
        )}

        {/* BOTOES DE AÇÃO - ESCONDIDOS PARA FISCAIS */}
        {isAdmin && (
          <div className="acoes-execucao" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
             <button className="btn-acao secundario" onClick={() => setIsModalAditivoOpen(true)}>+ Registrar Aditivo</button>
             {!contrato.dataDistrato && <button className="btn-acao alerta" onClick={() => setIsModalDistratoOpen(true)}>Distratar Contrato</button>}
             <button className="btn-acao perigo" onClick={() => excluirContrato(() => navigate('/painel'))}>Excluir Contrato</button>
          </div>
        )}

        <div className="tabelas-saldos">
          <div className="tabela-container" style={{ gridColumn: '1 / -1' }}>
            <h3>Catálogo de Itens Contratados</h3>
            {itensCatalogo.length === 0 ? (
              <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Nenhum item cadastrado no catálogo.</p>
            ) : (
              <table className="tabela-previa">
                <thead>
                  <tr>
                    <th>Lote</th><th>Item</th><th>Descrição</th><th>Unid.</th><th>Qtd Contratada</th><th>R$ Unit.</th><th>R$ Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itensCatalogo.map((i, index) => (
                    <tr key={index}>
                      <td>{i.numeroLote || '-'}</td><td>{i.numeroItem || '-'}</td><td>{i.discriminacao}</td><td>{i.unidade || 'UND'}</td>
                      <td>{i.quantidade}</td>
                      <td>{Number(i.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td>{Number(i.valorTotalItem).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {contrato.aditivos && contrato.aditivos.length > 0 && (
          <section className="bloco-info" style={{ marginTop: '20px' }}>
            <h3 style={{ color: '#004a99', borderBottom: '2px solid #004a99', paddingBottom: '5px' }}>Histórico de Termos Aditivos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              {contrato.aditivos.map((aditivo, index) => (
                <div key={aditivo.id || index} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', backgroundColor: '#fafafa', position: 'relative' }}>
                  
                  {/* BOTOES DE EDITAR/EXCLUIR ADITIVO - ESCONDIDOS PARA FISCAIS */}
                  {isAdmin && (
                    <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' }}>
                       <button onClick={() => { abrirEdicaoAditivo(aditivo); setIsModalAditivoOpen(true); }} style={{ background: 'none', border: 'none', color: '#004a99', cursor: 'pointer', fontSize: '16px' }} title="Editar">✏️</button>
                       <button onClick={() => excluirAditivo(aditivo)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '16px' }} title="Excluir">🗑️</button>
                    </div>
                  )}
                  
                  <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>{aditivo.descricao}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px' }}>
                    <div><strong>Assinatura:</strong> {formatarDataBr(aditivo.dataAditivo || '')}</div>
                    <div><strong>Tipo:</strong> {aditivo.tipo.toUpperCase()}</div>
                    {aditivo.novaDataFim && <div><strong>Nova Validade:</strong> {formatarDataBr(aditivo.novaDataFim || '')}</div>}
                    {aditivo.valorAditivado !== 0 && (
                      <div><strong>Valor:</strong> <span style={{ color: aditivo.valorAditivado > 0 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>{aditivo.valorAditivado > 0 ? '+' : ''}{aditivo.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    )}
                  </div>
                  
                  {aditivo.itensAditivados && aditivo.itensAditivados.length > 0 && (
                    <div style={{ marginTop: '15px' }}>
                      <strong style={{ fontSize: '12px', color: '#555' }}>Itens Afetados:</strong>
                      <table className="tabela-previa" style={{ marginTop: '5px', fontSize: '12px' }}>
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
          </section>
        )}
      </main>

      {isAdmin && <ModalAditivo isOpen={isModalAditivoOpen} onClose={() => { setIsModalAditivoOpen(false); fecharModalAditivoState(); }} aditivoEmEdicao={aditivoEmEdicao} aditivoDataAditivo={aditivoDataAditivo} setAditivoDataAditivo={setAditivoDataAditivo} aditivoDescricao={aditivoDescricao} setAditivoDescricao={setAditivoDescricao} aditivoTipo={aditivoTipo} setAditivoTipo={setAditivoTipo} aditivoOperacao={aditivoOperacao} setAditivoOperacao={setAditivoOperacao} aditivoValor={aditivoValor} setAditivoValor={setAditivoValor} aditivoNovaData={aditivoNovaData} setAditivoNovaData={setAditivoNovaData} itensDoAditivo={itensDoAditivo} arquivoPdfAditivo={arquivoPdfAditivo} setArquivoPdfAditivo={setArquivoPdfAditivo} processandoPdfIA={processandoPdfIA} lidarProcessamentoIA={lidarProcessamentoIA} itensCatalogo={itensCatalogo} itemManualSel={itemManualSel} setItemManualSel={setItemManualSel} itemManualQtd={itemManualQtd} setItemManualQtd={setItemManualQtd} itemManualVlUnit={itemManualVlUnit} setItemManualVlUnit={setItemManualVlUnit} lidarAdicionarItemManual={lidarAdicionarItemManual} removerItemAditivo={removerItemAditivo} salvarAditivo={salvarAditivo} loading={loading} />}
      {isAdmin && <ModalDistrato isOpen={isModalDistratoOpen} onClose={() => setIsModalDistratoOpen(false)} distratoData={distratoData} setDistratoData={setDistratoData} distratoMotivo={distratoMotivo} setDistratoMotivo={setDistratoMotivo} salvarDistrato={salvarDistrato} loading={loading} />}
      <ModalOpcoesRelatorio isOpen={isModalRelatorioOpen} onClose={() => setIsModalRelatorioOpen(false)} opcIncluirAditivos={opcIncluirAditivos} setOpcIncluirAditivos={setOpcIncluirAditivos} gerarRelatorioPDF={gerarRelatorioPDF} />
    </div>
  );
}