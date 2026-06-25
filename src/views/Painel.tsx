// src/views/Painel.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Contrato } from '../types/types';
import logo from '../assets/logopmp.png';
import './Painel.css';

import { formatarDataBr } from '../utils/formatters';

// IMPORTAÇÃO DOS COMPONENTES MODULARES
import ModalNovoContrato from '../components/Painel/ModalNovoContrato';
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';
import ModalRelatorioGlobal from '../components/Painel/ModalRelatorioGlobal'; // NOVO MODAL
import { useContratos } from '../hooks/useContratos';

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');

  const { 
    contratosFiltrados, 
    loading, 
    termoBusca, 
    setTermoBusca, 
    ordenacao, 
    lidarComOrdenacao, 
    excluirContrato 
  } = useContratos(orgaoLogado);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [contratoParaEditar, setContratoParaEditar] = useState<Contrato | null>(null);

  // NOVOS ESTADOS PARA O RELATÓRIO
  const [isModalRelatorioOpen, setIsModalRelatorioOpen] = useState(false);
  const [opcIncluirSaldo, setOpcIncluirSaldo] = useState(true);
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
    const hoje = new Date();
    const vencimento = new Date(dataFim);
    const diffEmDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffEmDias <= 30) return { backgroundColor: '#ffd5d5', color: '#900' }; 
    if (diffEmDias <= 90) return { backgroundColor: '#fff9c4', color: '#856404' }; 
    return {};
  };

  const getRowTitle = (dataFim: string) => {
    if (!dataFim) return "";
    const hoje = new Date();
    const vencimento = new Date(dataFim);
    const diffEmDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffEmDias < 0) return "Contrato Vencido";
    if (diffEmDias <= 30) return "Atenção: Vencimento em menos de 30 dias";
    if (diffEmDias <= 90) return "Aviso: Vencimento em menos de 3 meses";
    return "";
  };

  const renderSeta = (campo: string) => {
    if (ordenacao.campo !== campo) return <span style={{ color: '#ccc', marginLeft: '5px' }}>↕</span>;
    return <span style={{ marginLeft: '5px' }}>{ordenacao.direcao === 'asc' ? '▲' : '▼'}</span>;
  };

  const gerarRelatorioPDF = () => {
    setIsModalRelatorioOpen(false); // Fecha o modal após o clique

    const docPdf = new jsPDF('landscape'); 
    
    const gerarTabela = () => {
      docPdf.setFontSize(16); docPdf.setTextColor(0, 74, 153);
      docPdf.text(orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Relatório de Contratos', 45, 20);
      docPdf.setFontSize(11); docPdf.setTextColor(100, 100, 100);
      const textoFiltro = termoBusca ? ` (Filtro aplicado: "${termoBusca}")` : '';
      docPdf.text(`Listagem Geral de Contratos${textoFiltro} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 45, 28);
      
      // Cabeçalhos Dinâmicos
      const headRow = ['Nº Contrato', 'Objeto', 'Fornecedor', 'Fiscal', 'Validade', 'Valor Global'];
      if (opcIncluirSaldo) {
        headRow.push('Saldo Atual');
      }

      // Corpo Dinâmico (Com suporte a linhas de Aditivos combinadas)
      type TableCell = string | { content: string, colSpan: number, styles: any };
      const tableData: TableCell[][] = [];

      contratosFiltrados.forEach(c => {
        const vTotal = Number(c.valorTotal) || 0;
        const sContrato = c.saldoContrato !== undefined ? Number(c.saldoContrato) : vTotal;

        const rowData: TableCell[] = [
          c.numeroContrato || '-',
          c.objetoCompleto || c.objetoResumido || '-',
          c.fornecedor || '-',
          c.fiscalContrato || 'Não inf.',
          formatarDataBr(c.dataFim),
          vTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ];

        if (opcIncluirSaldo) {
          rowData.push(sContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        }

        tableData.push(rowData);

        // Se o utilizador pediu aditivos, inserimos uma sub-linha para cada aditivo
        if (opcIncluirAditivos && c.aditivos && c.aditivos.length > 0) {
          c.aditivos.forEach(ad => {
            const strValidade = ad.novaDataFim ? formatarDataBr(ad.novaDataFim) : 'N/A';
            const strValor = ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
            const desc = `↳ ADITIVO: ${ad.descricao} | Tipo: ${ad.tipo.toUpperCase()} | Assinatura: ${formatarDataBr(ad.dataAditivo)} | Nova Validade: ${strValidade} | Valor Aditivado/Suprimido: ${strValor}`;

            tableData.push([
              { 
                content: desc, 
                colSpan: headRow.length, 
                styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'italic', cellPadding: 3 } 
              }
            ]);
          });
        }
      });

      // Configuração das larguras dependendo de quantas colunas existem
      const colStyles: any = { 
        0: { halign: 'center', cellWidth: 25 }, 
        4: { halign: 'center', cellWidth: 22 }, 
        5: { halign: 'right', cellWidth: opcIncluirSaldo ? 26 : 32 } 
      };
      if (opcIncluirSaldo) {
        colStyles[6] = { halign: 'right', cellWidth: 26 };
      }

      autoTable(docPdf, {
        startY: 40,
        head: [headRow],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 74, 153] },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: colStyles
      });

      const pdfBlob = docPdf.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    };

    const img = new Image();
    img.src = logo;
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
        <button className="btn-sair" onClick={() => { sessionStorage.clear(); navigate('/'); }}>
          Sair
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </header>

      <main className="conteudo">
        <div className="acoes-topo">
          <h2>Contratos Cadastrados</h2>
          <div style={{ position: 'relative', flex: 1, maxWidth: '600px', margin: '0 20px' }}>
            <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Buscar por Nº do Contrato, Fornecedor, Objeto ou Fiscal..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* O BOTÃO AGORA CHAMA O MODAL EM VEZ DE GERAR O PDF DIRETAMENTE */}
            <button onClick={() => setIsModalRelatorioOpen(true)} className="btn-cancelar">📄 Relatório Geral</button>
            <button onClick={() => setIsModalOpen(true)} className="btn-salvar">Novo Contrato</button>
          </div>
        </div>

        <div className="legenda-container" style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '12px', color: '#666' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#ffd5d5', border: '1px solid #ff000033' }}></div> Vencimento em menos de 1 mês</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#fff9c4', border: '1px solid #ffc10733' }}></div> Vencimento em menos de 3 meses</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ color: '#e65100', fontWeight: 'bold' }}>⚠️</span> Saldo abaixo de 30%</div>
        </div>

        <table className="tabela-contratos">
          <thead>
            <tr>
              <th onClick={() => lidarComOrdenacao('numeroContrato')} style={{ cursor: 'pointer' }}>Nº Contrato {renderSeta('numeroContrato')}</th>
              <th onClick={() => lidarComOrdenacao('objetoResumido')} style={{ cursor: 'pointer' }}>Objeto Resumido {renderSeta('objetoResumido')}</th>
              <th onClick={() => lidarComOrdenacao('fornecedor')} style={{ cursor: 'pointer' }}>Fornecedor {renderSeta('fornecedor')}</th>
              <th onClick={() => lidarComOrdenacao('dataFim')} style={{ cursor: 'pointer' }}>Validade {renderSeta('dataFim')}</th>
              <th>Saldo Atual</th>
              <th>Última Atualização</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contratosFiltrados.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center' }}>{termoBusca ? 'Nenhum contrato encontrado.' : 'Nenhum contrato cadastrado.'}</td></tr>
            ) : (
              contratosFiltrados.map((c) => {
                const styleVencimento = getRowStyle(c.dataFim);
                
                const valorTotalNum = Number(c.valorTotal) || 0;
                const saldoContratoNum = c.saldoContrato !== undefined ? Number(c.saldoContrato) : valorTotalNum;
                
                const percentualSaldo = valorTotalNum > 0 ? (saldoContratoNum / valorTotalNum) : 1;
                const alertaSaldo = percentualSaldo < 0.3;

                return (
                  <tr key={c.id} style={styleVencimento} title={getRowTitle(c.dataFim)}>
                    <td style={{ fontWeight: 'bold' }}>{c.numeroContrato}</td>
                    <td>{c.objetoResumido}</td>
                    <td>{c.fornecedor}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatarDataBr(c.dataFim)}</td>
                    <td style={{ fontWeight: 'bold', color: alertaSaldo ? '#e65100' : (saldoContratoNum < 0 ? 'red' : 'green') }} title={alertaSaldo ? `Saldo crítico: restam apenas ${(percentualSaldo * 100).toFixed(1)}% do valor total` : ""}>
                      {alertaSaldo && <span>⚠️ </span>}
                      {saldoContratoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td>{c.dataUltimaAtualizacao || 'N/A'}</td>
                    <td style={{ display: 'flex', gap: '5px' }}>
                      <button style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => navigate(`/contrato/${c.id}`)}>Detalhes</button>
                      <button style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => abrirEdicao(c)}>✏️</button>
                      <button style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => excluirContrato(c.id!)} disabled={loading}>🗑️</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </main>

      {/* COMPONENTES MODULARES */}
      <ModalNovoContrato isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} orgaoLogado={orgaoLogado} />
      <ModalEditarContrato isOpen={isModalEditOpen} onClose={() => setIsModalEditOpen(false)} contratoOriginal={contratoParaEditar} />
      
      {/* NOVO COMPONENTE DO RELATÓRIO GLOBAL */}
      <ModalRelatorioGlobal 
        isOpen={isModalRelatorioOpen}
        onClose={() => setIsModalRelatorioOpen(false)}
        opcIncluirSaldo={opcIncluirSaldo}
        setOpcIncluirSaldo={setOpcIncluirSaldo}
        opcIncluirAditivos={opcIncluirAditivos}
        setOpcIncluirAditivos={setOpcIncluirAditivos}
        gerarRelatorioPDF={gerarRelatorioPDF}
      />
      
    </div>
  );
}