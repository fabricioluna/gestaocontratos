// src/views/Painel.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx'; // Biblioteca de Excel
import type { Contrato } from '../types/types';
import logo from '../assets/logopmp.png';
import './Painel.css';

import { formatarDataBr } from '../utils/formatters';
import ModalNovoContrato from '../components/Painel/ModalNovoContrato';
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';
import ModalRelatorioGlobal from '../components/Painel/ModalRelatorioGlobal';
import { useContratos } from '../hooks/useContratos';

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');
  
  // VERIFICAÇÃO DE SEGURANÇA (RBAC)
  const perfilLogado = sessionStorage.getItem('perfilLogado') || 'viewer';
  const isAdmin = perfilLogado === 'admin';

  const { 
    contratosFiltrados, loading, termoBusca, setTermoBusca, 
    ordenacao, lidarComOrdenacao, excluirContrato 
  } = useContratos(orgaoLogado);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [contratoParaEditar, setContratoParaEditar] = useState<Contrato | null>(null);

  const [isModalRelatorioOpen, setIsModalRelatorioOpen] = useState(false);
  const [opcIncluirAditivos, setOpcIncluirAditivos] = useState(false);

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
    'fme': 'Fundo Municipal de Educação (FME)',
    'fms': 'Fundo Municipal de Saúde (FMS)'
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        setIsModalEditOpen(false);
        setIsModalRelatorioOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const getRowStyle = (dataFim: string) => {
    if (!dataFim) return {};
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0); 
    const vencimento = new Date(dataFim); vencimento.setHours(0, 0, 0, 0);
    const diffEmDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffEmDias < 0) return { backgroundColor: '#64748b', color: '#ffffff' }; 
    if (diffEmDias <= 30) return { backgroundColor: '#ffd5d5', color: '#900' }; 
    if (diffEmDias <= 90) return { backgroundColor: '#fff9c4', color: '#856404' }; 
    return {};
  };

  const getRowTitle = (dataFim: string) => {
    if (!dataFim) return "Status Desconhecido";
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataFim); vencimento.setHours(0, 0, 0, 0);
    const diffEmDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffEmDias < 0) return "Contrato Vencido";
    if (diffEmDias <= 30) return "Atenção: Vencimento em menos de 30 dias";
    if (diffEmDias <= 90) return "Aviso: Vencimento em menos de 3 meses";
    return "Vigente";
  };

  const renderSeta = (campo: string) => {
    if (ordenacao.campo !== campo) return <span style={{ color: '#ccc', marginLeft: '5px' }}>↕</span>;
    return <span style={{ marginLeft: '5px' }}>{ordenacao.direcao === 'asc' ? '▲' : '▼'}</span>;
  };

  // --- NOVA FUNÇÃO: EXPORTAR PARA EXCEL ---
  const exportarParaExcel = () => {
    // Transforma os dados numa tabela simplificada
    const dadosPlanilha = contratosFiltrados.map(c => {
      const vTotal = Number(c.valorTotal) || 0;
      return {
        'Nº Contrato': c.numeroContrato || '-',
        'Processo': c.numeroProcesso || '-',
        'Modalidade': `${c.modalidade || ''} ${c.numeroModalidade || ''}`.trim(),
        'Fornecedor': c.fornecedor || '-',
        'CNPJ': c.cnpjFornecedor || '-',
        'Objeto': c.objetoResumido || '-',
        'Valor Global (R$)': vTotal,
        'Data Início': formatarDataBr(c.dataInicio),
        'Data Fim (Validade)': formatarDataBr(c.dataFim),
        'Fiscal do Contrato': c.fiscalContrato || '-',
        'Status Atual': getRowTitle(c.dataFim),
        'Qtd Aditivos': c.aditivos?.length || 0
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dadosPlanilha);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contratos");
    
    const nomeFundo = orgaoLogado ? orgaoLogado.toUpperCase() : 'GERAL';
    XLSX.writeFile(workbook, `Relatorio_Contratos_${nomeFundo}.xlsx`);
  };

  const gerarRelatorioPDF = () => {
    setIsModalRelatorioOpen(false); 
    const docPdf = new jsPDF('landscape'); 
    
    const gerarTabela = () => {
      docPdf.setFontSize(16); docPdf.setTextColor(0, 74, 153);
      docPdf.text(orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Relatório de Contratos', 45, 20);
      docPdf.setFontSize(11); docPdf.setTextColor(100, 100, 100);
      const textoFiltro = termoBusca ? ` (Filtro aplicado: "${termoBusca}")` : '';
      docPdf.text(`Listagem Geral de Contratos${textoFiltro} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 45, 28);
      
      const headRow = ['Nº Contrato', 'Objeto', 'Fornecedor', 'CNPJ', 'Validade', 'Valor Global\n/ Aditivo', 'Fiscal'];
      type TableCell = string | { content: string, colSpan?: number, styles?: any };
      const tableData: TableCell[][] = [];

      contratosFiltrados.forEach(c => {
        const vTotal = Number(c.valorTotal) || 0;
        tableData.push([
          c.numeroContrato || '-',
          c.objetoCompleto || c.objetoResumido || '-',
          c.fornecedor || '-',
          c.cnpjFornecedor || 'Não inf.',
          formatarDataBr(c.dataFim),
          vTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          c.fiscalContrato || '-'
        ]);

        if (opcIncluirAditivos && c.aditivos && c.aditivos.length > 0) {
          c.aditivos.forEach(ad => {
            const strValidade = ad.novaDataFim ? formatarDataBr(ad.novaDataFim) : '-';
            const strValor = ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
            const estiloAditivo = { fillColor: [248, 250, 252], textColor: [100, 100, 100], fontStyle: 'italic' };

            tableData.push([
              { content: '+ ADITIVO', styles: { ...estiloAditivo, fontStyle: 'bold', halign: 'center' } },
              { content: `${ad.descricao}\n(Tipo: ${ad.tipo.toUpperCase()})`, colSpan: 3, styles: { ...estiloAditivo, halign: 'left' } },
              { content: `Assinado:\n${formatarDataBr(ad.dataAditivo)}\n\nNova Valid:\n${strValidade}`, styles: { ...estiloAditivo, halign: 'center' } },
              { content: strValor, styles: { ...estiloAditivo, halign: 'right', fontStyle: 'bold' } },
              { content: '-', styles: { ...estiloAditivo, halign: 'center' } }
            ]);
          });
        }
      });

      const colStyles: any = { 
        0: { halign: 'center', cellWidth: 30 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40 },                   
        3: { halign: 'center', cellWidth: 26 }, 4: { halign: 'center', cellWidth: 26 }, 
        5: { halign: 'right', cellWidth: 32 },  6: { halign: 'center', cellWidth: 24 }  
      };

      autoTable(docPdf, {
        startY: 40, head: [headRow], body: tableData, theme: 'striped',
        headStyles: { fillColor: [0, 74, 153] }, styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: colStyles
      });

      const pdfBlob = docPdf.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    };

    const img = new Image(); img.src = logo;
    img.onload = () => { docPdf.addImage(img, 'PNG', 14, 10, 25, 25); gerarTabela(); };
    img.onerror = () => { gerarTabela(); };
  };

  const abrirEdicao = (c: Contrato) => {
    setContratoParaEditar(c);
    setIsModalEditOpen(true);
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={orgaoLogado ? nomesOrgaos[orgaoLogado] : ''}>{orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Carregando...'}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '12px', color: isAdmin ? '#28a745' : '#64748b', fontWeight: 'bold', backgroundColor: 'white', padding: '5px 10px', borderRadius: '4px' }}>
            {isAdmin ? '🛡️ Admin' : '👁️ Visualizador'}
          </span>
          <button className="btn-sair" onClick={() => { sessionStorage.clear(); navigate('/'); }}>
            Sair
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </header>

      <main className="conteudo">
        <div className="acoes-topo">
          <h2>Contratos Cadastrados</h2>
          <div style={{ position: 'relative', flex: 1, maxWidth: '600px', margin: '0 20px' }}>
            <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Buscar por Nº, CNPJ, Fornecedor, Objeto ou Fiscal..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={exportarParaExcel} className="btn-acao primario" style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              📊 Excel
            </button>
            <button onClick={() => setIsModalRelatorioOpen(true)} className="btn-cancelar">📄 PDF</button>
            
            {/* Esconde botão Novo Contrato se não for Admin */}
            {isAdmin && <button onClick={() => setIsModalOpen(true)} className="btn-salvar">Novo Contrato</button>}
          </div>
        </div>

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
              <th onClick={() => lidarComOrdenacao('cnpjFornecedor')} style={{ cursor: 'pointer' }}>CNPJ {renderSeta('cnpjFornecedor')}</th>
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
                const styleVencimento = getRowStyle(c.dataFim);
                const isVencido = styleVencimento.backgroundColor === '#64748b'; 
                
                return (
                  <tr key={c.id} style={styleVencimento} title={getRowTitle(c.dataFim)}>
                    <td>
                      <span style={{ fontWeight: 'bold' }}>{c.numeroContrato}</span>
                      {c.aditivos && c.aditivos.length > 0 && (
                        <span style={{ marginLeft: '8px', fontSize: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 6px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }} title={`${c.aditivos.length} aditivo(s) registado(s)`}>📝 +{c.aditivos.length}</span>
                      )}
                    </td>
                    <td>{c.objetoResumido}</td>
                    <td>{c.fornecedor}</td>
                    <td>{c.cnpjFornecedor || '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatarDataBr(c.dataFim)}</td>
                    <td style={{ fontWeight: 'bold', color: isVencido ? '#ffffff' : '#004a99' }}>{Number(c.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>{c.fiscalContrato || '-'}</td>
                    <td style={{ display: 'flex', gap: '5px' }}>
                      <button style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => navigate(`/contrato/${c.id}`)}>Detalhes</button>
                      
                      {/* Esconde os botões sensíveis se não for Admin */}
                      {isAdmin && <button style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => abrirEdicao(c)}>✏️</button>}
                      {isAdmin && <button style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => excluirContrato(c.id!)} disabled={loading}>🗑️</button>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </main>

      {isAdmin && <ModalNovoContrato isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} orgaoLogado={orgaoLogado} />}
      {isAdmin && <ModalEditarContrato isOpen={isModalEditOpen} onClose={() => setIsModalEditOpen(false)} contratoOriginal={contratoParaEditar} />}
      
      <ModalRelatorioGlobal 
        isOpen={isModalRelatorioOpen} onClose={() => setIsModalRelatorioOpen(false)}
        opcIncluirAditivos={opcIncluirAditivos} setOpcIncluirAditivos={setOpcIncluirAditivos}
        gerarRelatorioPDF={gerarRelatorioPDF}
      />
    </div>
  );
}