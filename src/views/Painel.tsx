// src/views/Painel.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, onSnapshot, writeBatch, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth'; // Leitor de DOCX
import * as pdfjsLib from 'pdfjs-dist'; // Leitor de PDF
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './Painel.css';

// Configuração obrigatória do Worker do PDF.js para funcionar no navegador
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const parseMoeda = (valor: string | number) => {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  return Number(valor.replace(/\./g, '').replace(',', '.'));
};

const extrairNumeroPlanilha = (valor: any) => {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  const str = String(valor).trim();
  if (str.includes(',')) {
    return Number(str.replace(/\./g, '').replace(',', '.'));
  }
  return Number(str);
};

const formatarDataBr = (dataString: string) => {
  if (!dataString) return 'N/A';
  const partes = dataString.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataString;
};

// Dicionário para converter o mês escrito no contrato para número
const mesesParaNumeros: { [key: string]: string } = {
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
  'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
};

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null); // Ref para o leitor de PDF/Word

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);

  const [formData, setFormData] = useState({
    numeroContrato: '', numeroProcesso: '', numeroPregao: '', numeroAta: '',
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
    if (!orgaoLogado) {
      navigate('/');
      return; 
    }
    
    const q = query(collection(db, 'contratos'), where('orgaoId', '==', orgaoLogado));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Contrato[] = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() } as Contrato));
      setContratos(lista);
    });
    return () => unsubscribe();
  }, [orgaoLogado, navigate]);

  const lidarComOrdenacao = (campo: string) => {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }));
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

  const renderSeta = (campo: string) => {
    if (ordenacao.campo !== campo) return <span style={{ color: '#ccc', marginLeft: '5px' }}>↕</span>;
    return <span style={{ marginLeft: '5px' }}>{ordenacao.direcao === 'asc' ? '▲' : '▼'}</span>;
  };

  const lidarComMudanca = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const lidarComMudancaEdit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  // =========================================================================
  // MÁGICA: EXTRAÇÃO AUTOMÁTICA DE DADOS DO ARQUIVO (WORD OU PDF)
  // =========================================================================
  const importarContratoArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let textoCompleto = '';

      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Leitura de PDF
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          textoCompleto += strings.join(" ") + "\n";
        }
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        // Leitura de DOCX (Word)
        const result = await mammoth.extractRawText({ arrayBuffer });
        textoCompleto = result.value;
      } else {
        alert("Formato não suportado. Envie um arquivo PDF ou Word (.docx).");
        setLoading(false);
        return;
      }

      // Limpar o texto de espaços duplos ou quebras de linha estranhas para facilitar a busca
      const textoLimpo = textoCompleto.replace(/\s+/g, ' ');

      // Expressões Regulares (Inteligência baseada no seu padrão de contrato)
      const matchContrato = textoLimpo.match(/CONTRATO N[ºOo]\s*(\d+)/i);
      const matchProcesso = textoLimpo.match(/PROCESSO LICITATÓRIO N[ºOo]\s*(\d+)/i);
      const matchPregao = textoLimpo.match(/PREGÃO ELETRÔNICO N[ºOo]\s*(\d+)/i) || textoLimpo.match(/DISPENSA N[ºOo]\s*(\d+)/i) || textoLimpo.match(/INEXIGIBILIDADE N[ºOo]\s*(\d+)/i);
      const matchAta = textoLimpo.match(/ATA DE REGISTRO DE PREÇOS N[ºOo]\s*(\d+)/i);
      
      // Captura o fornecedor logo após "e a empresa"
      const matchFornecedor = textoLimpo.match(/e a empresa\s+(.+?)(?:,|\s+com sede|\s+inscrita)/i);
      
      // Captura o objeto até encontrar um ponto final ou a palavra "conforme"
      const matchObjeto = textoLimpo.match(/objeto do presente termo de contrato é [ao]\s+(.+?)(?:\.| conforme| e em)/i);
      
      const matchValor = textoLimpo.match(/valor total.*?R\$\s*([\d.,]+)/i);
      const matchFiscal = textoLimpo.match(/designado[a]? pela CONTRATANTE,\s*([^,]+)/i);
      
      // Captura a data de assinatura no final do documento
      const matchData = textoLimpo.match(/Pesqueira,\s*(\d{1,2})\s*de\s*([a-zA-Zç]+)\s*de\s*(\d{4})/i);

      // Formatando as informações encontradas
      const numeroContrato = matchContrato ? matchContrato[1].padStart(3, '0') : '';
      const numeroProcesso = matchProcesso ? matchProcesso[1].padStart(3, '0') : '';
      const numeroPregao = matchPregao ? matchPregao[1].padStart(3, '0') : '';
      const numeroAta = matchAta ? matchAta[1].padStart(3, '0') : '';
      const fornecedor = matchFornecedor ? matchFornecedor[1].trim() : '';
      const objetoBase = matchObjeto ? matchObjeto[1].trim() : '';
      
      // Monta o objeto completo e o resumido
      const objetoCompleto = objetoBase ? objetoBase.charAt(0).toUpperCase() + objetoBase.slice(1) : '';
      const objetoResumido = objetoCompleto ? objetoCompleto.substring(0, 80) + '...' : '';
      const valorTotal = matchValor ? matchValor[1] : '';
      const fiscalContrato = matchFiscal ? matchFiscal[1].trim() : '';

      let dataInicioFormatada = '';
      let dataFimFormatada = '';

      if (matchData) {
        const dia = matchData[1].padStart(2, '0');
        const mesEscrito = matchData[2].toLowerCase();
        const ano = matchData[3];
        const mesNumero = mesesParaNumeros[mesEscrito] || '01';
        
        dataInicioFormatada = `${ano}-${mesNumero}-${dia}`;
        
        // Calcula a Validade Padrão de 1 ano para frente
        const anoFim = parseInt(ano) + 1;
        dataFimFormatada = `${anoFim}-${mesNumero}-${dia}`;
      }

      // Preenche o formulário para o usuário confirmar
      setFormData(prev => ({
        ...prev,
        numeroContrato: numeroContrato || prev.numeroContrato,
        numeroProcesso: numeroProcesso || prev.numeroProcesso,
        numeroPregao: numeroPregao || prev.numeroPregao,
        numeroAta: numeroAta || prev.numeroAta,
        fornecedor: fornecedor || prev.fornecedor,
        objetoCompleto: objetoCompleto || prev.objetoCompleto,
        objetoResumido: objetoResumido || prev.objetoResumido,
        valorTotal: valorTotal || prev.valorTotal,
        fiscalContrato: fiscalContrato || prev.fiscalContrato,
        dataInicio: dataInicioFormatada || prev.dataInicio,
        dataFim: dataFimFormatada || prev.dataFim
      }));

      alert("Contrato analisado com sucesso! Verifique os campos preenchidos e faça os ajustes necessários.");

    } catch (error) {
      console.error(error);
      alert("Erro ao ler o documento. Verifique se o arquivo não está corrompido.");
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = ''; // Limpa o input
    }
  };
  // =========================================================================

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
      setFormData({ numeroContrato: '', numeroProcesso: '', numeroPregao: '', numeroAta: '', fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '', dataFim: '', valorTotal: '', fiscalContrato: '', observacao: '' });
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
          querySnapshot.forEach((itemDoc) => {
            batch.delete(itemDoc.ref);
          });
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

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo"><img src={logo} alt="Logo PMP" className="logo-pequena" /><h2>{orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Carregando...'}</h2></div>
        <button className="btn-sair" onClick={() => { sessionStorage.clear(); navigate('/'); }}>Sair da Conta</button>
      </header>

      <main className="conteudo">
        <div className="acoes-topo">
          <h2>Contratos Cadastrados</h2>
          <button className="btn-novo" onClick={() => setIsModalOpen(true)}>+ Novo Contrato</button>
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
            {contratosOrdenados.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Nenhum contrato cadastrado.</td></tr>
            ) : (
              contratosOrdenados.map((c) => (
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

      {/* MODAL NOVO CONTRATO COM AUTO-PREENCHIMENTO MAGICO */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Cadastrar Novo Contrato</h2>
              <div>
                <input type="file" accept=".docx, .pdf" ref={docInputRef} onChange={importarContratoArquivo} style={{ display: 'none' }} id="upload-doc" />
                <label htmlFor="upload-doc" style={{ backgroundColor: '#17a2b8', color: 'white', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {loading ? 'A processar...' : '🪄 Auto-Preencher com Arquivo (PDF ou DOCX)'}
                </label>
              </div>
            </div>
            
            <form onSubmit={salvarContratoCompleto}>
              <h3 style={{ color: '#555', marginTop: 0 }}>1. Dados Gerais</h3>
              <div className="form-grid">
                <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formData.numeroContrato} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
                <div className="form-group"><label>Nº do Processo</label><input type="text" name="numeroProcesso" required value={formData.numeroProcesso} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
                <div className="form-group"><label>Nº Pregão</label><input type="text" name="numeroPregao" value={formData.numeroPregao} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
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
                    <thead><tr><th>Item</th><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th><th>Ação</th></tr></thead>
                    <tbody>
                      {itensPrevia.map((item, index) => (
                        <tr key={index}>
                          <td>{item.numeroItem}</td><td>{item.discriminacao}</td><td>{item.quantidade}</td>
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

      {/* MODAL EDITAR CONTRATO */}
      {isModalEditOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Editar Dados do Contrato</h2>
            <form onSubmit={salvarEdicaoContrato}>
              <div className="form-grid">
                <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formEdit.numeroContrato} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} /></div>
                <div className="form-group"><label>Nº do Processo</label><input type="text" name="numeroProcesso" required value={formEdit.numeroProcesso} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} /></div>
                <div className="form-group"><label>Nº Pregão</label><input type="text" name="numeroPregao" value={formEdit.numeroPregao} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} /></div>
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