// src/views/Painel.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, onSnapshot, writeBatch, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth'; 
import * as pdfjsLib from 'pdfjs-dist'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './Painel.css';

import { parseMoeda, extrairNumeroPlanilha, formatarDataBr } from '../utils/formatters';
import { extrairDadosContratoComIA } from '../services/geminiService';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null); 

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  
  const [termoBusca, setTermoBusca] = useState('');

  const [formData, setFormData] = useState({
    numeroContrato: '', numeroProcesso: '', modalidade: '', numeroModalidade: '', numeroAta: '',
    fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '',
    dataFim: '', valorTotal: '', fiscalContrato: '', observacao: ''
  });

  const [formEdit, setFormEdit] = useState<any>({});
  const [contratoEditId, setContratoEditId] = useState<string>('');

  const [itensPrevia, setItensPrevia] = useState<any[]>([]);
  const [formItem, setFormItem] = useState({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });

  const [ordenacao, setOrdenacao] = useState<{ campo: string, direcao: 'asc' | 'desc' }>({ campo: 'dataInicio', direcao: 'desc' });

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
    'fme': 'Fundo Municipal de Educação (FME)',
    'fms': 'Fundo Municipal de Saúde (FMS)'
  };

  // --- NOVA FUNCIONALIDADE: FECHAR COM ESC ---
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        setIsModalEditOpen(false);
        setItensPrevia([]);
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

  const renderSeta = (campo: string) => {
    if (ordenacao.campo !== campo) return <span style={{ color: '#ccc', marginLeft: '5px' }}>↕</span>;
    return <span style={{ marginLeft: '5px' }}>{ordenacao.direcao === 'asc' ? '▲' : '▼'}</span>;
  };

  const lidarComMudanca = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const lidarComMudancaEdit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormEdit((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const lidarComMudancaItem = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormItem((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const formatarTresDigitos = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value && /^\d+$/.test(value)) {
      setFormData((prev: any) => ({ ...prev, [name]: value.padStart(3, '0') }));
      if (isModalEditOpen) setFormEdit((prev: any) => ({ ...prev, [name]: value.padStart(3, '0') }));
    }
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

  const importarContratoArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let textoCompleto = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          textoCompleto += strings.join(" ") + "\n";
        }
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        textoCompleto = result.value;
      }
      const textoLimpo = textoCompleto.replace(/\s+/g, ' ');
      const dadosIA = await extrairDadosContratoComIA(textoLimpo);
      setFormData(prev => ({
        ...prev,
        numeroContrato: dadosIA.numeroContrato || prev.numeroContrato,
        numeroProcesso: dadosIA.numeroProcesso || prev.numeroProcesso,
        numeroModalidade: dadosIA.numeroPregao || prev.numeroModalidade,
        numeroAta: dadosIA.numeroAta || prev.numeroAta,
        fornecedor: dadosIA.fornecedor || prev.fornecedor,
        objetoCompleto: dadosIA.objetoCompleto || prev.objetoCompleto,
        objetoResumido: dadosIA.objetoResumido || prev.objetoResumido,
        valorTotal: dadosIA.valorTotal ? dadosIA.valorTotal.toFixed(2).replace('.', ',') : prev.valorTotal,
        fiscalContrato: dadosIA.fiscalContrato || prev.fiscalContrato,
        dataInicio: dadosIA.dataInicio || prev.dataInicio,
        dataFim: dadosIA.dataFim || prev.dataFim
      }));
      if (dadosIA.itens && dadosIA.itens.length > 0) {
        setItensPrevia(dadosIA.itens);
        alert(`Gemini AI analisou com sucesso! ${dadosIA.itens.length} itens do catálogo foram perfeitamente importados.`);
      } else {
        alert("O Gemini extraiu os dados do contrato, mas não encontrou uma tabela de itens clara.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao processar o documento com a Inteligência Artificial. Verifique o console.");
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const adicionarItemPrevia = () => {
    const qtd = parseMoeda(formItem.quantidade);
    const vUnit = parseMoeda(formItem.valorUnitario);
    if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) return alert("Preencha descrição, quantidade e valor corretamente.");
    const novoItem = {
      numeroLote: formItem.numeroLote || 'Único',
      numeroItem: formItem.numeroItem || String(itensPrevia.length + 1),
      discriminacao: formItem.discriminacao,
      unidade: formItem.unidade || 'UND',
      quantidade: qtd, valorUnitario: vUnit, valorTotalItem: qtd * vUnit
    };
    setItensPrevia([...itensPrevia, novoItem]);
    const novoTotal = parseMoeda(formData.valorTotal) + novoItem.valorTotalItem;
    setFormData({ ...formData, valorTotal: novoTotal.toFixed(2).replace('.', ',') });
    setFormItem({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });
  };

  const removerItemPrevia = (index: number) => {
    const itemRemovido = itensPrevia[index];
    const novoTotal = parseMoeda(formData.valorTotal) - itemRemovido.valorTotalItem;
    setFormData({ ...formData, valorTotal: novoTotal > 0 ? novoTotal.toFixed(2).replace('.', ',') : '' });
    setItensPrevia(itensPrevia.filter((_, i) => i !== index));
  };

  const importarPlanilhaPrevia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let somaImportacao = 0;
        const novosItens: any[] = [];
        data.forEach((row: any) => {
          const linha: any = {};
          for (const key in row) linha[key.trim().toUpperCase()] = row[key];
          const numeroLote = String(linha['LOTE'] || 'Único'); 
          const numeroItem = String(linha['ITEM'] || '');
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || '');
          const unidade = String(linha['UNIDADE'] || linha['UND.'] || linha['UND'] || 'UND');
          const quantidade = extrairNumeroPlanilha(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = extrairNumeroPlanilha(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND'] || linha['VL. UNIT.'] || linha['VL. UNIT'] || linha['VL UNIT.']) || 0;
          const valorTotalItem = quantidade * valorUnitario;
          if (discriminacao && quantidade > 0) {
            novosItens.push({ numeroLote, numeroItem, discriminacao, unidade, quantidade, valorUnitario, valorTotalItem });
            somaImportacao += valorTotalItem;
          }
        });
        if (novosItens.length > 0) {
          setItensPrevia([...itensPrevia, ...novosItens]);
          const novoTotal = parseMoeda(formData.valorTotal) + somaImportacao;
          setFormData({ ...formData, valorTotal: novoTotal.toFixed(2).replace('.', ',') });
          alert(`${novosItens.length} itens carregados no catálogo!`);
        } else { alert('Nenhum item válido encontrado.'); }
      } catch (error) { alert("Erro ao ler planilha."); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const salvarContratoCompleto = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const valorGlobalNum = parseMoeda(formData.valorTotal);
      const dataAtual = new Date().toLocaleString('pt-BR');
      const contratoRef = await addDoc(collection(db, 'contratos'), {
        ...formData,
        orgaoId: orgaoLogado,
        valorTotal: valorGlobalNum,
        saldoContrato: valorGlobalNum,
        dataUltimaAtualizacao: dataAtual
      });
      if (itensPrevia.length > 0) {
        const batch = writeBatch(db);
        itensPrevia.forEach(item => {
          const itemRef = doc(collection(db, 'itens'));
          batch.set(itemRef, { ...item, contratoId: contratoRef.id, dataAdicao: dataAtual, tipoRegistro: 'catalogo' });
        });
        await batch.commit();
      }
      alert('Contrato e catálogo salvos com sucesso!');
      setIsModalOpen(false);
      setFormData({ numeroContrato: '', numeroProcesso: '', modalidade: '', numeroModalidade: '', numeroAta: '', fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '', dataFim: '', valorTotal: '', fiscalContrato: '', observacao: '' });
      setItensPrevia([]);
    } catch (error) { alert('Erro ao salvar.'); } finally { setLoading(false); }
  };

  const abrirEdicao = (c: Contrato) => {
    setContratoEditId(c.id!);
    setFormEdit({ 
      ...c, 
      valorTotal: c.valorTotal.toFixed(2).replace('.', ','),
      modalidade: c.modalidade || '',
      numeroModalidade: c.numeroModalidade || c.numeroPregao || ''
    });
    setIsModalEditOpen(true);
  };

  const salvarEdicaoContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoEditId) return;
    setLoading(true);
    try {
      const novoValorGlobal = parseMoeda(formEdit.valorTotal);
      const contratoOriginal = contratos.find(c => c.id === contratoEditId);
      if(contratoOriginal) {
        const valorJaConsumido = contratoOriginal.valorTotal - contratoOriginal.saldoContrato;
        const novoSaldo = novoValorGlobal - valorJaConsumido;
        await updateDoc(doc(db, 'contratos', contratoEditId), {
          ...formEdit, valorTotal: novoValorGlobal, saldoContrato: novoSaldo, dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
        });
      }
      alert('Contrato atualizado com sucesso!');
      setIsModalEditOpen(false);
    } catch (error) { alert("Erro ao editar contrato."); } finally { setLoading(false); }
  };

  const excluirContrato = async (contratoId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este contrato e todos os itens vinculados a ele? Esta ação não pode ser desfeita.')) {
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
          <h2 title={orgaoLogado ? nomesOrgaos[orgaoLogado] : ''}>
            {orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Carregando...'}
          </h2>
        </div>
        <button className="btn-sair" onClick={() => { sessionStorage.clear(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Sair
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
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
            <button onClick={gerarRelatorioPDF} style={{ backgroundColor: '#ffffff', color: '#475569', padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#475569'; }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Gerar Relatório
            </button>
            <button onClick={() => setIsModalOpen(true)} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)', transition: 'background-color 0.2s ease', whiteSpace: 'nowrap' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Novo Contrato
            </button>
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
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>{termoBusca ? 'Nenhum contrato encontrado para essa busca.' : 'Nenhum contrato cadastrado.'}</td></tr>
            ) : (
              contratosFiltrados.map((c) => (
                <tr key={c.id}>
                  <td>{c.dataInicio.substring(0, 4)}</td>
                  <td>{c.numeroContrato}</td>
                  <td>{c.objetoResumido}</td>
                  <td>{c.fornecedor}</td>
                  <td style={{ fontWeight: 'bold' }}>{formatarDataBr(c.dataFim)}</td>
                  <td style={{ fontWeight: 'bold', color: c.saldoContrato < 0 ? 'red' : 'green' }}>
                    {c.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td>{c.dataUltimaAtualizacao || 'N/A'}</td>
                  <td style={{ display: 'flex', gap: '5px' }}>
                    <button style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => navigate(`/contrato/${c.id}`)}>Ver Detalhes</button>
                    <button style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => abrirEdicao(c)}>✏️ Editar</button>
                    <button style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => excluirContrato(c.id!)} disabled={loading}>🗑️ Excluir</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>

      {/* --- MODAL NOVO CONTRATO (COM OVERLAY CLICÁVEL) --- */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsModalOpen(false); setItensPrevia([]); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Cadastrar Novo Contrato</h2>
              <div>
                <input type="file" accept=".docx, .pdf" ref={docInputRef} onChange={importarContratoArquivo} style={{ display: 'none' }} id="upload-doc" />
                <label htmlFor="upload-doc" style={{ backgroundColor: '#20c997', color: 'white', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                  {loading ? 'A processar IA...' : '✨ Auto-Preencher com IA (Gemini)'}
                </label>
              </div>
            </div>
            
            <form onSubmit={salvarContratoCompleto}>
              <h3 style={{ color: '#555', marginTop: 0 }}>1. Dados Gerais</h3>
              <div className="form-grid">
                <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formData.numeroContrato} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
                <div className="form-group"><label>Nº do Processo</label><input type="text" name="numeroProcesso" required value={formData.numeroProcesso} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
                
                <div className="form-group">
                  <label>Modalidade</label>
                  <select name="modalidade" value={formData.modalidade} onChange={lidarComMudanca} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', height: '36px' }}>
                    <option value="">Selecione...</option>
                    <option value="Pregão">Pregão</option>
                    <option value="Concorrência">Concorrência</option>
                    <option value="Dispensa">Dispensa</option>
                    <option value="Inexigibilidade">Inexigibilidade</option>
                    <option value="Credenciamento">Credenciamento</option>
                  </select>
                </div>
                <div className="form-group"><label>Nº da Modalidade</label><input type="text" name="numeroModalidade" value={formData.numeroModalidade} onChange={lidarComMudanca} onBlur={formatarTresDigitos} placeholder="Ex: 001/2024" /></div>

                <div className="form-group"><label>Nº da Ata</label><input type="text" name="numeroAta" value={formData.numeroAta} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
                <div className="form-group full-width"><label>Fornecedor</label><input type="text" name="fornecedor" required value={formData.fornecedor} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label>Objeto Resumido</label><input type="text" name="objetoResumido" required value={formData.objetoResumido} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label>Objeto Completo</label><textarea name="objetoCompleto" rows={2} value={formData.objetoCompleto} onChange={lidarComMudanca}></textarea></div>
                <div className="form-group"><label>Data Início</label><input type="date" name="dataInicio" required value={formData.dataInicio} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Data Fim (Validade)</label><input type="date" name="dataFim" required value={formData.dataFim} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Fiscal do Contrato</label><input type="text" name="fiscalContrato" value={formData.fiscalContrato} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Observação</label><input type="text" name="observacao" value={formData.observacao} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label style={{ color: '#004a99', fontSize: '15px' }}>Valor Global do Contrato (R$)</label><input type="text" name="valorTotal" required value={formData.valorTotal} onChange={lidarComMudanca} style={{ border: '2px solid #004a99', fontWeight: 'bold' }} /></div>
              </div>

              <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px', marginTop: '30px' }}>2. Catálogo de Itens do Contrato (Opcional)</h3>
              <p style={{ fontSize: '12px', color: '#666' }}>Estes itens formarão o catálogo. Eles <strong>não consumirão o saldo inicial</strong>.</p>
              <div className="secao-itens-modal">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}>
                  <div className="form-group"><input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="discriminacao" placeholder="Descrição" value={formItem.discriminacao} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="quantidade" placeholder="Qtd" value={formItem.quantidade} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="valorUnitario" placeholder="R$ Unit" value={formItem.valorUnitario} onChange={lidarComMudancaItem} /></div>
                  <button type="button" onClick={adicionarItemPrevia} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add</button>
                </div>
                <div style={{ margin: '15px 0', textAlign: 'center' }}><strong>OU</strong></div>
                <input type="file" accept=".xlsx" ref={fileInputRef} onChange={importarPlanilhaPrevia} style={{ display: 'none' }} id="upload-previa" />
                <label htmlFor="upload-previa" style={{ display: 'block', textAlign: 'center', backgroundColor: '#28a745', color: 'white', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>📄 Importar Catálogo do Excel</label>
              </div>

              {itensPrevia.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                  <table className="tabela-previa">
                    <thead><tr><th>Lote</th><th>Item</th><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th><th>Ação</th></tr></thead>
                    <tbody>
                      {itensPrevia.map((item, index) => (
                        <tr key={index}>
                          <td>{item.numeroLote}</td><td>{item.numeroItem}</td><td>{item.discriminacao}</td><td>{item.quantidade}</td>
                          <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td><button type="button" onClick={() => removerItemPrevia(index)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>❌</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="modal-acoes">
                <button type="button" className="btn-cancelar" onClick={() => { setIsModalOpen(false); setItensPrevia([]); }}>Cancelar</button>
                <button type="submit" className="btn-salvar" disabled={loading}>{loading ? 'A Guardar...' : 'Salvar Contrato'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR CONTRATO (COM OVERLAY CLICÁVEL) --- */}
      {isModalEditOpen && (
        <div className="modal-overlay" onClick={() => setIsModalEditOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Editar Dados do Contrato</h2>
            <form onSubmit={salvarEdicaoContrato}>
              <div className="form-grid">
                <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formEdit.numeroContrato} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} /></div>
                <div className="form-group"><label>Nº do Processo</label><input type="text" name="numeroProcesso" required value={formEdit.numeroProcesso} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} /></div>
                
                <div className="form-group">
                  <label>Modalidade</label>
                  <select name="modalidade" value={formEdit.modalidade} onChange={lidarComMudancaEdit} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', height: '36px' }}>
                    <option value="">Selecione...</option>
                    <option value="Pregão">Pregão</option>
                    <option value="Concorrência">Concorrência</option>
                    <option value="Dispensa">Dispensa</option>
                    <option value="Inexigibilidade">Inexigibilidade</option>
                    <option value="Credenciamento">Credenciamento</option>
                  </select>
                </div>
                <div className="form-group"><label>Nº da Modalidade</label><input type="text" name="numeroModalidade" value={formEdit.numeroModalidade} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} /></div>

                <div className="form-group"><label>Nº da Ata</label><input type="text" name="numeroAta" value={formEdit.numeroAta} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} /></div>
                <div className="form-group full-width"><label>Fornecedor</label><input type="text" name="fornecedor" required value={formEdit.fornecedor} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group full-width"><label>Objeto Resumido</label><input type="text" name="objetoResumido" required value={formEdit.objetoResumido} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group full-width"><label>Objeto Completo</label><textarea name="objetoCompleto" rows={2} value={formEdit.objetoCompleto} onChange={lidarComMudancaEdit}></textarea></div>
                <div className="form-group"><label>Data Início</label><input type="date" name="dataInicio" required value={formEdit.dataInicio} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Data Fim (Validade)</label><input type="date" name="dataFim" required value={formEdit.dataFim} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Fiscal do Contrato</label><input type="text" name="fiscalContrato" value={formEdit.fiscalContrato} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Observação</label><input type="text" name="observacao" value={formEdit.observacao} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group full-width"><label>Valor Global do Contrato (R$)</label><input type="text" name="valorTotal" required value={formEdit.valorTotal} onChange={lidarComMudancaEdit} style={{ border: '2px solid #ffc107', fontWeight: 'bold' }} /></div>
              </div>
              <div className="modal-acoes"><button type="button" className="btn-cancelar" onClick={() => setIsModalEditOpen(false)}>Cancelar</button><button type="submit" className="btn-salvar" disabled={loading} style={{ backgroundColor: '#ffc107', color: '#333' }}>{loading ? 'A Guardar...' : 'Salvar Alterações'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}