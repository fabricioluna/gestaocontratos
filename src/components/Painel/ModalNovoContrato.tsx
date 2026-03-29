// src/components/Painel/ModalNovoContrato.tsx
import { useState, useRef } from 'react';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { db } from '../../firebase';
import { parseMoeda, extrairNumeroPlanilha } from '../../utils/formatters';
import { extrairDadosContratoComIA } from '../../services/geminiService';

// Configuração do worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface ModalNovoContratoProps {
  isOpen: boolean;
  onClose: () => void;
  orgaoLogado: string | null;
}

export default function ModalNovoContrato({ isOpen, onClose, orgaoLogado }: ModalNovoContratoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    numeroContrato: '', numeroProcesso: '', modalidade: '', numeroPregao: '', numeroAta: '',
    fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '',
    dataFim: '', valorTotal: '', fiscalContrato: '', observacao: ''
  });

  const [itensPrevia, setItensPrevia] = useState<any[]>([]);
  const [formItem, setFormItem] = useState({ 
    numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' 
  });

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
        alert(`IA analisou com sucesso! ${dadosIA.itens.length} itens carregados no catálogo.`);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao processar o documento com a Inteligência Artificial.");
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
      quantidade: qtd, 
      valorUnitario: vUnit, 
      valorTotalItem: qtd * vUnit
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
            novosItens.push({ 
              numeroLote: String(linha['LOTE'] || 'Único'), 
              numeroItem: String(linha['ITEM'] || ''), 
              discriminacao, 
              unidade: String(linha['UNIDADE'] || 'UND'), 
              quantidade, 
              valorUnitario, 
              valorTotalItem: quantidade * valorUnitario 
            });
            somaImportacao += (quantidade * valorUnitario);
          }
        });
        setItensPrevia(prev => [...prev, ...novosItens]);
        const novoTotal = parseMoeda(formData.valorTotal) + somaImportacao;
        setFormData(prev => ({ ...prev, valorTotal: novoTotal.toFixed(2).replace('.', ',') }));
        alert(`${novosItens.length} itens carregados no catálogo!`);
      } catch (error) { alert("Erro ao ler folha de cálculo."); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
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
      alert('Contrato e catálogo guardados com sucesso!');
      setFormData({ 
        numeroContrato: '', numeroProcesso: '', modalidade: '', numeroPregao: '', numeroAta: '', 
        fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '', 
        dataFim: '', valorTotal: '', fiscalContrato: '', observacao: '' 
      });
      setItensPrevia([]);
      onClose();
    } catch (error) { alert('Erro ao guardar.'); } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>Cadastrar Novo Contrato</h2>
          <div>
            <input type="file" accept=".docx, .pdf" ref={docInputRef} onChange={importarContratoArquivo} style={{ display: 'none' }} id="upload-doc" />
            <label htmlFor="upload-doc" style={{ backgroundColor: '#20c997', color: 'white', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {loading ? 'A processar...' : '✨ Auto-Preencher com IA'}
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
              <select name="modalidade" required value={formData.modalidade} onChange={lidarComMudanca} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}>
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

            <div className="form-group"><label>Nº da Licitação / Modalidade</label><input type="text" name="numeroPregao" value={formData.numeroPregao} onChange={lidarComMudanca} onBlur={formatarTresDigitos} /></div>
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
            <button type="button" className="btn-cancelar" onClick={() => { onClose(); setItensPrevia([]); }}>Cancelar</button>
            <button type="submit" className="btn-salvar" disabled={loading}>{loading ? 'A Guardar...' : 'Salvar Contrato'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}