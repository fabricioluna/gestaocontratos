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

// IMPORTAÇÃO DOS NOSSOS NOVOS COMPONENTES MODULARIZADOS
import ModalNovoContrato from '../components/Painel/ModalNovoContrato';
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [contratoParaEditar, setContratoParaEditar] = useState<Contrato | null>(null);
  
  const [termoBusca, setTermoBusca] = useState('');
  
  // Como removemos a coluna "Ano" (que ordenava por dataInicio), o padrão inicial passa a ser numeroContrato
  const [ordenacao, setOrdenacao] = useState<{ campo: string, direcao: 'asc' | 'desc' }>({ campo: 'numeroContrato', direcao: 'desc' });

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
    'fme': 'Fundo Municipal de Educação (FME)',
    'fms': 'Fundo Municipal de Saúde (FMS)'
  };

  // FECHAR COM ESC
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

  // CARREGAR DADOS
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

  // --- ORDENAÇÃO INTELIGENTE ---
  const contratosOrdenados = [...contratos].sort((a, b) => {
    
    // Regra Específica para a coluna "Nº Contrato" (Smart Sort)
    if (ordenacao.campo === 'numeroContrato') {
      const extrairAnoNumero = (c: Contrato) => {
        const numStr = c.numeroContrato || '';
        const partes = numStr.split('/');
        
        let numero = 0;
        let ano = 0;
        
        if (partes.length > 0) {
          numero = parseInt(partes[0].replace(/\D/g, ''), 10) || 0;
        }
        
        if (partes.length > 1 && partes[1].replace(/\D/g, '').length >= 4) {
          ano = parseInt(partes[1].replace(/\D/g, '').substring(0, 4), 10) || 0;
        } else {
          if (c.dataInicio) {
            ano = parseInt(c.dataInicio.substring(0, 4), 10) || 0;
          }
        }
        return { ano, numero };
      };

      const valA = extrairAnoNumero(a);
      const valB = extrairAnoNumero(b);

      if (valA.ano !== valB.ano) {
        return ordenacao.direcao === 'asc' ? valA.ano - valB.ano : valB.ano - valA.ano;
      }
      return ordenacao.direcao === 'asc' ? valA.numero - valB.numero : valB.numero - valA.numero;
    }

    // Regra Padrão (Alfabética)
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
    const docPdf = new jsPDF('landscape'); 
    const gerarTabela = () => {
      docPdf.setFontSize(16); docPdf.setTextColor(0, 74, 153);
      docPdf.text(orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Relatório de Contratos', 45, 20);
      docPdf.setFontSize(11); docPdf.setTextColor(100, 100, 100);
      const textoFiltro = termoBusca ? ` (Filtro aplicado: "${termoBusca}")` : '';
      docPdf.text(`Listagem Geral de Contratos${textoFiltro} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 45, 28);
      
      const tableData = contratosFiltrados.map(c => [
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
        head: [['Nº Contrato', 'Objeto', 'Fornecedor', 'Fiscal', 'Validade', 'Valor Global', 'Saldo Atual']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 74, 153] },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 
          0: { halign: 'center', cellWidth: 25 }, 
          4: { halign: 'center', cellWidth: 22 }, 
          5: { halign: 'right', cellWidth: 30 }, 
          6: { halign: 'right', cellWidth: 30 } 
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
      } catch (error) { alert('Erro ao excluir contrato.'); } finally { setLoading(false); }
    }
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
            <button onClick={gerarRelatorioPDF} className="btn-cancelar">Relatório</button>
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
                const percentualSaldo = (c.saldoContrato / c.valorTotal);
                const alertaSaldo = percentualSaldo < 0.3;

                return (
                  <tr key={c.id} style={styleVencimento} title={getRowTitle(c.dataFim)}>
                    <td style={{ fontWeight: 'bold' }}>{c.numeroContrato}</td>
                    <td>{c.objetoResumido}</td>
                    <td>{c.fornecedor}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatarDataBr(c.dataFim)}</td>
                    <td style={{ fontWeight: 'bold', color: alertaSaldo ? '#e65100' : (c.saldoContrato < 0 ? 'red' : 'green') }} title={alertaSaldo ? `Saldo crítico: restam apenas ${(percentualSaldo * 100).toFixed(1)}% do valor total` : ""}>
                      {alertaSaldo && <span>⚠️ </span>}
                      {c.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
      
    </div>
  );
}