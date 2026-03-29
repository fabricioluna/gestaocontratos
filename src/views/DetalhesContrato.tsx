// src/views/DetalhesContrato.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, addDoc, updateDoc, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './DetalhesContrato.css';

interface ItemExtendido { id?: string; contratoId: string; numeroLote: string; numeroItem: string; discriminacao: string; unidade: string; quantidade: number; valorUnitario: number; valorTotalItem: number; dataAdicao?: string; tipoRegistro?: 'catalogo' | 'consumo'; }

const parseMoeda = (valor: string | number) => { if (!valor) return 0; if (typeof valor === 'number') return valor; return Number(valor.replace(/\./g, '').replace(',', '.')); };
const extrairNumeroPlanilha = (valor: any) => { if (typeof valor === 'number') return valor; if (!valor) return 0; const str = String(valor).trim(); if (str.includes(',')) return Number(str.replace(/\./g, '').replace(',', '.')); return Number(str); };
const formatarDataBr = (dataString: string) => { if (!dataString) return 'N/A'; const partes = dataString.split('-'); if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`; return dataString; };

const siglasOrgaos: { [key: string]: string } = { 'prefeitura': 'Prefeitura Municipal de Pesqueira', 'fmas': 'Fundo Municipal de Assistência Social (FMAS)', 'fme': 'Fundo Municipal de Educação (FME)', 'fms': 'Fundo Municipal de Saúde (FMS)' };

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
      if (docSnap.exists()) { const dados = { id: docSnap.id, ...docSnap.data() } as Contrato; setContrato(dados); setFormEdit({ ...dados, valorTotal: dados.valorTotal.toFixed(2).replace('.', ',') }); }
    });
    const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
    const unsubItens = onSnapshot(qItens, (querySnapshot) => {
      const lista: ItemExtendido[] = [];
      querySnapshot.forEach((d) => lista.push({ id: d.id, ...d.data() } as ItemExtendido));
      lista.sort((a, b) => {
        const cmpLote = (a.numeroLote || '').localeCompare(b.numeroLote || '', undefined, { numeric: true });
        if (cmpLote !== 0) return cmpLote;
        return (a.numeroItem || '').localeCompare(b.numeroItem || '', undefined, { numeric: true });
      });
      setItens(lista);
    });
    return () => { unsubContrato(); unsubItens(); };
  }, [id]);

  const lidarComMudancaEdit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setFormEdit((prev: any) => ({ ...prev, [e.target.name]: e.target.value })); };
  const lidarComMudancaItem = (e: React.ChangeEvent<HTMLInputElement>) => { setFormItem((prev: any) => ({ ...prev, [e.target.name]: e.target.value })); };

  const salvarEdicaoContrato = async (e: React.FormEvent) => {
    e.preventDefault(); if (!id || !contrato) return; setLoading(true);
    try {
      const novoValorGlobal = parseMoeda(formEdit.valorTotal);
      const valorJaConsumido = contrato.valorTotal - contrato.saldoContrato;
      const novoSaldo = novoValorGlobal - valorJaConsumido;
      await updateDoc(doc(db, 'contratos', id), { ...formEdit, valorTotal: novoValorGlobal, saldoContrato: novoSaldo, dataUltimaAtualizacao: new Date().toLocaleString('pt-BR') });
      alert('Contrato atualizado com sucesso!'); setIsModalEditOpen(false);
    } catch (error) { alert("Erro ao editar contrato."); } finally { setLoading(false); }
  };

  const excluirContrato = async () => {
    if (!id) return;
    if (window.confirm("Tem certeza que deseja excluir este contrato e TODO o seu histórico? Esta ação não pode ser desfeita.")) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', id));
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
        const querySnapshot = await getDocs(qItens);
        if (!querySnapshot.empty) { const batch = writeBatch(db); querySnapshot.forEach((itemDoc) => { batch.delete(itemDoc.ref); }); await batch.commit(); }
        alert("Contrato excluído com sucesso!"); navigate('/painel');
      } catch (error) { alert("Erro ao excluir."); setLoading(false); }
    }
  };

  const adicionarItem = async (e: React.FormEvent) => {
    e.preventDefault(); if (!contrato || !id) return; setLoading(true);
    try {
      const qtd = parseMoeda(formItem.quantidade); const vUnit = parseMoeda(formItem.valorUnitario);
      if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) { alert("Preencha corretamente os valores."); setLoading(false); return; }
      const valorTotalItem = qtd * vUnit; const dataAtual = new Date().toLocaleString('pt-BR');
      await addDoc(collection(db, 'itens'), { ...formItem, contratoId: id, quantidade: qtd, valorUnitario: vUnit, valorTotalItem: valorTotalItem, dataAdicao: dataAtual, tipoRegistro: 'consumo' });
      await updateDoc(doc(db, 'contratos', id), { saldoContrato: contrato.saldoContrato - valorTotalItem, dataUltimaAtualizacao: dataAtual });
      alert('Consumo registrado com sucesso!'); setFormItem({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' }); setIsModalLancamentoOpen(false);
    } catch (error) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  const importarPlanilha = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !contrato || !id) return; setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const batch = writeBatch(db); let valorTotalConsumidoLoop = 0; const dataAtual = new Date().toLocaleString('pt-BR'); let itensValidos = 0;
        data.forEach((row: any) => {
          const linha: any = {}; for (const key in row) linha[key.trim().toUpperCase()] = row[key];
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || '');
          const quantidade = extrairNumeroPlanilha(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = extrairNumeroPlanilha(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND'] || linha['VL. UNIT.'] || linha['VL. UNIT'] || linha['VL UNIT.']) || 0;
          const valorTotalItem = quantidade * valorUnitario;
          if (discriminacao && quantidade > 0) {
            const itemRef = doc(collection(db, 'itens'));
            batch.set(itemRef, { contratoId: id, numeroLote: String(linha['LOTE'] || 'Único'), numeroItem: String(linha['ITEM'] || ''), discriminacao, unidade: String(linha['UNIDADE'] || linha['UND.'] || linha['UND'] || ''), quantidade, valorUnitario, valorTotalItem, dataAdicao: dataAtual, tipoRegistro: 'consumo' });
            valorTotalConsumidoLoop += valorTotalItem; itensValidos++;
          }
        });
        if (itensValidos > 0) {
          await batch.update(doc(db, 'contratos', id), { saldoContrato: contrato.saldoContrato - valorTotalConsumidoLoop, dataUltimaAtualizacao: dataAtual });
          await batch.commit(); alert(`${itensValidos} itens processados!`); setIsModalLancamentoOpen(false);
        } else { alert('Nenhum item válido encontrado.'); }
      } catch (error) { alert("Erro ao ler Excel."); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  if (!contrato) return <div style={{textAlign: 'center', padding: '50px'}}>A carregar relatório...</div>;

  const itensCatalogo = itens.filter(i => i.tipoRegistro === 'catalogo' || !i.tipoRegistro);
  const itensConsumo = itens.filter(i => i.tipoRegistro === 'consumo');
  const totalItens = itensConsumo.length;
  const totalUnidades = itensConsumo.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalConsumido = itensConsumo.reduce((acc, curr) => acc + curr.valorTotalItem, 0);

  const gerarTabelaSaldos = () => {
    const mapaSaldos = new Map();
    itensCatalogo.forEach(cat => { const chave = `${cat.numeroLote}|${cat.numeroItem}`; mapaSaldos.set(chave, { lote: cat.numeroLote, item: cat.numeroItem, descricao: cat.discriminacao, unidade: cat.unidade, qtdContratada: cat.quantidade, vlUnitario: cat.valorUnitario, vlContratado: cat.valorTotalItem, qtdConsumida: 0, vlConsumido: 0 }); });
    itensConsumo.forEach(cons => {
      const chave = `${cons.numeroLote}|${cons.numeroItem}`;
      if (mapaSaldos.has(chave)) { const existente = mapaSaldos.get(chave); existente.qtdConsumida += cons.quantidade; existente.vlConsumido += cons.valorTotalItem; } 
      else { mapaSaldos.set(chave, { lote: cons.numeroLote, item: cons.numeroItem, descricao: cons.discriminacao, unidade: cons.unidade, qtdContratada: 0, vlUnitario: cons.valorUnitario, vlContratado: 0, qtdConsumida: cons.quantidade, vlConsumido: cons.valorTotalItem }); }
    });
    const arraySaldos = Array.from(mapaSaldos.values());
    arraySaldos.sort((a, b) => { const cmpLote = (a.lote || '').localeCompare(b.lote || '', undefined, { numeric: true }); if (cmpLote !== 0) return cmpLote; return (a.item || '').localeCompare(b.item || '', undefined, { numeric: true }); });
    return arraySaldos;
  };
  const tabelaDeSaldos = gerarTabelaSaldos();

  const gerarPDFDetalhado = () => {
    const doc = new jsPDF('landscape');
    const img = new Image();
    img.src = logo;
    img.onload = () => {
      doc.addImage(img, 'PNG', 14, 10, 25, 25);
      doc.setFontSize(16); doc.setTextColor(0, 74, 153);
      doc.text(siglasOrgaos[contrato.orgaoId] || 'Prefeitura Municipal', 45, 20);
      doc.setFontSize(12); doc.setTextColor(100, 100, 100);
      doc.text(`Relatório Detalhado do Contrato: Nº ${contrato.numeroContrato} / ${contrato.dataInicio.substring(0, 4)}`, 45, 28);
      doc.setFontSize(10); doc.setTextColor(50, 50, 50);
      doc.text(`Fornecedor: ${contrato.fornecedor}`, 14, 45);
      doc.text(`Objeto: ${contrato.objetoResumido}`, 14, 52);
      doc.text(`Modalidade / Nº: ${(contrato as any).modalidade || '-'} Nº ${contrato.numeroPregao || '-'}`, 14, 59);
      doc.text(`Nº da Ata: ${contrato.numeroAta || '-'}`, 14, 66);
      doc.text(`Fiscal: ${contrato.fiscalContrato || '-'}`, 14, 73);
      doc.text(`Validade: ${formatarDataBr(contrato.dataFim)}`, 14, 80);
      doc.setFontSize(11); doc.setTextColor(0, 74, 153);
      doc.text(`Valor Global: ${contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Saldo Atual: ${contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 89);

      let finalY = 97;
      if (itensCatalogo.length > 0) {
        doc.setFontSize(12); doc.setTextColor(0, 74, 153); doc.text('1. Planilha Original do Contrato', 14, finalY);
        autoTable(doc, { startY: finalY + 5, head: [['Lote', 'Item', 'Descrição', 'Und', 'Qtd', 'Vl. Unitário', 'Vl. Total']],
          body: itensCatalogo.map(item => [item.numeroLote === 'Único' || !item.numeroLote ? '-' : item.numeroLote, item.numeroItem, item.discriminacao.substring(0, 50) + (item.discriminacao.length > 50 ? '...' : ''), item.unidade, item.quantidade, item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]),
          theme: 'striped', headStyles: { fillColor: [0, 74, 153], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 2 }, alternateRowStyles: { fillColor: [240, 248, 255] }
        });
        finalY = (doc as any).lastAutoTable.finalY + 15;
      }
      if (tabelaDeSaldos.length > 0) {
        if (finalY > 180) { doc.addPage(); finalY = 20; }
        doc.setFontSize(12); doc.setTextColor(46, 125, 50); doc.text('2. Controle Físico-Financeiro (Saldos por Item)', 14, finalY);
        autoTable(doc, { startY: finalY + 5, head: [['Lote/Item', 'Descrição', 'Und', 'Vl. Unit', 'Qtd Contratada', 'Vl. Contratado', 'Qtd Consumo', 'Vl. Consumido', 'Saldo Qtd', 'Saldo Valor']],
          body: tabelaDeSaldos.map(linha => [`${linha.lote !== 'Único' && linha.lote ? linha.lote + '/' : ''}${linha.item}`, linha.descricao.substring(0, 40) + (linha.descricao.length > 40 ? '...' : ''), linha.unidade, linha.vlUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), linha.qtdContratada, linha.vlContratado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), linha.qtdConsumida, linha.vlConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), (linha.qtdContratada - linha.qtdConsumida).toString(), (linha.vlContratado - linha.vlConsumido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]),
          theme: 'striped', headStyles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 2 }, alternateRowStyles: { fillColor: [243, 251, 243] }
        });
        finalY = (doc as any).lastAutoTable.finalY + 15;
      }
      if (itensConsumo.length > 0) {
        if (finalY > 180) { doc.addPage(); finalY = 20; }
        doc.setFontSize(12); doc.setTextColor(220, 53, 69); doc.text('3. Histórico de Lançamentos (Auditoria de Empenhos)', 14, finalY);
        autoTable(doc, { startY: finalY + 5, head: [['Data', 'Lote/Item', 'Descrição', 'Quantidade', 'Vl. Unitário', 'Vl. Total']],
          body: itensConsumo.map(item => [item.dataAdicao || '-', `${item.numeroLote !== 'Único' && item.numeroLote ? item.numeroLote + '/' : ''}${item.numeroItem}`, item.discriminacao.substring(0, 40) + (item.discriminacao.length > 40 ? '...' : ''), `${item.quantidade} ${item.unidade}`, item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]),
          theme: 'striped', headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' }, styles: { fontSize: 8, cellPadding: 2 }, alternateRowStyles: { fillColor: [253, 246, 246] }
        });
      }
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    };
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={siglasOrgaos[contrato.orgaoId]}>{siglasOrgaos[contrato.orgaoId]}</h2>
        </div>
        <button className="btn-sair" onClick={() => navigate('/painel')} title="Voltar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Voltar</span>
        </button>
      </header>

      <main className="detalhes-container">
        <div className="acoes-relatorio">
          <button onClick={gerarPDFDetalhado} style={{ backgroundColor: 'white', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ fontSize: '16px' }}>📄</span> Gerar Relatório
          </button>
          <button className="btn-acao btn-excluir" onClick={excluirContrato} disabled={loading}>🗑️ Excluir Contrato</button>
          <button className="btn-acao btn-editar" onClick={() => setIsModalEditOpen(true)}>✏️ Editar Contrato</button>
          <button className="btn-acao btn-lancar" onClick={() => setIsModalLancamentoOpen(true)}>+ Lançar Consumo</button>
        </div>

        <div className="painel-relatorio">
          <div className="card-relatorio">
            <h3 style={{ color: '#004a99', marginTop: 0 }}>Dados Gerais do Contrato {contrato.numeroContrato}</h3>
            <p><strong>Fornecedor:</strong> {contrato.fornecedor}</p>
            <p><strong>Objeto:</strong> {contrato.objetoResumido}</p>
            <div className="dados-grid">
              <p><strong>Nº Processo:</strong> {contrato.numeroProcesso}</p>
              <p><strong>Modalidade / Nº:</strong> {(contrato as any).modalidade || '-'} {contrato.numeroPregao || '-'}</p>
              <p><strong>Nº da Ata:</strong> {contrato.numeroAta || '-'}</p>
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
                <div style={{ fontSize: '15px', color: '#555', marginBottom: '5px' }}><strong>Global:</strong> {contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                <div style={{ fontSize: '15px', color: '#dc3545', marginBottom: '10px' }}><strong>Consumido:</strong> {totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                <div style={{ borderTop: '1px solid #ddd', margin: '10px 0' }}></div>
                <div style={{ fontSize: '12px', color: '#666' }}>Saldo Atual Disponível</div>
                <div className={`valor-saldo ${contrato.saldoContrato >= 0 ? 'saldo-positivo' : 'saldo-negativo'}`}>{contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>Atualizado em: {contrato.dataUltimaAtualizacao || 'N/A'}</div>
              </div>
            </div>
            <div className="metricas-itens">
              <div><strong>{totalItens}</strong> Lançamentos</div>
              <div><strong>{totalUnidades.toLocaleString('pt-BR')}</strong> Unidades</div>
            </div>
          </div>
        </div>

        {itensCatalogo.length > 0 ? (
          <div className="secao-itens" style={{ marginBottom: '30px', overflowX: 'auto' }}>
            <h3 style={{ color: '#004a99' }}>📋 Planilha Original do Contrato</h3>
            <table className="tabela-itens">
              <thead>
                <tr><th>Lote</th><th>Item</th><th>Descrição</th><th>Unidade</th><th>Quantidade</th><th>Valor Unitário</th><th>Valor Total</th></tr>
              </thead>
              <tbody>
                {itensCatalogo.map(item => (
                  <tr key={item.id}><td style={{ textAlign: 'center' }}>{item.numeroLote === 'Único' || !item.numeroLote ? '-' : item.numeroLote}</td><td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.numeroItem}</td><td>{item.discriminacao}</td><td style={{ textAlign: 'center' }}>{item.unidade}</td><td style={{ textAlign: 'center' }}>{item.quantidade}</td><td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td style={{ color: '#555', fontWeight: 'bold' }}>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="secao-itens" style={{ marginBottom: '30px', textAlign: 'center', color: '#666' }}><h3 style={{ color: '#004a99' }}>📋 Planilha Original do Contrato</h3><p>Nenhum item original foi importado na criação deste contrato.</p></div>
        )}

        {tabelaDeSaldos.length > 0 && (
          <div className="secao-itens" style={{ marginBottom: '30px', overflowX: 'auto' }}>
            <h3 style={{ color: '#2e7d32' }}>📊 Controle Físico-Financeiro (Saldos por Item)</h3>
            <table className="tabela-saldos">
              <thead><tr><th>Lote/Item</th><th>Descrição</th><th>Und</th><th>Vl. Unit.</th><th>Qtd Contratada</th><th>Vl. Contratado</th><th style={{ backgroundColor: '#fff3cd', color: '#856404' }}>Qtd Consumida</th><th className="th-saldo">Qtd Saldo</th><th className="th-saldo">Vl. Saldo</th></tr></thead>
              <tbody>
                {tabelaDeSaldos.map((linha, index) => {
                  const saldoQtd = linha.qtdContratada - linha.qtdConsumida;
                  const saldoValor = linha.vlContratado - linha.vlConsumido;
                  return (
                    <tr key={index}><td style={{ fontWeight: 'bold' }}>{linha.lote !== 'Único' && linha.lote ? `${linha.lote} / ` : ''}{linha.item}</td><td className="desc-esquerda">{linha.descricao}</td><td>{linha.unidade}</td><td>{linha.vlUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{linha.qtdContratada}</td><td>{linha.vlContratado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td style={{ backgroundColor: '#fffdf5', fontWeight: 'bold', color: '#856404' }}>{linha.qtdConsumida}</td><td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold', color: saldoQtd < 0 ? 'red' : '#2e7d32' }}>{saldoQtd}</td><td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold', color: saldoValor < 0 ? 'red' : '#2e7d32' }}>{saldoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="secao-itens">
          <h3 style={{ color: '#dc3545' }}>📝 Histórico de Lançamentos (Auditoria de Empenhos)</h3>
          <table className="tabela-itens">
            <thead><tr><th>Lote/Item</th><th>Descrição</th><th>Qtd Consumida</th><th>Vl. Unit.</th><th>Valor Consumido</th><th>Data do Log</th></tr></thead>
            <tbody>
              {itensConsumo.length === 0 ? ( <tr><td colSpan={6} style={{textAlign: 'center'}}>Nenhum empenho/consumo registrado ainda.</td></tr> ) : (
                itensConsumo.map(item => (
                  <tr key={item.id}><td style={{ fontWeight: 'bold' }}>{item.numeroLote !== 'Único' && item.numeroLote ? `${item.numeroLote} / ` : ''}{item.numeroItem}</td><td>{item.discriminacao}</td><td style={{ textAlign: 'center' }}>{item.quantidade} {item.unidade}</td><td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td style={{ color: '#dc3545', fontWeight: 'bold' }}>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td style={{ color: '#666', fontSize: '12px' }}>{item.dataAdicao}</td></tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {isModalLancamentoOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <h2>Lançar Novo Consumo (Empenho)</h2>
            <div style={{ margin: '20px 0', textAlign: 'center' }}><input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={importarPlanilha} style={{ display: 'none' }} id="upload-excel-detalhes" /><label htmlFor="upload-excel-detalhes" style={{ backgroundColor: '#28a745', color: 'white', padding: '15px 30px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' }}>📄 Importar Planilha de Consumo</label><div style={{ margin: '15px 0', fontWeight: 'bold', color: '#666' }}>OU LANÇAMENTO MANUAL ABAIXO:</div></div>
            <form onSubmit={adicionarItem}><div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}><div className="form-group"><input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={lidarComMudancaItem} /></div><div className="form-group"><input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={lidarComMudancaItem} required /></div><div className="form-group"><input type="text" name="discriminacao" placeholder="Descrição/Objeto" value={formItem.discriminacao} onChange={lidarComMudancaItem} required /></div><div className="form-group"><input type="text" name="quantidade" placeholder="Qtd" value={formItem.quantidade} onChange={lidarComMudancaItem} required /></div><div className="form-group"><input type="text" name="valorUnitario" placeholder="R$ Unit" value={formItem.valorUnitario} onChange={lidarComMudancaItem} required /></div><button type="submit" style={{ backgroundColor: '#004a99', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={loading}>+ Consumir</button></div></form>
            <div className="modal-acoes"><button className="btn-cancelar" onClick={() => setIsModalLancamentoOpen(false)}>Fechar</button></div>
          </div>
        </div>
      )}

      {isModalEditOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Editar Dados do Contrato</h2>
            <form onSubmit={salvarEdicaoContrato}>
              <div className="form-grid">
                <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formEdit.numeroContrato} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group"><label>Nº do Processo</label><input type="text" name="numeroProcesso" required value={formEdit.numeroProcesso} onChange={lidarComMudancaEdit} /></div>
                <div className="form-group">
                  <label>Modalidade</label>
                  <select name="modalidade" required value={formEdit.modalidade} onChange={lidarComMudancaEdit} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}>
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
                <div className="form-group"><label>Nº da Licitação</label><input type="text" name="numeroPregao" value={formEdit.numeroPregao} onChange={lidarComMudancaEdit} /></div>
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
              <div className="modal-acoes"><button type="button" className="btn-cancelar" onClick={() => setIsModalEditOpen(false)}>Cancelar</button><button type="submit" className="btn-salvar" disabled={loading} style={{ backgroundColor: '#ffc107', color: '#333' }}>Salvar Alterações</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}