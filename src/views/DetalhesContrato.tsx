// src/views/DetalhesContrato.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './DetalhesContrato.css';

// Utilitários
import { formatarDataBr } from '../utils/formatters';

// Componentes Modularizados
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';
import ModalLancarConsumo from '../components/DetalhesContrato/ModalLancarConsumo';

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

const siglasOrgaos: { [key: string]: string } = { 
  'prefeitura': 'Prefeitura Municipal de Pesqueira', 
  'fmas': 'Fundo Municipal de Assistência Social (FMAS)', 
  'fme': 'Fundo Municipal de Educação (FME)', 
  'fms': 'Fundo Municipal de Saúde (FMS)' 
};

export default function DetalhesContrato() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Estados de Dados
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itens, setItens] = useState<ItemExtendido[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados dos Modais
  const [isModalLancamentoOpen, setIsModalLancamentoOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);

  // Carregamento de dados em tempo real
  useEffect(() => {
    if (!id) return;
    
    const unsubContrato = onSnapshot(doc(db, 'contratos', id), (docSnap) => {
      if (docSnap.exists()) {
        setContrato({ id: docSnap.id, ...docSnap.data() } as Contrato);
      }
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

  const excluirContrato = async () => {
    if (!id) return;
    if (window.confirm("Tem certeza que deseja excluir este contrato e TODO o seu histórico?")) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', id));
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
        const querySnapshot = await getDocs(qItens);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((itemDoc) => batch.delete(itemDoc.ref));
          await batch.commit();
        }
        alert("Contrato excluído com sucesso!");
        navigate('/painel');
      } catch (error) {
        alert("Erro ao excluir.");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!contrato) return <div className="loading-container">A carregar contrato...</div>;

  // Cálculos de Itens e Saldos
  const itensCatalogo = itens.filter(i => i.tipoRegistro === 'catalogo' || !i.tipoRegistro);
  const itensConsumo = itens.filter(i => i.tipoRegistro === 'consumo');
  const totalItens = itensConsumo.length;
  const totalUnidades = itensConsumo.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalConsumido = itensConsumo.reduce((acc, curr) => acc + curr.valorTotalItem, 0);

  const gerarTabelaSaldos = () => {
    const mapaSaldos = new Map();
    itensCatalogo.forEach(cat => {
      const chave = `${cat.numeroLote}|${cat.numeroItem}`;
      mapaSaldos.set(chave, { 
        lote: cat.numeroLote, 
        item: cat.numeroItem, 
        descricao: cat.discriminacao, 
        unidade: cat.unidade, 
        qtdContratada: cat.quantidade, 
        vlUnitario: cat.valorUnitario, 
        vlContratado: cat.valorTotalItem, 
        qtdConsumida: 0, 
        vlConsumido: 0 
      });
    });
    
    itensConsumo.forEach(cons => {
      const chave = `${cons.numeroLote}|${cons.numeroItem}`;
      if (mapaSaldos.has(chave)) {
        const existente = mapaSaldos.get(chave);
        existente.qtdConsumida += cons.quantidade;
        existente.vlConsumido += cons.valorTotalItem;
      }
    });
    return Array.from(mapaSaldos.values());
  };
  const tabelaDeSaldos = gerarTabelaSaldos();

  // Relatório PDF Detalhado
  const gerarPDFDetalhado = () => {
    const docPdf = new jsPDF('landscape');
    const img = new Image();
    img.src = logo;
    img.onload = () => {
      docPdf.addImage(img, 'PNG', 14, 10, 25, 25);
      docPdf.setFontSize(16); docPdf.setTextColor(0, 74, 153);
      docPdf.text(siglasOrgaos[contrato.orgaoId] || 'Prefeitura Municipal', 45, 20);
      docPdf.setFontSize(12); docPdf.setTextColor(100, 100, 100);
      docPdf.text(`Relatório Detalhado: Contrato Nº ${contrato.numeroContrato} / ${contrato.dataInicio.substring(0, 4)}`, 45, 28);
      
      docPdf.setFontSize(10); docPdf.setTextColor(50, 50, 50);
      docPdf.text(`Fornecedor: ${contrato.fornecedor}`, 14, 45);
      docPdf.text(`Objeto: ${contrato.objetoResumido}`, 14, 52);
      docPdf.text(`Modalidade: ${contrato.modalidade || '-'} Nº ${contrato.numeroPregao || '-'}`, 14, 59);
      docPdf.text(`Fiscal: ${contrato.fiscalContrato || '-'} | Validade: ${formatarDataBr(contrato.dataFim)}`, 14, 66);
      
      docPdf.setFontSize(11); docPdf.setTextColor(0, 74, 153);
      docPdf.text(`Valor Global: ${contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Saldo Atual: ${contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 75);

      let finalY = 85;

      // 1. Tabela Catálogo
      if (itensCatalogo.length > 0) {
        docPdf.setFontSize(12); docPdf.text('1. Planilha Original do Contrato', 14, finalY);
        autoTable(docPdf, { 
          startY: finalY + 5, 
          head: [['Lote', 'Item', 'Descrição', 'Und', 'Qtd', 'Unitário', 'Total']],
          body: itensCatalogo.map(i => [i.numeroLote, i.numeroItem, i.discriminacao.substring(0, 50), i.unidade, i.quantidade, i.valorUnitario.toLocaleString('pt-BR'), i.valorTotalItem.toLocaleString('pt-BR')]),
          theme: 'striped', headStyles: { fillColor: [0, 74, 153] }, styles: { fontSize: 8 }
        });
        finalY = (docPdf as any).lastAutoTable.finalY + 15;
      }

      // 2. Tabela Saldos
      if (tabelaDeSaldos.length > 0) {
        if (finalY > 180) { docPdf.addPage(); finalY = 20; }
        docPdf.setFontSize(12); docPdf.setTextColor(46, 125, 50);
        docPdf.text('2. Controle Físico-Financeiro (Saldos por Item)', 14, finalY);
        autoTable(docPdf, { 
          startY: finalY + 5, 
          head: [['Item', 'Descrição', 'Und', 'Contratado', 'Consumido', 'Saldo Qtd', 'Saldo Valor']],
          body: tabelaDeSaldos.map(l => [`${l.lote}/${l.item}`, l.descricao.substring(0, 40), l.unidade, l.qtdContratada, l.qtdConsumida, l.qtdContratada - l.qtdConsumida, (l.vlContratado - l.vlConsumido).toLocaleString('pt-BR')]),
          theme: 'striped', headStyles: { fillColor: [46, 125, 50] }, styles: { fontSize: 8 }
        });
      }

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
          <h2 title={siglasOrgaos[contrato.orgaoId]}>{siglasOrgaos[contrato.orgaoId]}</h2>
        </div>
        <button className="btn-sair" onClick={() => navigate('/painel')}>
          <span>Voltar</span>
        </button>
      </header>

      <main className="detalhes-container">
        <div className="acoes-relatorio">
          <button onClick={gerarPDFDetalhado} className="btn-gerar-pdf">📄 Gerar Relatório</button>
          <button className="btn-acao btn-excluir" onClick={excluirContrato} disabled={loading}>🗑️ Excluir</button>
          <button className="btn-acao btn-editar" onClick={() => setIsModalEditOpen(true)}>✏️ Editar</button>
          <button className="btn-acao btn-lancar" onClick={() => setIsModalLancamentoOpen(true)}>+ Lançar Consumo</button>
        </div>

        <div className="painel-relatorio">
          <div className="card-relatorio">
            <h3 style={{ color: '#004a99', marginTop: 0 }}>Dados Gerais do Contrato {contrato.numeroContrato}</h3>
            <p><strong>Fornecedor:</strong> {contrato.fornecedor}</p>
            <p><strong>Objeto:</strong> {contrato.objetoResumido}</p>
            <div className="dados-grid">
              <p><strong>Nº Processo:</strong> {contrato.numeroProcesso}</p>
              <p><strong>Modalidade / Nº:</strong> {contrato.modalidade || '-'} {contrato.numeroPregao || '-'}</p>
              <p><strong>Validade:</strong> {formatarDataBr(contrato.dataFim)}</p>
              <p><strong>Fiscal:</strong> {contrato.fiscalContrato || 'Não informado'}</p>
            </div>
          </div>
          
          <div className="card-financeiro">
            <div className="bloco-saldo">
              <div className="label-global">Global: {contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div className="label-consumido">Consumido: {totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              <div className="divisor"></div>
              <div className="label-disponivel">Saldo Disponível</div>
              <div className={`valor-saldo ${contrato.saldoContrato >= 0 ? 'saldo-positivo' : 'saldo-negativo'}`}>
                {contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>
        </div>

        {/* Secção de Tabelas */}
        {tabelaDeSaldos.length > 0 && (
          <div className="secao-itens">
            <h3 style={{ color: '#2e7d32' }}>📊 Controle Físico-Financeiro (Saldos por Item)</h3>
            <table className="tabela-saldos">
              <thead>
                <tr>
                  <th>Lote/Item</th><th>Descrição</th><th>Und</th><th>Vl. Unit.</th><th>Qtd Contratada</th><th style={{ backgroundColor: '#fff3cd' }}>Qtd Consumida</th><th className="th-saldo">Qtd Saldo</th><th className="th-saldo">Vl. Saldo</th>
                </tr>
              </thead>
              <tbody>
                {tabelaDeSaldos.map((linha, idx) => (
                  <tr key={idx}>
                    <td>{linha.lote}/{linha.item}</td>
                    <td className="desc-esquerda">{linha.descricao}</td>
                    <td>{linha.unidade}</td>
                    <td>{linha.vlUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>{linha.qtdContratada}</td>
                    <td style={{ backgroundColor: '#fffdf5', fontWeight: 'bold' }}>{linha.qtdConsumida}</td>
                    <td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold' }}>{linha.qtdContratada - linha.qtdConsumida}</td>
                    <td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold' }}>{(linha.vlContratado - linha.vlConsumido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* MODAIS MODULARIZADOS */}
      <ModalLancarConsumo 
        isOpen={isModalLancamentoOpen} 
        onClose={() => setIsModalLancamentoOpen(false)} 
        contratoId={id!} 
        saldoContrato={contrato.saldoContrato}
      />

      <ModalEditarContrato 
        isOpen={isModalEditOpen} 
        onClose={() => setIsModalEditOpen(false)} 
        contrato={contrato} 
      />
    </div>
  );
}