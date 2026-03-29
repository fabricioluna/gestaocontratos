// src/views/Painel.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './Painel.css';

import { formatarDataBr } from '../utils/formatters';

// IMPORTAÇÃO DOS COMPONENTES MODULARIZADOS
import ModalNovoContrato from '../components/Painel/ModalNovoContrato';
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  
  const [termoBusca, setTermoBusca] = useState('');
  
  // Guardamos apenas o contrato selecionado, o formulário é gerido pelo ModalEditarContrato
  const [contratoParaEditar, setContratoParaEditar] = useState<Contrato | null>(null);

  const [ordenacao, setOrdenacao] = useState<{ campo: string, direcao: 'asc' | 'desc' }>({ campo: 'dataInicio', direcao: 'desc' });

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
    'fme': 'Fundo Municipal de Educação (FME)',
    'fms': 'Fundo Municipal de Saúde (FMS)'
  };

  // --- MELHORIA UX: FECHAR COM ESC ---
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        setIsModalEditOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!orgaoLogado) { navigate('/'); return; }
    const q = query(collection(db, 'contratos'), where('orgaoId', '==', orgaoLogado));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Contrato[] = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() } as Contrato));
      setContratos(lista);
    });
    return () => unsubscribe();
  }, [orgaoLogado, navigate]);

  const lidarComOrdenacao = (campo: string) => {
    setOrdenacao(prev => ({ campo, direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc' }));
  };

  const contratosOrdenados = [...contratos].sort((a, b) => {
    let valorA: any = a[ordenacao.campo as keyof Contrato] || '';
    let valorB: any = b[ordenacao.campo as keyof Contrato] || '';
    if (typeof valorA === 'string') valorA = valorA.toLowerCase();
    if (typeof valorB === 'string') valorB = valorB.toLowerCase();
    if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
    if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
    return 0;
  });

  const contratosFiltrados = contratosOrdenados.filter((c) => {
    const termo = termoBusca.toLowerCase();
    return (
      (c.numeroContrato || '').toLowerCase().includes(termo) ||
      (c.fornecedor || '').toLowerCase().includes(termo) ||
      (c.objetoResumido || '').toLowerCase().includes(termo) ||
      (c.objetoCompleto || '').toLowerCase().includes(termo) ||
      (c.fiscalContrato || '').toLowerCase().includes(termo)
    );
  });

  // --- LÓGICA DE CORES POR VENCIMENTO ---
  const getRowStyle = (dataFim: string) => {
    if (!dataFim) return {};
    const hoje = new Date();
    const vencimento = new Date(dataFim);
    const diffEmMilissegundos = vencimento.getTime() - hoje.getTime();
    const diffEmDias = Math.ceil(diffEmMilissegundos / (1000 * 60 * 60 * 24));

    if (diffEmDias <= 30) return { backgroundColor: '#ffd5d5', color: '#900' }; 
    if (diffEmDias <= 90) return { backgroundColor: '#fff9c4', color: '#856404' }; 
    return {};
  };

  // --- IDENTIFICAÇÃO DO MOTIVO DO ALERTA (TOOLTIP) ---
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
    const docPdf = new jsPDF('landscape'); 
    const gerarTabela = () => {
      docPdf.setFontSize(16); docPdf.setTextColor(0, 74, 153);
      docPdf.text(orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Relatório de Contratos', 45, 20);
      docPdf.setFontSize(11); docPdf.setTextColor(100, 100, 100);
      const textoFiltro = termoBusca ? ` (Filtro aplicado: "${termoBusca}")` : '';
      docPdf.text(`Listagem Geral de Contratos${textoFiltro} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 45, 28);
      const tableData = contratosFiltrados.map(c => [
        c.dataInicio ? c.dataInicio.substring(0, 4) : '-',
        c.numeroContrato || '-',
        (c.objetoResumido || '').substring(0, 45) + ((c.objetoResumido?.length || 0) > 45 ? '...' : ''),
        (c.fornecedor || '').substring(0, 25) + ((c.fornecedor?.length || 0) > 25 ? '...' : ''),
        (c.fiscalContrato || 'Não inf.').substring(0, 20) + ((c.fiscalContrato?.length || 0) > 20 ? '...' : ''),
        formatarDataBr(c.dataFim),
        (c.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        (c.saldoContrato || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);
      autoTable(docPdf, {
        startY: 40,
        head: [['Ano', 'Nº Contrato', 'Objeto', 'Fornecedor', 'Fiscal', 'Validade', 'Valor Global', 'Saldo Atual']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 74, 153] },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 
          0: { halign: 'center', cellWidth: 12 }, 
          1: { halign: 'center', cellWidth: 20 }, 
          5: { halign: 'center', cellWidth: 20 }, 
          6: { halign: 'right', cellWidth: 30 },  
          7: { halign: 'right', cellWidth: 30 }   
        }
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

  const excluirContrato = async (contratoId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este contrato e todos os itens vinculados?')) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', contratoId));
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', contratoId));
        const querySnapshot = await getDocs(qItens);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((itemDoc) => { batch.delete(itemDoc.ref); });
          await batch.commit();
        }
        alert('Contrato excluído com sucesso!');
      } catch (error) {
        console.error(error);
        alert('Erro ao excluir contrato.');
      } finally { setLoading(false); }
    }
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={orgaoLogado ? nomesOrgaos[orgaoLogado] : ''}>{orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Carregando...'}</h2>
        </div>
        <button className="btn-sair" onClick={() => { sessionStorage.clear(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Sair
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </header>

      <main className="conteudo">
        <div className="acoes-topo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', marginBottom: '24px', backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', border: '1px solid #eaeaea' }}>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600', whiteSpace: 'nowrap' }}>Contratos Cadastrados</h2>
          <div style={{ position: 'relative', flex: 1, maxWidth: '600px' }}>
            <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Buscar por Nº do Contrato, Fornecedor, Objeto ou Fiscal..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', fontSize: '14px', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }} onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.backgroundColor = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }} onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={gerarRelatorioPDF} style={{ backgroundColor: '#ffffff', color: '#475569', padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Relatório
            </button>
            <button onClick={() => setIsModalOpen(true)} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)', transition: 'background-color 0.2s ease', whiteSpace: 'nowrap' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Novo Contrato
            </button>
          </div>
        </div>

        {/* BARRA DE LEGENDA PARA AUXÍLIO DO UTILIZADOR */}
        <div className="legenda-container" style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '12px', color: '#666', padding: '0 5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#ffd5d5', border: '1px solid #ff000033', borderRadius: '2px' }}></div>
            Vencimento em menos de 1 mês
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#fff9c4', border: '1px solid #ffc10733', borderRadius: '2px' }}></div>
            Vencimento em menos de 3 meses
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ color: '#e65100', fontWeight: 'bold' }}>⚠️</span>
            Saldo abaixo de 30%
          </div>
        </div>

        <table className="tabela-contratos">
          <thead>
            <tr>
              <th onClick={() => lidarComOrdenacao('dataInicio')} style={{ cursor: 'pointer', userSelect: 'none' }}>Ano {renderSeta('dataInicio')}</th>
              <th onClick={() => lidarComOrdenacao('numeroContrato')} style={{ cursor: 'pointer', userSelect: 'none' }}>Nº Contrato {renderSeta('numeroContrato')}</th>
              <th onClick={() => lidarComOrdenacao('objetoResumido')} style={{ cursor: 'pointer', userSelect: 'none' }}>Objeto Resumido {renderSeta('objetoResumido')}</th>
              <th onClick={() => lidarComOrdenacao('fornecedor')} style={{ cursor: 'pointer', userSelect: 'none' }}>Fornecedor {renderSeta('fornecedor')}</th>
              <th onClick={() => lidarComOrdenacao('dataFim')} style={{ cursor: 'pointer', userSelect: 'none' }}>Validade {renderSeta('dataFim')}</th>
              <th>Saldo Atual</th>
              <th>Última Atualização</th>
              <th style={{ minWidth: '240px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contratosFiltrados.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>{termoBusca ? 'Nenhum contrato encontrado.' : 'Nenhum contrato cadastrado.'}</td></tr>
            ) : (
              contratosFiltrados.map((c) => {
                const styleVencimento = getRowStyle(c.dataFim);
                const percentualSaldo = (c.saldoContrato / c.valorTotal);
                const alertaSaldo = percentualSaldo < 0.3;

                return (
                  <tr key={c.id} style={styleVencimento} title={getRowTitle(c.dataFim)}>
                    <td>{c.dataInicio.substring(0, 4)}</td>
                    <td>{c.numeroContrato}</td>
                    <td>{c.objetoResumido}</td>
                    <td>{c.fornecedor}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatarDataBr(c.dataFim)}</td>
                    <td style={{ 
                      fontWeight: 'bold', 
                      color: alertaSaldo ? '#e65100' : (c.saldoContrato < 0 ? 'red' : 'green') 
                    }}
                    title={alertaSaldo ? `Saldo crítico: restam apenas ${(percentualSaldo * 100).toFixed(1)}% do valor total` : ""}
                    >
                      {alertaSaldo && <span>⚠️ </span>}
                      {c.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td>{c.dataUltimaAtualizacao || 'N/A'}</td>
                    <td style={{ display: 'flex', gap: '5px' }}>
                      <button style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => navigate(`/contrato/${c.id}`)}>Detalhes</button>
                      <button style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => abrirEdicao(c)}>✏️ Editar</button>
                      <button style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => excluirContrato(c.id!)} disabled={loading}>🗑️ Excluir</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </main>

      {/* MODAIS MODULARIZADOS (MUITO MAIS LIMPO!) */}
      
      <ModalNovoContrato 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        orgaoLogado={orgaoLogado} 
      />

      <ModalEditarContrato 
        isOpen={isModalEditOpen}
        onClose={() => setIsModalEditOpen(false)}
        contratoOriginal={contratoParaEditar}
      />
      
    </div>
  );
}