// src/components/Painel/ModalNovoContrato.tsx
import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth'; 
import * as pdfjsLib from 'pdfjs-dist'; 
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { parseMoeda, extrairNumeroPlanilha } from '../../utils/formatters';
import { extrairDadosContratoComIA } from '../../services/geminiService';
import type { FormContratoState, Item } from '../../types/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface ModalNovoContratoProps {
  isOpen: boolean;
  onClose: () => void;
  orgaoLogado: string | null;
}

export default function ModalNovoContrato({ isOpen, onClose, orgaoLogado }: ModalNovoContratoProps) {
  const docInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [itensPrevia, setItensPrevia] = useState<Item[]>([]);
  const [formItem, setFormItem] = useState({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });

  // --- NOVOS ESTADOS PARA AS CAIXAS DE E-MAIL ---
  const [sugestoesEmails, setSugestoesEmails] = useState<string[]>([]);
  const [showBuscaEmail, setShowBuscaEmail] = useState(false);
  const [showNovoEmail, setShowNovoEmail] = useState(false);
  const [emailTemp, setEmailTemp] = useState('');
  const [verificandoEmail, setVerificandoEmail] = useState(false);

  const [formData, setFormData] = useState<FormContratoState>({
    numeroContrato: '', numeroProcesso: '', modalidade: '', numeroModalidade: '', numeroAta: '',
    fornecedor: '', cnpjFornecedor: '', emailSecretaria: '', objetoCompleto: '', objetoResumido: '', 
    dataInicio: '', dataFim: '', valorTotal: '', fiscalContrato: '', observacao: ''
  });

  // Busca a lista de e-mails sempre que o Modal abrir
  useEffect(() => {
    if (isOpen) {
      const carregarEmailsDoSistema = async () => {
        try {
          const res = await fetch('/api/list-users');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.emails) {
              setSugestoesEmails(data.emails);
            }
          }
        } catch (error) {
          console.error("Aviso: Falha ao carregar as sugestões de e-mail.", error);
        }
      };
      carregarEmailsDoSistema();
    } else {
      setSugestoesEmails([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const lidarComMudanca = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const lidarComMudancaItem = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const formatarTresDigitos = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value && /^\d+$/.test(value)) {
      setFormData(prev => ({ ...prev, [name]: value.padStart(3, '0') }));
    }
  };

  const formatarCNPJ = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, '');
    if (valor.length > 14) valor = valor.slice(0, 14);
    valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
    valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
    valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
    setFormData(prev => ({ ...prev, cnpjFornecedor: valor }));
  };

  // --- NOVA FUNÇÃO: Cadastrar E-mail a partir da Caixa Nova ---
  const lidarCadastrarNovoEmail = async () => {
    if (!emailTemp) {
      toast.error("Por favor, digite o e-mail.");
      return;
    }

    setVerificandoEmail(true);
    const toastId = toast.loading('A criar acesso e a enviar credenciais...');

    try {
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTemp, nomeOrgao: orgaoLogado })
      });

      let data;
      try {
         data = await response.json();
      } catch (err) {
         throw new Error("Erro no servidor da Vercel (Erro 500).");
      }

      if (response.ok && data.success) {
         toast.success(data.message, { id: toastId });
         // Preenche o formulário e atualiza a lista em memória
         setFormData(prev => ({ ...prev, emailSecretaria: emailTemp }));
         if (!sugestoesEmails.includes(emailTemp)) {
           setSugestoesEmails(prev => [...prev, emailTemp]);
         }
         setShowNovoEmail(false);
         setEmailTemp('');
      } else {
         toast.error(data.message || "Erro ao tentar cadastrar o utilizador.", { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro de comunicação. Tente novamente.", { id: toastId });
    } finally {
      setVerificandoEmail(false);
    }
  };

  const tratarValorIA = (valor: unknown): string => {
    if (valor === undefined || valor === null) return '';
    if (typeof valor === 'number') return valor.toFixed(2).replace('.', ',');
    const numLimpo = Number(String(valor).replace(/[^0-9.-]+/g, ""));
    return isNaN(numLimpo) ? '' : numLimpo.toFixed(2).replace('.', ',');
  };

  const importarContratoArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    const toastId = toast.loading('A processar documento com IA...');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      let textoCompleto = '';
      
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str || "");
          textoCompleto += strings.join(" ") + "\n";
        }
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        textoCompleto = result.value;
      }

      const textoLimpo = textoCompleto.replace(/\s+/g, ' ');
      if (textoLimpo.trim().length < 50) throw new Error("Texto ilegível.");

      const dadosIA = await extrairDadosContratoComIA(textoLimpo);
      
      setFormData(prev => ({
        ...prev,
        numeroContrato: dadosIA.numeroContrato || prev.numeroContrato,
        numeroProcesso: dadosIA.numeroProcesso || prev.numeroProcesso,
        modalidade: dadosIA.modalidade || prev.modalidade, 
        numeroModalidade: dadosIA.numeroPregao || dadosIA.numeroModalidade || prev.numeroModalidade,
        numeroAta: dadosIA.numeroAta || prev.numeroAta,
        fornecedor: dadosIA.fornecedor || prev.fornecedor,
        cnpjFornecedor: dadosIA.cnpjFornecedor || prev.cnpjFornecedor,
        objetoCompleto: dadosIA.objetoCompleto || prev.objetoCompleto,
        objetoResumido: dadosIA.objetoResumido || prev.objetoResumido,
        valorTotal: dadosIA.valorTotal ? tratarValorIA(dadosIA.valorTotal) : prev.valorTotal,
        fiscalContrato: dadosIA.fiscalContrato || prev.fiscalContrato,
        dataInicio: dadosIA.dataInicio || prev.dataInicio,
        dataFim: dadosIA.dataFim || prev.dataFim
      }));

      if (dadosIA.itens && Array.isArray(dadosIA.itens) && dadosIA.itens.length > 0) {
        const itensTratados: Item[] = dadosIA.itens.map((i: any, index: number) => ({
           contratoId: '',
           numeroLote: String(i.numeroLote || 'Único'),
           numeroItem: String(i.numeroItem || (index + 1)),
           discriminacao: String(i.discriminacao || ''),
           unidade: String(i.unidade || 'UND'),
           quantidade: Number(i.quantidade || 0),
           valorUnitario: Number(i.valorUnitario || 0),
           valorTotalItem: Number(i.valorTotalItem || (Number(i.quantidade || 0) * Number(i.valorUnitario || 0)))
        })).filter((i: Item) => i.discriminacao && i.quantidade > 0);

        setItensPrevia(itensTratados);
        toast.success(`Contrato processado! ${itensTratados.length} itens encontrados.`, { id: toastId });
      } else {
        toast.success("Dados gerais preenchidos. Sem itens encontrados.", { id: toastId, duration: 5000 });
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar o documento.", { id: toastId });
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const adicionarItemPrevia = () => {
    const qtd = parseMoeda(formItem.quantidade);
    const vUnit = parseMoeda(formItem.valorUnitario);
    if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) {
      toast.error("Preencha descrição, quantidade e valor.");
      return;
    }
    const novoItem: Item = {
      contratoId: '',
      numeroLote: formItem.numeroLote || 'Único',
      numeroItem: formItem.numeroItem || String(itensPrevia.length + 1),
      discriminacao: formItem.discriminacao,
      unidade: formItem.unidade || 'UND',
      quantidade: qtd, valorUnitario: vUnit, valorTotalItem: qtd * vUnit
    };
    setItensPrevia([...itensPrevia, novoItem]);
    const novoTotal = parseMoeda(formData.valorTotal) + novoItem.valorTotalItem;
    setFormData(prev => ({ ...prev, valorTotal: novoTotal.toFixed(2).replace('.', ',') }));
    setFormItem({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });
  };

  const removerItemPrevia = (index: number) => {
    const itemRemovido = itensPrevia[index];
    const novoTotal = parseMoeda(formData.valorTotal) - itemRemovido.valorTotalItem;
    setFormData(prev => ({ ...prev, valorTotal: novoTotal > 0 ? novoTotal.toFixed(2).replace('.', ',') : '' }));
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
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]]);
        let somaImportacao = 0;
        const novosItens: Item[] = [];
        data.forEach((row) => {
          const linha: Record<string, string | number> = {};
          for (const key in row) linha[key.trim().toUpperCase()] = row[key];
          
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || '');
          const quantidade = extrairNumeroPlanilha(linha['QUANTIDADE'] || 0);
          const valorUnitario = extrairNumeroPlanilha(linha['VALOR UNITÁRIO'] || 0);
          const valorTotalItem = quantidade * valorUnitario;
          
          if (discriminacao && quantidade > 0) {
            novosItens.push({ 
              contratoId: '', numeroLote: String(linha['LOTE'] || 'Único'), numeroItem: String(linha['ITEM'] || ''), 
              discriminacao, unidade: String(linha['UNIDADE'] || 'UND'), quantidade, valorUnitario, valorTotalItem 
            });
            somaImportacao += valorTotalItem;
          }
        });
        if (novosItens.length > 0) {
          setItensPrevia([...itensPrevia, ...novosItens]);
          const novoTotal = parseMoeda(formData.valorTotal) + somaImportacao;
          setFormData(prev => ({ ...prev, valorTotal: novoTotal.toFixed(2).replace('.', ',') }));
          toast.success(`${novosItens.length} itens carregados!`);
        }
      } catch (error) { toast.error("Erro ao ler planilha."); } 
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const salvarContratoCompleto = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('A guardar contrato...');
    try {
      const valorGlobalNum = parseMoeda(formData.valorTotal);
      const dataAtual = new Date().toLocaleString('pt-BR');
      
      const contratoRef = await addDoc(collection(db, 'contratos'), {
        ...formData,
        orgaoId: orgaoLogado,
        valorTotal: valorGlobalNum,
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
      toast.success('Contrato e catálogo salvos!', { id: toastId });
      
      setFormData({ numeroContrato: '', numeroProcesso: '', modalidade: '', numeroModalidade: '', numeroAta: '', fornecedor: '', cnpjFornecedor: '', emailSecretaria: '', objetoCompleto: '', objetoResumido: '', dataInicio: '', dataFim: '', valorTotal: '', fiscalContrato: '', observacao: '' });
      setItensPrevia([]);
      onClose();
    } catch (error) { toast.error('Erro ao guardar contrato.', { id: toastId }); } 
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="modal-overlay" onClick={() => { onClose(); setItensPrevia([]); }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>Cadastrar Novo Contrato</h2>
            <label htmlFor="upload-doc" style={{ backgroundColor: '#20c997', color: 'white', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
              {loading ? 'Processando...' : '📄 Carregar Contrato'}
              <input type="file" accept=".docx, .pdf" ref={docInputRef} onChange={importarContratoArquivo} style={{ display: 'none' }} id="upload-doc" />
            </label>
          </div>
          
          <form onSubmit={salvarContratoCompleto}>
            <h3 style={{ color: '#555', marginTop: 0 }}>1. Dados Gerais</h3>
            <div className="form-grid">
              <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formData.numeroContrato} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
              <div className="form-group"><label>Nº/Ano Processo</label><input type="text" name="numeroProcesso" value={formData.numeroProcesso} onChange={lidarComMudanca} placeholder="000/0000" /></div>
              
              <div className="form-group">
                <label>Modalidade</label>
                <select name="modalidade" value={formData.modalidade} onChange={lidarComMudanca} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', height: '36px' }}>
                  <option value="">Selecione...</option>
                  <option value="Pregão Eletrônico">Pregão Eletrônico</option>
                  <option value="Pregão Presencial">Pregão Presencial</option>
                  <option value="Concorrência">Concorrência</option>
                  <option value="Dispensa">Dispensa</option>
                  <option value="Inexigibilidade">Inexigibilidade</option>
                  <option value="Credenciamento">Credenciamento</option>
                </select>
              </div>
              
              <div className="form-group"><label>Nº/Ano Modalidade</label><input type="text" name="numeroModalidade" value={formData.numeroModalidade} onChange={lidarComMudanca} placeholder="000/0000" /></div>
              <div className="form-group"><label>Nº/Ano da Ata</label><input type="text" name="numeroAta" value={formData.numeroAta} onChange={lidarComMudanca} placeholder="000/0000" /></div>
              
              <div className="form-group"><label>CPF / CNPJ</label><input type="text" name="cnpjFornecedor" value={formData.cnpjFornecedor} onChange={formatarCNPJ} placeholder="00.000.000/0000-00" maxLength={18} /></div>
              <div className="form-group"><label>Fornecedor</label><input type="text" name="fornecedor" required value={formData.fornecedor} onChange={lidarComMudanca} /></div>
              
              {/* AS NOVAS AÇÕES EXPLÍCITAS DE E-MAIL */}
              <div className="form-group full-width">
                <label>E-mail da Sec. Demandante/Fiscal (Receberá alertas)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="email" 
                    name="emailSecretaria" 
                    value={formData.emailSecretaria} 
                    onChange={lidarComMudanca} 
                    placeholder="E-mail do fiscal responsável..." 
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} 
                    list="lista-emails-sugestoes"
                    autoComplete="off"
                  />
                  <datalist id="lista-emails-sugestoes">
                    {sugestoesEmails.map((email, idx) => (
                      <option key={idx} value={email} />
                    ))}
                  </datalist>

                  <button 
                    type="button" 
                    onClick={() => setShowBuscaEmail(true)} 
                    style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '0 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🔍 Buscar
                  </button>

                  <button 
                    type="button" 
                    onClick={() => { setEmailTemp(''); setShowNovoEmail(true); }} 
                    style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ➕ Cadastrar Novo
                  </button>
                </div>
              </div>
              
              <div className="form-group full-width"><label>Objeto Resumido</label><input type="text" name="objetoResumido" required value={formData.objetoResumido} onChange={lidarComMudanca} /></div>
              <div className="form-group full-width"><label>Objeto Completo</label><textarea name="objetoCompleto" rows={2} value={formData.objetoCompleto} onChange={lidarComMudanca}></textarea></div>
              <div className="form-group"><label>Data Início</label><input type="date" name="dataInicio" required value={formData.dataInicio} onChange={lidarComMudanca} /></div>
              <div className="form-group"><label>Data Fim (Validade)</label><input type="date" name="dataFim" required value={formData.dataFim} onChange={lidarComMudanca} /></div>
              <div className="form-group"><label>Fiscal do Contrato</label><input type="text" name="fiscalContrato" value={formData.fiscalContrato} onChange={lidarComMudanca} /></div>
              <div className="form-group"><label>Observação</label><input type="text" name="observacao" value={formData.observacao} onChange={lidarComMudanca} /></div>
              <div className="form-group full-width"><label style={{ color: '#004a99', fontSize: '15px' }}>Valor Global do Contrato (R$)</label><input type="text" name="valorTotal" required value={formData.valorTotal} onChange={lidarComMudanca} style={{ border: '2px solid #004a99', fontWeight: 'bold' }} /></div>
            </div>

            <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px', marginTop: '30px' }}>2. Catálogo de Itens do Contrato (Opcional)</h3>
            <div className="secao-itens-modal">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}>
                <input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={lidarComMudancaItem} />
                <input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={lidarComMudancaItem} />
                <input type="text" name="discriminacao" placeholder="Descrição" value={formItem.discriminacao} onChange={lidarComMudancaItem} />
                <input type="text" name="quantidade" placeholder="Qtd" value={formItem.quantidade} onChange={lidarComMudancaItem} />
                <input type="text" name="valorUnitario" placeholder="R$ Unit" value={formItem.valorUnitario} onChange={lidarComMudancaItem} />
                <button type="button" onClick={adicionarItemPrevia} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add</button>
              </div>
              <div style={{ margin: '15px 0', textAlign: 'center' }}><strong>OU</strong></div>
              <label htmlFor="upload-previa" style={{ display: 'block', textAlign: 'center', backgroundColor: '#28a745', color: 'white', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>📄 Importar Excel <input type="file" accept=".xlsx" ref={fileInputRef} onChange={importarPlanilhaPrevia} style={{ display: 'none' }} id="upload-previa" /></label>
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
              <button type="button" className="btn-cancelar" onClick={() => { onClose(); setItensPrevia([]); }}>Cancelar</button>
              <button type="submit" className="btn-salvar" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Contrato'}</button>
            </div>
          </form>
        </div>
      </div>

      {/* --- SUB-CAIXA: BUSCAR E-MAIL EXISTENTE --- */}
      {showBuscaEmail && (
        <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={() => setShowBuscaEmail(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Selecione um E-mail Cadastrado</h3>
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
              {sugestoesEmails.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666' }}>Nenhum e-mail encontrado no sistema.</p>
              ) : (
                sugestoesEmails.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setFormData(prev => ({ ...prev, emailSecretaria: e })); setShowBuscaEmail(false); }}
                    style={{ padding: '12px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', cursor: 'pointer', transition: '0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  >
                    📧 {e}
                  </button>
                ))
              )}
            </div>
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button type="button" className="btn-cancelar" onClick={() => setShowBuscaEmail(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-CAIXA: CADASTRAR NOVO E-MAIL --- */}
      {showNovoEmail && (
        <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={() => !verificandoEmail && setShowNovoEmail(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Cadastrar Novo Acesso</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              O sistema criará o acesso no banco de dados e enviará um e-mail com a senha provisória ao novo fiscal.
            </p>
            <div className="form-group full-width">
              <label>E-mail do Novo Fiscal</label>
              <input
                type="email"
                value={emailTemp}
                onChange={e => setEmailTemp(e.target.value)}
                placeholder="exemplo.fiscal@pesqueira.pe.gov.br"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '25px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-cancelar" onClick={() => setShowNovoEmail(false)} disabled={verificandoEmail}>Cancelar</button>
              <button type="button" className="btn-salvar" onClick={lidarCadastrarNovoEmail} disabled={verificandoEmail}>
                {verificandoEmail ? 'A processar...' : 'Salvar e Utilizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}