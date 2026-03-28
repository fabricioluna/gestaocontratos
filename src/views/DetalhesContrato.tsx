// src/views/DetalhesContrato.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, addDoc, updateDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import type { Contrato } from '../types';
import './DetalhesContrato.css';

interface ItemExtendido {
  id?: string;
  contratoId: string;
  numeroLote: string;
  numeroItem: string;
  discriminacao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  dataAdicao?: string;
  tipoRegistro?: 'catalogo' | 'consumo';
}

const parseMoeda = (valor: string | number) => {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  return Number(valor.replace(/\./g, '').replace(',', '.'));
};

const extrairNumeroPlanilha = (valor: any) => {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  const str = String(valor).trim();
  if (str.includes(',')) return Number(str.replace(/\./g, '').replace(',', '.'));
  return Number(str);
};

const formatarDataBr = (dataString: string) => {
  if (!dataString) return 'N/A';
  const partes = dataString.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return dataString;
};

export default function DetalhesContrato() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itens, setItens] = useState<ItemExtendido[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalLancamentoOpen, setIsModalLancamentoOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);

  const [formItem, setFormItem] = useState({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });
  const [formEdit, setFormEdit] = useState<any>({}); 

  useEffect(() => {
    if (!id) return;
    
    const unsubContrato = onSnapshot(doc(db, 'contratos', id), (docSnap) => {
      if (docSnap.exists()) {
        const dados = { id: docSnap.id, ...docSnap.data() } as Contrato;
        setContrato(dados);
        setFormEdit({ ...dados, valorTotal: dados.valorTotal.toFixed(2).replace('.', ',') });
      }
    });

    const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
    const unsubItens = onSnapshot(qItens, (querySnapshot) => {
      const lista: ItemExtendido[] = [];
      querySnapshot.forEach((d) => lista.push({ id: d.id, ...d.data() } as ItemExtendido));
      
      // Ordena numericamente pelo Lote e depois pelo Item
      lista.sort((a, b) => {
        const loteA = a.numeroLote || '';
        const loteB = b.numeroLote || '';
        const cmpLote = loteA.localeCompare(loteB, undefined, { numeric: true });
        if (cmpLote !== 0) return cmpLote;
        const itemA = a.numeroItem || '';
        const itemB = b.numeroItem || '';
        return itemA.localeCompare(itemB, undefined, { numeric: true });
      });
      setItens(lista);
    });

    return () => { unsubContrato(); unsubItens(); };
  }, [id]);

  const lidarComMudancaEdit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormEdit((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const salvarEdicaoContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !contrato) return;
    setLoading(true);
    try {
      const novoValorGlobal = parseMoeda(formEdit.valorTotal);
      const valorJaConsumido = contrato.valorTotal - contrato.saldoContrato;
      const novoSaldo = novoValorGlobal - valorJaConsumido;

      await updateDoc(doc(db, 'contratos', id), {
        ...formEdit, valorTotal: novoValorGlobal, saldoContrato: novoSaldo, dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      alert('Contrato atualizado com sucesso!');
      setIsModalEditOpen(false);
    } catch (error) { alert("Erro ao editar contrato."); } finally { setLoading(false); }
  };

  const lidarComMudancaItem = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormItem((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const adicionarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contrato || !id) return;
    setLoading(true);
    try {
      const qtd = parseMoeda(formItem.quantidade);
      const vUnit = parseMoeda(formItem.valorUnitario);
      if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) { alert("Preencha corretamente os valores."); setLoading(false); return; }
      const valorTotalItem = qtd * vUnit;
      const dataAtual = new Date().toLocaleString('pt-BR');

      await addDoc(collection(db, 'itens'), {
        ...formItem, contratoId: id, quantidade: qtd, valorUnitario: vUnit,
        valorTotalItem: valorTotalItem, dataAdicao: dataAtual, tipoRegistro: 'consumo' // MARCA COMO CONSUMO
      });

      await updateDoc(doc(db, 'contratos', id), {
        saldoContrato: contrato.saldoContrato - valorTotalItem, dataUltimaAtualizacao: dataAtual
      });

      alert('Consumo registrado e saldo reduzido com sucesso!');
      setFormItem({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });
      setIsModalLancamentoOpen(false);
    } catch (error) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  const importarPlanilha = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contrato || !id) return;
    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const batch = writeBatch(db); 
        let valorTotalConsumidoLoop = 0;
        const dataAtual = new Date().toLocaleString('pt-BR');
        let itensValidos = 0;

        data.forEach((row: any) => {
          const linha: any = {};
          for (const key in row) linha[key.trim().toUpperCase()] = row[key];
          const numeroLote = String(linha['LOTE'] || 'Único'); 
          const numeroItem = String(linha['ITEM'] || '');
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || '');
          const unidade = String(linha['UNIDADE'] || linha['UND.'] || linha['UND'] || '');
          const quantidade = extrairNumeroPlanilha(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = extrairNumeroPlanilha(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND'] || linha['VL. UNIT.'] || linha['VL. UNIT'] || linha['VL UNIT.']) || 0;
          const valorTotalItem = quantidade * valorUnitario;

          if (discriminacao && quantidade > 0) {
            const itemRef = doc(collection(db, 'itens')); 
            batch.set(itemRef, {
              contratoId: id, numeroLote, numeroItem, discriminacao, unidade,
              quantidade, valorUnitario, valorTotalItem, dataAdicao: dataAtual, tipoRegistro: 'consumo' // MARCA COMO CONSUMO
            });
            valorTotalConsumidoLoop += valorTotalItem;
            itensValidos++;
          }
        });

        if (itensValidos > 0) {
          await batch.update(doc(db, 'contratos', id), {
            saldoContrato: contrato.saldoContrato - valorTotalConsumidoLoop, dataUltimaAtualizacao: dataAtual
          });
          await batch.commit();
          alert(`${itensValidos} itens processados! Saldo reduzido em ${valorTotalConsumidoLoop.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
          setIsModalLancamentoOpen(false);
        } else { alert('Nenhum item válido encontrado.'); }
      } catch (error) { alert("Erro ao ler Excel."); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  if (!contrato) return <div style={{textAlign: 'center', padding: '50px'}}>A carregar relatório...</div>;

  // A INTELIGÊNCIA: Separa o que é catálogo original e o que é consumo real
  const itensCatalogo = itens.filter(i => i.tipoRegistro === 'catalogo');
  const itensConsumo = itens.filter(i => i.tipoRegistro !== 'catalogo');

  // Cálculos SOMENTE baseados no Consumo real! Contratos novos nascem com ZERO aqui.
  const totalItens = itensConsumo.length;
  const totalUnidades = itensConsumo.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalConsumido = itensConsumo.reduce((acc, curr) => acc + curr.valorTotalItem, 0);

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo"><h2>Relatório de Contrato: {contrato.numeroContrato} / {contrato.dataInicio.substring(0, 4)}</h2></div>
        <button className="btn-sair" onClick={() => navigate('/painel')} style={{borderColor: 'white'}}>Voltar ao Painel</button>
      </header>

      <main className="detalhes-container">
        
        <div className="acoes-relatorio">
          <button className="btn-acao btn-editar" onClick={() => setIsModalEditOpen(true)}>✏️ Editar Contrato</button>
          <button className="btn-acao btn-lancar" onClick={() => setIsModalLancamentoOpen(true)}>+ Lançar Consumo (Empenho)</button>
        </div>

        <div className="painel-relatorio">
          <div className="card-relatorio">
            <h3 style={{ color: '#004a99', marginTop: 0 }}>Dados Gerais</h3>
            <p><strong>Fornecedor:</strong> {contrato.fornecedor}</p>
            <p><strong>Objeto:</strong> {contrato.objetoResumido}</p>
            <div className="dados-grid">
              <p><strong>Nº Processo:</strong> {contrato.numeroProcesso}</p>
              <p><strong>Nº Pregão/Ata:</strong> {contrato.numeroPregao || '-'} / {contrato.numeroAta || '-'}</p>
              <p><strong>Início:</strong> {formatarDataBr(contrato.dataInicio)}</p>
              <p><strong>Validade:</strong> {formatarDataBr(contrato.dataFim)}</p>
              <p><strong>Fiscal:</strong> {contrato.fiscalContrato || 'Não informado'}</p>
              <p><strong>Observação:</strong> {contrato.observacao || 'Nenhuma'}</p>
            </div>
          </div>

          <div className="card-financeiro">
            <div>
              <h3 style={{ color: '#28a745', marginTop: 0, textAlign: 'center' }}>Posição Financeira</h3>
              <div className="bloco-saldo">
                <div style={{ fontSize: '15px', color: '#555', marginBottom: '5px' }}>
                  <strong>Global Autorizado:</strong> {contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div style={{ fontSize: '15px', color: '#dc3545', marginBottom: '10px' }}>
                  <strong>Valor Consumido:</strong> {totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div style={{ borderTop: '1px solid #ddd', margin: '10px 0' }}></div>
                <div style={{ fontSize: '12px', color: '#666' }}>Saldo Atual Disponível</div>
                <div className={`valor-saldo ${contrato.saldoContrato >= 0 ? 'saldo-positivo' : 'saldo-negativo'}`}>
                  {contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>Atualizado em: {contrato.dataUltimaAtualizacao || 'N/A'}</div>
              </div>
            </div>
            <div className="metricas-itens">
              <div><strong>{totalItens}</strong> Nº de Lançamentos</div>
              <div><strong>{totalUnidades.toLocaleString('pt-BR')}</strong> Unidades Consumidas</div>
            </div>
          </div>
        </div>

        {itensCatalogo.length > 0 && (
          <div className="secao-itens" style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#004a99' }}>📋 Catálogo Original do Contrato</h3>
            <table className="tabela-itens">
              <thead><tr><th>Lote/Item</th><th>Descrição do Produto</th><th>Qtd Total</th><th>V. Unitário</th><th>Total Projetado</th></tr></thead>
              <tbody>
                {itensCatalogo.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold' }}>{item.numeroLote !== 'Único' ? `Lote ${item.numeroLote} / ` : ''}Item {item.numeroItem}</td>
                    <td>{item.discriminacao}</td><td>{item.quantidade} {item.unidade}</td>
                    <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#555' }}>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="secao-itens">
          <h3 style={{ color: '#dc3545' }}>🛒 Histórico de Consumo (Empenhos Executados)</h3>
          <table className="tabela-itens">
            <thead><tr><th>Lote/Item</th><th>Produto / Objeto</th><th>Qtd Consumida</th><th>V. Unitário</th><th>Valor Consumido</th><th>Data do Log</th></tr></thead>
            <tbody>
              {itensConsumo.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center'}}>Nenhum consumo registrado ainda. O valor consumido é R$ 0,00.</td></tr>
              ) : (
                itensConsumo.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold' }}>{item.numeroLote !== 'Único' ? `Lote ${item.numeroLote} / ` : ''}Item {item.numeroItem}</td>
                    <td>{item.discriminacao}</td><td>{item.quantidade} {item.unidade}</td>
                    <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#dc3545', fontWeight: 'bold' }}>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#666', fontSize: '12px' }}>{item.dataAdicao}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL 1: LANÇAR CONSUMO (EMPENHO) */}
      {isModalLancamentoOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <h2>Lançar Novo Consumo (Empenho)</h2>
            <div style={{ margin: '20px 0', textAlign: 'center' }}>
              <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={importarPlanilha} style={{ display: 'none' }} id="upload-excel-detalhes" />
              <label htmlFor="upload-excel-detalhes" style={{ backgroundColor: '#28a745', color: 'white', padding: '15px 30px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' }}>📄 Importar Planilha de Consumo</label>
              <div style={{ margin: '15px 0', fontWeight: 'bold', color: '#666' }}>OU LANÇAMENTO MANUAL ABAIXO:</div>
            </div>
            
            <form onSubmit={adicionarItem}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}>
                <div className="form-group"><input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={lidarComMudancaItem} /></div>
                <div className="form-group"><input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={lidarComMudancaItem} required /></div>
                <div className="form-group"><input type="text" name="discriminacao" placeholder="Descrição/Objeto" value={formItem.discriminacao} onChange={lidarComMudancaItem} required /></div>
                <div className="form-group"><input type="text" name="quantidade" placeholder="Qtd" value={formItem.quantidade} onChange={lidarComMudancaItem} required /></div>
                <div className="form-group"><input type="text" name="valorUnitario" placeholder="R$ Unit" value={formItem.valorUnitario} onChange={lidarComMudancaItem} required /></div>
                <button type="submit" style={{ backgroundColor: '#004a99', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={loading}>+ Consumir</button>
              </div>
            </form>
            <div className="modal-acoes"><button className="btn-cancelar" onClick={() => setIsModalLancamentoOpen(false)}>Fechar</button></div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR CONTRATO */}
      {isModalEditOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Editar Dados do Contrato</h2>
            <form onSubmit={salvarEdicaoContrato}>
              <div className="form-grid">
                <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formEdit.numeroContrato} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Nº do Processo</label><input type="text" name="numeroProcesso" required value={formEdit.numeroProcesso} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Nº Pregão</label><input type="text" name="numeroPregao" value={formEdit.numeroPregao} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Nº da Ata</label><input type="text" name="numeroAta" value={formEdit.numeroAta} onChange={lidarComMudancaEdit} /></div>
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