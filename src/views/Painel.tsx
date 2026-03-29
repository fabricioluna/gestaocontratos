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
    numeroContrato: '', numeroProcesso: '', modalidade: '', numeroPregao: '', numeroAta: '',
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
      (c.objetoResumido || '').toLowerCase().includes(termo)
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
        ...dadosIA,
        valorTotal: dadosIA.valorTotal ? dadosIA.valorTotal.toFixed(2).replace('.', ',') : prev.valorTotal
      }));
      if (dadosIA.itens && dadosIA.itens.length > 0) {
        setItensPrevia(dadosIA.itens);
        alert(`Gemini 2.0 analisou com sucesso! ${dadosIA.itens.length} itens carregados.`);
      }
    } catch (error) {
      alert("Erro ao processar o documento com a Inteligência Artificial.");
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const adicionarItemPrevia = () => {
    const qtd = parseMoeda(formItem.quantidade);
    const vUnit = parseMoeda(formItem.valorUnitario);
    if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) return alert("Preencha corretamente.");
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
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || '');
          const quantidade = extrairNumeroPlanilha(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = extrairNumeroPlanilha(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND'] || linha['VL. UNIT.'] || linha['VL. UNIT'] || linha['VL UNIT.']) || 0;
          if (discriminacao && quantidade > 0) {
            novosItens.push({ numeroLote: String(linha['LOTE'] || 'Único'), numeroItem: String(linha['ITEM'] || ''), discriminacao, unidade: String(linha['UNIDADE'] || 'UND'), quantidade, valorUnitario, valorTotalItem: quantidade * valorUnitario });
            somaImportacao += (quantidade * valorUnitario);
          }
        });
        setItensPrevia([...itensPrevia, ...novosItens]);
        const novoTotal = parseMoeda(formData.valorTotal) + somaImportacao;
        setFormData({ ...formData, valorTotal: novoTotal.toFixed(2).replace('.', ',') });
      } catch (error) { alert("Erro ao ler planilha."); }
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
      alert('Contrato salvo com sucesso!');
      setIsModalOpen(false);
      setFormData({ numeroContrato: '', numeroProcesso: '', modalidade: '', numeroPregao: '', numeroAta: '', fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '', dataFim: '', valorTotal: '', fiscalContrato: '', observacao: '' });
      setItensPrevia([]);
    } catch (error) { alert('Erro ao salvar.'); } finally { setLoading(false); }
  };

  const abrirEdicao = (c: Contrato) => {
    setContratoEditId(c.id!);
    setFormEdit({ ...c, valorTotal: c.valorTotal.toFixed(2).replace('.', ',') });
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
        await updateDoc(doc(db, 'contratos', contratoEditId), {
          ...formEdit, valorTotal: novoValorGlobal, saldoContrato: novoValorGlobal - valorJaConsumido, dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
        });
      }
      alert('Contrato atualizado!');
      setIsModalEditOpen(false);
    } catch (error) { alert("Erro ao editar."); } finally { setLoading(false); }
  };

  const excluirContrato = async (contratoId: string) => {
    if (window.confirm('Excluir contrato e histórico?')) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', contratoId));
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', contratoId));
        const querySnapshot = await getDocs(qItens);
        const batch = writeBatch(db);
        querySnapshot.forEach((itemDoc) => batch.delete(itemDoc.ref));
        await batch.commit();
        alert('Excluído!');
      } catch (error) { alert('Erro ao excluir.'); } finally { setLoading(false); }
    }
  };

  const verificarStatusVencimento = (dataFim: string) => {
    if (!dataFim) return 'normal';
    const fim = new Date(dataFim + 'T00:00:00');
    const hoje = new Date();
    const dias = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
    if (dias <= 30) return 'critico';
    if (dias <= 90) return 'alerta';
    return 'normal';
  };

  const nomeOrgaoFormatado = orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Carregando...';

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2>{nomeOrgaoFormatado}</h2>
        </div>
        <button className="btn-sair" onClick={() => { sessionStorage.clear(); navigate('/'); }}>Sair</button>
      </header>

      <main className="conteudo">
        <div className="acoes-topo">
          <h2>Contratos Cadastrados</h2>
          <div style={{ display: 'flex', gap: '15px' }}>
            <input type="text" placeholder="🔍 Buscar..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} />
            <button className="btn-novo" onClick={() => setIsModalOpen(true)}>+ Novo Contrato</button>
          </div>
        </div>

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
            {contratosFiltrados.map((c) => (
              <tr key={c.id}>
                <td>{c.dataInicio.substring(0, 4)}</td>
                <td>{c.numeroContrato}</td>
                <td>{c.objetoResumido}</td>
                <td>{c.fornecedor}</td>
                <td className={`prazo-${verificarStatusVencimento(c.dataFim)}`}>{formatarDataBr(c.dataFim)}</td>
                <td style={{ color: c.saldoContrato < 0 ? 'red' : 'green' }}>{c.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td>
                  <button onClick={() => navigate(`/contrato/${c.id}`)}>Ver</button>
                  <button onClick={() => abrirEdicao(c)}>✏️</button>
                  <button onClick={() => excluirContrato(c.id!)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {/* MODAL NOVO - AGORA DENTRO DO PAINEL PARA PRESERVAR CSS */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2>Novo Contrato</h2>
              <label htmlFor="upload-doc" style={{ backgroundColor: '#20c997', color: 'white', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>
                {loading ? 'Processando IA...' : '✨ Preencher com IA'}
                <input type="file" accept=".docx, .pdf" ref={docInputRef} onChange={importarContratoArquivo} style={{ display: 'none' }} id="upload-doc" />
              </label>
            </div>
            <form onSubmit={salvarContratoCompleto}>
              <div className="form-grid">
                <div className="form-group"><label>Nº Contrato</label><input type="text" name="numeroContrato" value={formData.numeroContrato} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
                <div className="form-group"><label>Nº Processo</label><input type="text" name="numeroProcesso" value={formData.numeroProcesso} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
                <div className="form-group">
                  <label>Modalidade</label>
                  <select name="modalidade" required value={formData.modalidade} onChange={lidarComMudanca}>
                    <option value="">Selecione...</option>
                    <option value="Pregão Eletrônico">Pregão Eletrônico</option>
                    <option value="Dispensa">Dispensa</option>
                    <option value="Concorrência Eletrônica">Concorrência Eletrônica</option>
                    <option value="Inexigibilidade">Inexigibilidade</option>
                    <option value="Edital">Edital</option>
                    <option value="Credenciamento">Credenciamento</option>
                    <option value="Chamamento">Chamamento</option>
                  </select>
                </div>
                <div className="form-group"><label>Nº Licitação</label><input type="text" name="numeroPregao" value={formData.numeroPregao} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label>Fornecedor</label><input type="text" name="fornecedor" value={formData.fornecedor} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label>Objeto</label><input type="text" name="objetoResumido" value={formData.objetoResumido} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Início</label><input type="date" name="dataInicio" value={formData.dataInicio} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Fim</label><input type="date" name="dataFim" value={formData.dataFim} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label>Valor Global</label><input type="text" name="valorTotal" value={formData.valorTotal} onChange={lidarComMudanca} /></div>
              </div>
              <div className="modal-acoes">
                <button type="button" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" disabled={loading}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {isModalEditOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Editar Contrato</h2>
            <form onSubmit={salvarEdicaoContrato}>
              <div className="form-grid">
                <div className="form-group"><label>Nº Contrato</label><input type="text" name="numeroContrato" value={formEdit.numeroContrato} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Valor Global</label><input type="text" name="valorTotal" value={formEdit.valorTotal} onChange={lidarComMudancaEdit} /></div>
              </div>
              <div className="modal-acoes">
                <button type="button" onClick={() => setIsModalEditOpen(false)}>Cancelar</button>
                <button type="submit">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
//end