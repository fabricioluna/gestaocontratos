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

// Utilitários
import { formatarDataBr } from '../utils/formatters';

// Componentes Modularizados
import ModalNovoContrato from '../components/Painel/ModalNovoContrato';
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');

  // Estados de Dados
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: string, direcao: 'asc' | 'desc' }>({ campo: 'dataInicio', direcao: 'desc' });

  // Estados de Controlo dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
    'fme': 'Fundo Municipal de Educação (FME)',
    'fms': 'Fundo Municipal de Saúde (FMS)'
  };

  // Listener em tempo real do Firestore
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

  // Lógica de Ordenação
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

  // Lógica de Filtro
  const contratosFiltrados = contratosOrdenados.filter((c) => {
    if (!termoBusca) return true;
    const termo = termoBusca.toLowerCase();
    return (
      (c.numeroContrato || '').toLowerCase().includes(termo) ||
      (c.fornecedor || '').toLowerCase().includes(termo) ||
      (c.objetoResumido || '').toLowerCase().includes(termo)
    );
  });

  const renderSeta = (campo: string) => {
    if (ordenacao.campo !== campo) return <span style={{ color: '#ccc', marginLeft: '5px' }}>↕</span>;
    return <span style={{ marginLeft: '5px' }}>{ordenacao.direcao === 'asc' ? '▲' : '▼'}</span>;
  };

  // Ações de Interface
  const abrirEdicao = (c: Contrato) => {
    setContratoSelecionado(c);
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
      } finally {
        setLoading(false);
      }
    }
  };

  const verificarStatusVencimento = (dataFim: string) => {
    if (!dataFim) return 'normal';
    const fim = new Date(dataFim + 'T00:00:00');
    const hoje = new Date();
    const diferencaTempo = fim.getTime() - hoje.getTime();
    const diasFaltando = Math.ceil(diferencaTempo / (1000 * 3600 * 24));
    if (diasFaltando <= 30) return 'critico';
    if (diasFaltando <= 90) return 'alerta';
    return 'normal';
  };

  const nomeOrgaoFormatado = orgaoLogado ? nomesOrgaos[orgaoLogado] : 'A carregar...';

  // Gerador de Relatório Geral
  const gerarPDFContratos = () => {
    const docPdf = new jsPDF('landscape');
    const img = new Image();
    img.src = logo;
    img.onload = () => {
      docPdf.addImage(img, 'PNG', 14, 10, 25, 25);
      docPdf.setFontSize(16); docPdf.setTextColor(0, 74, 153);
      docPdf.text(nomeOrgaoFormatado, 45, 20);
      docPdf.setFontSize(12); docPdf.setTextColor(100, 100, 100);
      docPdf.text('Relatório Geral de Contratos Ativos', 45, 28);
      docPdf.setFontSize(10);
      docPdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 45, 34);

      autoTable(docPdf, {
        startY: 42,
        head: [['Ano', 'Nº Contrato', 'Modalidade/Licitação', 'Objeto', 'Fornecedor', 'Validade', 'Valor Contrato', 'Saldo Atual']],
        body: contratosFiltrados.map(c => [
          c.dataInicio.substring(0, 4),
          c.numeroContrato,
          `${c.modalidade || '-'} Nº ${c.numeroPregao || '-'}`,
          c.objetoResumido.length > 35 ? c.objetoResumido.substring(0, 32) + '...' : c.objetoResumido,
          c.fornecedor.length > 25 ? c.fornecedor.substring(0, 22) + '...' : c.fornecedor,
          formatarDataBr(c.dataFim),
          c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          c.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 74, 153], textColor: 255 },
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 248, 250] }
      });

      const pdfBlob = docPdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    };
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={nomeOrgaoFormatado}>{nomeOrgaoFormatado}</h2>
        </div>
        <button className="btn-sair" onClick={() => { sessionStorage.clear(); navigate('/'); }}>
          <span>Sair</span>
        </button>
      </header>

      <main className="conteudo">
        <div className="acoes-topo">
          <h2>Contratos Cadastrados</h2>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar por Nº, Fornecedor ou Objeto..." 
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="input-busca"
            />
            <button onClick={gerarPDFContratos} className="btn-relatorio">📄 Gerar Relatório</button>
            <button className="btn-novo" onClick={() => setIsModalOpen(true)}>+ Novo Contrato</button>
          </div>
        </div>

        <div className="tabela-container">
          <table className="tabela-contratos">
            <thead>
              <tr>
                <th onClick={() => lidarComOrdenacao('dataInicio')}>Ano {renderSeta('dataInicio')}</th>
                <th onClick={() => lidarComOrdenacao('numeroContrato')}>Nº {renderSeta('numeroContrato')}</th>
                <th onClick={() => lidarComOrdenacao('objetoResumido')}>Objeto {renderSeta('objetoResumido')}</th>
                <th onClick={() => lidarComOrdenacao('fornecedor')}>Fornecedor {renderSeta('fornecedor')}</th>
                <th onClick={() => lidarComOrdenacao('dataFim')}>Validade {renderSeta('dataFim')}</th>
                <th>Saldo Atual</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.map((c) => {
                const statusPrazo = verificarStatusVencimento(c.dataFim);
                const porcentagemSaldo = c.valorTotal > 0 ? (c.saldoContrato / c.valorTotal) * 100 : 0;
                
                return (
                  <tr key={c.id}>
                    <td>{c.dataInicio.substring(0, 4)}</td>
                    <td style={{ fontWeight: 'bold' }}>{c.numeroContrato}</td>
                    <td>{c.objetoResumido}</td>
                    <td>{c.fornecedor}</td>
                    <td className={`prazo-${statusPrazo}`}>
                      {formatarDataBr(c.dataFim)}
                    </td>
                    <td className={c.saldoContrato < 0 ? 'saldo-negativo' : 'saldo-positivo'}>
                      {c.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      {porcentagemSaldo <= 30 && c.saldoContrato > 0 && <span className="aviso-saldo">⚠️ Saldo &lt; 30%</span>}
                    </td>
                    <td className="td-acoes">
                      <button className="btn-ver" onClick={() => navigate(`/contrato/${c.id}`)}>Ver</button>
                      <button className="btn-editar-mini" onClick={() => abrirEdicao(c)}>✏️</button>
                      <button className="btn-excluir-mini" onClick={() => excluirContrato(c.id!)} disabled={loading}>🗑️</button>
                    </td>
                  </tr>
                )
              })}
              {contratosFiltrados.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>Nenhum contrato encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAIS MODULARIZADOS */}
      <ModalNovoContrato 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        orgaoLogado={orgaoLogado} 
      />

      <ModalEditarContrato 
        isOpen={isModalEditOpen} 
        onClose={() => setIsModalEditOpen(false)} 
        contrato={contratoSelecionado} 
      />
    </div>
  );
}