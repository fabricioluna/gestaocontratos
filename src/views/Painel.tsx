// src/views/Painel.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './Painel.css';

// Converte "1.500,50" ou "1500,50" em número (1500.50)
const parseMoeda = (valor: string) => {
  if (!valor) return 0;
  return Number(valor.replace(/\./g, '').replace(',', '.'));
};

// Formata a data de AAAA-MM-DD para DD/MM/AAAA
const formatarDataBr = (dataString: string) => {
  if (!dataString) return 'N/A';
  const partes = dataString.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataString;
};

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    numeroContrato: '', numeroProcesso: '', numeroPregao: '', numeroAta: '',
    fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '',
    dataFim: '', valorTotal: '', fiscalContrato: '', observacao: ''
  });

  const [itensPrevia, setItensPrevia] = useState<any[]>([]);
  const [formItem, setFormItem] = useState({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
    'fme': 'Fundo Municipal de Educação (FME)',
    'fms': 'Fundo Municipal de Saúde (FMS)'
  };

  useEffect(() => {
    // CORREÇÃO DO ERRO DO TYPESCRIPT AQUI:
    if (!orgaoLogado) {
      navigate('/');
      return; // Retorna vazio em vez de retornar a promise do navigate
    }
    
    const q = query(collection(db, 'contratos'), where('orgaoId', '==', orgaoLogado));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Contrato[] = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() } as Contrato));
      lista.sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
      setContratos(lista);
    });
    return () => unsubscribe();
  }, [orgaoLogado, navigate]);

  const lidarComMudanca = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const lidarComMudancaItem = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const adicionarItemPrevia = () => {
    const qtd = parseMoeda(formItem.quantidade);
    const vUnit = parseMoeda(formItem.valorUnitario);
    if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) {
      return alert("Preencha descrição, quantidade e valor corretamente (use vírgula para centavos).");
    }
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let somaImportacao = 0;
        const novosItens: any[] = [];

        data.forEach((row: any) => {
          const linha: any = {};
          for (const key in row) linha[key.trim().toUpperCase()] = row[key];

          const numeroLote = String(linha['LOTE'] || 'Único'); 
          const numeroItem = String(linha['ITEM'] || '');
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || '');
          const unidade = String(linha['UNIDADE'] || linha['UND.'] || linha['UND'] || 'UND');
          const quantidade = Number(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = Number(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND']) || 0;
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
          alert(`${novosItens.length} itens carregados na prévia!`);
        }
      } catch (error) {
        alert("Erro ao ler planilha.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
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
          batch.set(itemRef, { ...item, contratoId: contratoRef.id, dataAdicao: dataAtual });
        });
        await batch.commit();
      }

      alert('Contrato e itens salvos com sucesso!');
      setIsModalOpen(false);
      setFormData({ numeroContrato: '', numeroProcesso: '', numeroPregao: '', numeroAta: '', fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '', dataFim: '', valorTotal: '', fiscalContrato: '', observacao: '' });
      setItensPrevia([]);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2>{orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Carregando...'}</h2>
        </div>
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
              <th>Ano</th>
              <th>Nº Contrato</th>
              <th>Objeto Resumido</th>
              <th>Fornecedor</th>
              <th>Validade</th> {/* NOVA COLUNA */}
              <th>Saldo Atual</th>
              <th>Última Atualização</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}>Nenhum contrato cadastrado.</td></tr>
            ) : (
              contratos.map((c) => (
                <tr key={c.id}>
                  <td>{c.dataInicio.substring(0, 4)}</td>
                  <td>{c.numeroContrato}</td>
                  <td>{c.objetoResumido}</td>
                  <td>{c.fornecedor}</td>
                  <td style={{ fontWeight: 'bold' }}>{formatarDataBr(c.dataFim)}</td> {/* AQUI EXIBIMOS A VALIDADE FORMATADA */}
                  <td style={{ fontWeight: 'bold', color: c.saldoContrato < 0 ? 'red' : 'green' }}>
                    {c.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td>{c.dataUltimaAtualizacao || 'N/A'}</td>
                  <td>
                    <button 
                      style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => navigate(`/contrato/${c.id}`)}
                    >Ver Detalhes / Itens</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>

      {/* MODAL FICA EXATAMENTE IGUAL AO ANTERIOR */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Cadastrar Novo Contrato</h2>
            
            <form onSubmit={salvarContratoCompleto}>
              <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>1. Dados do Contrato</h3>
              <div className="form-grid">
                <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formData.numeroContrato} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Nº do Processo</label><input type="text" name="numeroProcesso" required value={formData.numeroProcesso} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label>Fornecedor (Empresa)</label><input type="text" name="fornecedor" required value={formData.fornecedor} onChange={lidarComMudanca} /></div>
                <div className="form-group full-width"><label>Objeto Resumido</label><input type="text" name="objetoResumido" required value={formData.objetoResumido} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Data Início</label><input type="date" name="dataInicio" required value={formData.dataInicio} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Data Fim (Validade)</label><input type="date" name="dataFim" required value={formData.dataFim} onChange={lidarComMudanca} /></div>
                <div className="form-group"><label>Valor Global (R$)</label><input type="text" name="valorTotal" placeholder="Ex: 1500,50" required value={formData.valorTotal} onChange={lidarComMudanca} /></div>
              </div>

              <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px', marginTop: '30px' }}>2. Itens do Contrato (Opcional)</h3>
              <div className="secao-itens-modal">
                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}>
                  <div className="form-group"><input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="discriminacao" placeholder="Descrição" value={formItem.discriminacao} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="quantidade" placeholder="Qtd (Ex: 10,5)" value={formItem.quantidade} onChange={lidarComMudancaItem} /></div>
                  <div className="form-group"><input type="text" name="valorUnitario" placeholder="R$ Unit (Ex: 5,50)" value={formItem.valorUnitario} onChange={lidarComMudancaItem} /></div>
                  <button type="button" onClick={adicionarItemPrevia} style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add</button>
                </div>
                
                <div style={{ margin: '15px 0', textAlign: 'center' }}><strong>OU</strong></div>
                
                <input type="file" accept=".xlsx" ref={fileInputRef} onChange={importarPlanilhaPrevia} style={{ display: 'none' }} id="upload-previa" />
                <label htmlFor="upload-previa" style={{ display: 'block', textAlign: 'center', backgroundColor: '#28a745', color: 'white', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}>
                  📄 Importar Planilha Excel
                </label>
              </div>

              {itensPrevia.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                  <table className="tabela-previa">
                    <thead><tr><th>Item</th><th>Descrição</th><th>Qtd</th><th>Unitário</th><th>Total</th><th>Ação</th></tr></thead>
                    <tbody>
                      {itensPrevia.map((item, index) => (
                        <tr key={index}>
                          <td>{item.numeroItem}</td>
                          <td>{item.discriminacao}</td>
                          <td>{item.quantidade}</td>
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
                <button type="submit" className="btn-salvar" disabled={loading}>{loading ? 'A Guardar...' : 'Salvar Contrato Definitivo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}