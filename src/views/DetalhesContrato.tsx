// src/views/DetalhesContrato.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs, writeBatch, updateDoc, arrayUnion } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../firebase';
import type { Contrato, Aditivo, ItemAditivo } from '../types';
import logo from '../assets/logopmp.png';
import './DetalhesContrato.css';

// IMPORTAÇÃO DOS COMPONENTES MODULARES
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';
import ModalLancarConsumo from '../components/DetalhesContrato/ModalLancarConsumo';
import { extrairDadosContratoComIA } from '../services/geminiService'; // Importação do Serviço Gemini

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

const formatarDataBr = (dataString: string) => {
  if (!dataString) return 'N/A';
  const partes = dataString.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return dataString;
};

const nomesOrgaos: { [key: string]: string } = {
  'prefeitura': 'Prefeitura Municipal de Pesqueira',
  'fmas': 'Fundo Municipal de Assistência Social (FMAS)',
  'fme': 'Fundo Municipal de Educação (FME)',
  'fms': 'Fundo Municipal de Saúde (FMS)'
};

export default function DetalhesContrato() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itens, setItens] = useState<ItemExtendido[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalLancamentoOpen, setIsModalLancamentoOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);

  // Estados para Aditivo
  const [isModalAditivoOpen, setIsModalAditivoOpen] = useState(false);
  const [aditivoDescricao, setAditivoDescricao] = useState('');
  const [aditivoTipo, setAditivoTipo] = useState<'prazo' | 'valor' | 'ambos'>('prazo');
  const [aditivoOperacao, setAditivoOperacao] = useState<'acrescimo' | 'supressao'>('acrescimo');
  const [aditivoValor, setAditivoValor] = useState<number | ''>('');
  const [aditivoNovaData, setAditivoNovaData] = useState('');
  
  // Novos estados para Aditivo de Itens e PDF
  const [itensDoAditivo, setItensDoAditivo] = useState<ItemAditivo[]>([]);
  const [arquivoPdfAditivo, setArquivoPdfAditivo] = useState<File | null>(null);
  const [processandoPdfIA, setProcessandoPdfIA] = useState(false);

  const [isModalDistratoOpen, setIsModalDistratoOpen] = useState(false);
  const [distratoData, setDistratoData] = useState('');
  const [distratoMotivo, setDistratoMotivo] = useState('');

  // --- MELHORIA UX: FECHAR MODAIS COM ESC ---
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalLancamentoOpen(false);
        setIsModalEditOpen(false);
        setIsModalAditivoOpen(false);
        setIsModalDistratoOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!id) return;
    
    const unsubContrato = onSnapshot(doc(db, 'contratos', id), (docSnap) => {
      if (docSnap.exists()) {
        const dados = { id: docSnap.id, ...docSnap.data() } as Contrato;
        setContrato(dados);
      }
    });

    const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
    const unsubItens = onSnapshot(qItens, (querySnapshot) => {
      const lista: ItemExtendido[] = [];
      querySnapshot.forEach((d) => lista.push({ id: d.id, ...d.data() } as ItemExtendido));
      
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

  const excluirContrato = async () => {
    if (!id) return;
    if (window.confirm("Tem certeza que deseja excluir este contrato e TODO o seu histórico? Esta ação não pode ser desfeita.")) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', id));
        
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
        const querySnapshot = await getDocs(qItens);
        
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((itemDoc) => {
            batch.delete(itemDoc.ref);
          });
          await batch.commit();
        }
        
        alert("Contrato excluído com sucesso!");
        navigate('/painel');
      } catch (error) {
        alert("Erro ao excluir contrato.");
        setLoading(false);
      }
    }
  };

  // --- LÓGICA DE INTEGRAÇÃO COM GEMINI (IA) ---
  const lidarProcessamentoIA = async () => {
    if (!arquivoPdfAditivo) {
      alert("Por favor, selecione o arquivo do Termo Aditivo primeiro.");
      return;
    }
    
    setProcessandoPdfIA(true);
    try {
      // Como a API precisa de texto, lemos o arquivo PDF como base (texto bruto).
      // Em produção real, você pode precisar de uma biblioteca como pdf.js para extrair texto limpo de PDF binário antes de enviar,
      // mas o Gemini Flash 1.5 tem capacidades avançadas de leitura se o texto básico estiver presente ou se anexar via API direta.
      const leitor = new FileReader();
      
      leitor.onload = async (evento) => {
        try {
          const textoBruto = evento.target?.result as string;
          
          // Chama a sua função importada do geminiService.ts
          const dadosExtraidos = await extrairDadosContratoComIA(textoBruto);

          if (dadosExtraidos && dadosExtraidos.itens && dadosExtraidos.itens.length > 0) {
            setItensDoAditivo(dadosExtraidos.itens);
            
            // Calculando o valor global aditivado com base nos itens extraídos
            const soma = dadosExtraidos.itens.reduce((acc: number, item: any) => acc + (Number(item.valorTotalItem) || 0), 0);
            setAditivoValor(soma);
            
            if (dadosExtraidos.dataFim) {
              setAditivoNovaData(dadosExtraidos.dataFim);
              setAditivoTipo('ambos');
            }
            
            alert("✅ Inteligência Artificial extraiu os itens com sucesso!");
          } else {
            alert("A IA analisou o arquivo, mas não encontrou uma tabela de itens clara.");
          }
        } catch (erroApi) {
          console.error(erroApi);
          alert("Erro no serviço da IA. Verifique sua chave de API ou a legibilidade do documento.");
        } finally {
          setProcessandoPdfIA(false);
        }
      };

      // Tenta ler o conteúdo. Se for um DOCX/TXT funciona perfeitamente. 
      // Se for PDF, o texto extraído nativamente no frontend pode vir "sujo", mas o Gemini costuma conseguir limpar.
      leitor.readAsText(arquivoPdfAditivo);

    } catch (error) {
      console.error("Erro na leitura de arquivo:", error);
      alert("Falha ao ler o arquivo selecionado.");
      setProcessandoPdfIA(false);
    }
  };

  const salvarAditivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !contrato) return;

    try {
      setLoading(true);
      let novoValorTotal = Number(contrato.valorTotal) || 0;
      let novoSaldo = Number(contrato.saldoContrato) || 0;
      let novaDataFimStr = contrato.dataFim;
      let valorAlteracao = 0;
      let urlPdfSalvo = ''; // Preparado para o Firebase Storage futuro

      if (aditivoTipo === 'valor' || aditivoTipo === 'ambos') {
        const v = Number(aditivoValor);
        valorAlteracao = aditivoOperacao === 'acrescimo' ? v : -v;
        
        const limite25 = novoValorTotal * 0.25;
        if (v > limite25 && aditivoOperacao === 'acrescimo') {
           if(!window.confirm(`Atenção: O acréscimo de ${v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} supera 25% do valor do contrato inicial. Deseja prosseguir sob amparo legal específico?`)) {
               setLoading(false);
               return;
           }
        }
        novoValorTotal += valorAlteracao;
        novoSaldo += valorAlteracao;
      }

      if (aditivoTipo === 'prazo' || aditivoTipo === 'ambos') {
        if (!aditivoNovaData) {
          alert('Informe a nova data de validade.');
          setLoading(false);
          return;
        }
        novaDataFimStr = aditivoNovaData;
      }

      const novoAditivo: Aditivo = {
        id: Date.now().toString(),
        descricao: aditivoDescricao || 'Termo Aditivo',
        dataAditivo: new Date().toISOString().split('T')[0],
        tipo: aditivoTipo,
        valorAditivado: valorAlteracao,
        novaDataFim: (aditivoTipo === 'prazo' || aditivoTipo === 'ambos') ? aditivoNovaData : undefined,
        dataRegistro: new Date().toLocaleString('pt-BR'),
        itensAditivados: itensDoAditivo.length > 0 ? itensDoAditivo : undefined,
        urlArquivoPdf: urlPdfSalvo
      };

      await updateDoc(doc(db, 'contratos', id), {
        valorTotal: novoValorTotal,
        saldoContrato: novoSaldo,
        dataFim: novaDataFimStr,
        aditivos: arrayUnion(novoAditivo),
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });

      alert('Aditivo registrado com sucesso!');
      setIsModalAditivoOpen(false);
      
      // Limpar formulário
      setAditivoDescricao('');
      setAditivoValor('');
      setAditivoNovaData('');
      setItensDoAditivo([]);
      setArquivoPdfAditivo(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar aditivo.");
    } finally {
      setLoading(false);
    }
  };

  const salvarDistrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !contrato) return;

    try {
      setLoading(true);
      await updateDoc(doc(db, 'contratos', id), {
        dataDistrato: distratoData,
        motivoDistrato: distratoMotivo,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      
      alert('Distrato registrado com sucesso!');
      setIsModalDistratoOpen(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao registrar distrato.");
    } finally {
      setLoading(false);
    }
  };

  if (!contrato) return <div style={{textAlign: 'center', padding: '50px'}}>A carregar relatório...</div>;

  // --- LÓGICA DE ALERTAS E CORES ---
  const hoje = new Date();
  const vencimento = new Date(contrato.dataFim);
  const diffDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
  
  let corValidade = diffDias <= 30 ? '#dc3545' : diffDias <= 90 ? '#856404' : '#334155';
  let fundoValidade = diffDias <= 30 ? '#ffebee' : diffDias <= 90 ? '#fff9c4' : '#f8fafc';
  let borderValidade = diffDias <= 30 ? '#ff000033' : diffDias <= 90 ? '#ffc10733' : '#e2e8f0';
  let labelValidade = diffDias < 0 ? "Vencido" : diffDias <= 30 ? `Vence em ${diffDias} dias` : diffDias <= 90 ? `Restam ${diffDias} dias` : "Válido";

  // Se estiver distratado, sobrepor as regras de cor
  if (contrato.dataDistrato) {
    corValidade = '#dc3545';
    fundoValidade = '#ffebee';
    borderValidade = '#dc3545';
    labelValidade = "Encerrado (Distratado)";
  }

  const percentualSaldo = (contrato.saldoContrato / contrato.valorTotal);
  const alertaSaldoCritico = percentualSaldo < 0.3;

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

    // INJEÇÃO DOS ITENS ADITIVADOS NO SALDO
    if (contrato.aditivos) {
      contrato.aditivos.forEach(aditivo => {
        if (aditivo.itensAditivados) {
          aditivo.itensAditivados.forEach(itemAditivo => {
            const chave = `${itemAditivo.numeroLote}|${itemAditivo.numeroItem}`;
            if (mapaSaldos.has(chave)) {
              const existente = mapaSaldos.get(chave);
              // Lógica de aditivo simples: se tem item, consideramos como acréscimo de qtd/valor
              existente.qtdContratada += itemAditivo.quantidade;
              existente.vlContratado += itemAditivo.valorTotalItem;
            } else {
              mapaSaldos.set(chave, {
                lote: itemAditivo.numeroLote,
                item: itemAditivo.numeroItem,
                descricao: `${itemAditivo.discriminacao} (Aditivado)`,
                unidade: itemAditivo.unidade,
                qtdContratada: itemAditivo.quantidade,
                vlUnitario: itemAditivo.valorUnitario,
                vlContratado: itemAditivo.valorTotalItem,
                qtdConsumida: 0,
                vlConsumido: 0
              });
            }
          });
        }
      });
    }

    itensConsumo.forEach(cons => {
      const chave = `${cons.numeroLote}|${cons.numeroItem}`;
      if (mapaSaldos.has(chave)) {
        const existente = mapaSaldos.get(chave);
        existente.qtdConsumida += cons.quantidade;
        existente.vlConsumido += cons.valorTotalItem;
      } else {
        mapaSaldos.set(chave, {
          lote: cons.numeroLote,
          item: cons.numeroItem,
          descricao: cons.discriminacao,
          unidade: cons.unidade,
          qtdContratada: 0,
          vlUnitario: cons.valorUnitario,
          vlContratado: 0,
          qtdConsumida: cons.quantidade,
          vlConsumido: cons.valorTotalItem
        });
      }
    });

    const arraySaldos = Array.from(mapaSaldos.values());
    arraySaldos.sort((a, b) => {
      const cmpLote = (a.lote || '').localeCompare(b.lote || '', undefined, { numeric: true });
      if (cmpLote !== 0) return cmpLote;
      return (a.item || '').localeCompare(b.item || '', undefined, { numeric: true });
    });

    return arraySaldos;
  };

  const tabelaDeSaldos = gerarTabelaSaldos();

  // --- GERAÇÃO DE RELATÓRIO PDF COMPLETO ---
  const gerarRelatorioPDF = () => {
    const docPdf = new jsPDF('landscape'); 
    
    const gerarConteudo = () => {
      // CABEÇALHO
      docPdf.setFontSize(16);
      docPdf.setTextColor(0, 74, 153);
      docPdf.text(`Relatório de Contrato: ${contrato.numeroContrato}`, 45, 20);
      
      docPdf.setFontSize(10);
      docPdf.setTextColor(100, 100, 100);
      let statusTexto = `Órgão: ${nomesOrgaos[contrato.orgaoId] || ''} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
      if (contrato.dataDistrato) {
        statusTexto += ` | STATUS: DISTRATADO EM ${formatarDataBr(contrato.dataDistrato)}`;
      }
      docPdf.text(statusTexto, 45, 26);

      let currentY = 40;

      // --- 1. DADOS GERAIS ---
      docPdf.setFontSize(12);
      docPdf.setTextColor(contrato.dataDistrato ? 220 : 0, contrato.dataDistrato ? 53 : 74, contrato.dataDistrato ? 69 : 153);
      docPdf.text('Dados Gerais do Contrato', 14, currentY);
      currentY += 6;

      docPdf.setFontSize(10);
      docPdf.setTextColor(50, 50, 50);
      docPdf.text(`Fornecedor: ${contrato.fornecedor}`, 14, currentY); currentY += 5;
      docPdf.text(`Objeto: ${contrato.objetoResumido}`, 14, currentY); currentY += 5;
      
      let linhaProcesso = `Processo Nº: ${contrato.numeroProcesso || '-'}`;
      
      const modalidadeTexto = contrato.modalidade;
      const numModalidade = contrato.numeroModalidade || contrato.numeroPregao;
      
      if (modalidadeTexto && numModalidade) {
        linhaProcesso += `  |  ${modalidadeTexto} Nº: ${numModalidade}`;
      } else if (modalidadeTexto) {
        linhaProcesso += `  |  Modalidade: ${modalidadeTexto}`;
      } else if (numModalidade) {
        linhaProcesso += `  |  Modalidade Nº: ${numModalidade}`;
      }

      if (contrato.numeroAta && contrato.numeroAta.trim() !== '') {
        linhaProcesso += `  |  Ata Nº: ${contrato.numeroAta}`;
      }

      docPdf.text(linhaProcesso, 14, currentY); currentY += 5;
      
      docPdf.text(`Data Início: ${formatarDataBr(contrato.dataInicio)}  |  Validade: ${formatarDataBr(contrato.dataFim)}`, 14, currentY); currentY += 5;
      docPdf.text(`Fiscal Responsável: ${contrato.fiscalContrato || 'Não informado'}`, 14, currentY); currentY += 5;
      
      if (contrato.observacao && contrato.observacao.trim() !== '') {
        docPdf.text(`Observações: ${contrato.observacao}`, 14, currentY); 
        currentY += 10;
      } else {
        currentY += 5; 
      }

      // --- 2. POSIÇÃO FINANCEIRA ---
      docPdf.setFontSize(12);
      docPdf.setTextColor(40, 167, 69); // Verde
      docPdf.text('Posição Financeira', 14, currentY);
      currentY += 6;

      docPdf.setFontSize(10);
      docPdf.setTextColor(50, 50, 50);
      docPdf.text(`Global Autorizado: ${contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}  |  Valor Consumido: ${totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}  |  Saldo Atual Disponível: ${contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY); 
      currentY += 12;

      // --- 3. HISTÓRICO DE ADITIVOS E SEUS ITENS ---
      if (contrato.aditivos && contrato.aditivos.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(255, 140, 0); // Laranja para Aditivos
        docPdf.text('Histórico de Aditivos (Lei 14.133)', 14, currentY);
        currentY += 4;

        const aditivosData: any[] = [];
        contrato.aditivos.forEach(ad => {
           aditivosData.push([
             ad.descricao,
             ad.tipo.toUpperCase(),
             ad.novaDataFim ? formatarDataBr(ad.novaDataFim) : '-',
             ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-',
             ad.dataRegistro
           ]);
           
           // Inserir linhas secundárias para os itens do aditivo, se houver
           if (ad.itensAditivados && ad.itensAditivados.length > 0) {
             ad.itensAditivados.forEach(itemAd => {
               aditivosData.push([
                 `  ↳ Lote ${itemAd.numeroLote} - Item ${itemAd.numeroItem}: ${itemAd.discriminacao}`,
                 '', 
                 '',
                 `+ ${itemAd.quantidade} ${itemAd.unidade}`,
                 `Vl. Total: ${itemAd.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
               ]);
             });
           }
        });

        autoTable(docPdf, {
          startY: currentY,
          head: [['Descrição / Itens', 'Tipo', 'Nova Validade', 'Vl. Global Aditivado / Qtd', 'Data Registro / Vl. Item']],
          body: aditivosData,
          theme: 'striped',
          headStyles: { fillColor: [255, 140, 0] },
          styles: { fontSize: 8, cellPadding: 2 }
        });
        currentY = (docPdf as any).lastAutoTable.finalY + 12;
      }

      // --- 4. TABELA: PLANILHA ORIGINAL ---
      if (itensCatalogo.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }
        
        docPdf.setFontSize(12);
        docPdf.setTextColor(0, 74, 153);
        docPdf.text('Planilha Original do Contrato', 14, currentY);
        currentY += 4;

        const catData = itensCatalogo.map(item => [
          item.numeroLote === 'Único' || !item.numeroLote ? '-' : item.numeroLote,
          item.numeroItem,
          item.discriminacao,
          item.unidade,
          item.quantidade.toString(),
          item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]);

        autoTable(docPdf, {
          startY: currentY,
          head: [['Lote', 'Item', 'Descrição', 'Unidade', 'Qtd', 'Vl. Unitário', 'Vl. Total']],
          body: catData,
          theme: 'striped',
          headStyles: { fillColor: [0, 74, 153] },
          styles: { fontSize: 8, cellPadding: 2 }
        });
        currentY = (docPdf as any).lastAutoTable.finalY + 12;
      }

      // --- 5. TABELA: CONTROLE FÍSICO-FINANCEIRO (SALDOS) ---
      if (tabelaDeSaldos.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(46, 125, 50); // Verde
        docPdf.text('Controle Físico-Financeiro (Saldos por Item)', 14, currentY);
        currentY += 4;

        const saldosData = tabelaDeSaldos.map(linha => {
          const saldoQtd = linha.qtdContratada - linha.qtdConsumida;
          const saldoValor = linha.vlContratado - linha.vlConsumido;
          return [
            (linha.lote !== 'Único' && linha.lote ? `${linha.lote} / ` : '') + linha.item,
            linha.descricao,
            linha.unidade,
            linha.vlUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            linha.qtdContratada.toString(),
            linha.vlContratado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            linha.qtdConsumida.toString(),
            linha.vlConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            saldoQtd.toString(),
            saldoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          ];
        });

        autoTable(docPdf, {
          startY: currentY,
          head: [['Lote/Item', 'Descrição', 'Und', 'Vl. Unit.', 'Qtd. Cont.', 'Vl. Cont.', 'Qtd. Cons.', 'Vl. Cons.', 'Sld. Qtd', 'Sld. Valor']],
          body: saldosData,
          theme: 'grid',
          headStyles: { fillColor: [46, 125, 50] },
          styles: { fontSize: 7, cellPadding: 2 }
        });
        currentY = (docPdf as any).lastAutoTable.finalY + 12;
      }

      // --- 6. TABELA: HISTÓRICO DE LANÇAMENTOS ---
      if (itensConsumo.length > 0) {
        if (currentY > 150) { docPdf.addPage(); currentY = 20; }

        docPdf.setFontSize(12);
        docPdf.setTextColor(220, 53, 69); // Vermelho
        docPdf.text('Histórico de Lançamentos (Auditoria de Empenhos)', 14, currentY);
        currentY += 4;

        const consumoData = itensConsumo.map(item => [
          (item.numeroLote !== 'Único' && item.numeroLote ? `${item.numeroLote} / ` : '') + item.numeroItem,
          item.discriminacao,
          `${item.quantidade} ${item.unidade}`,
          item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          item.dataAdicao || '-'
        ]);

        autoTable(docPdf, {
          startY: currentY,
          head: [['Lote/Item', 'Descrição', 'Qtd Consumida', 'Vl. Unit.', 'Valor Consumido', 'Data do Log']],
          body: consumoData,
          theme: 'striped',
          headStyles: { fillColor: [220, 53, 69] },
          styles: { fontSize: 8, cellPadding: 3 }
        });
      }

      // Salva e abre o PDF
      const pdfBlob = docPdf.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    };

    const img = new Image();
    img.src = logo;
    img.onload = () => {
      docPdf.addImage(img, 'PNG', 14, 10, 25, 25);
      gerarConteudo();
    };
    img.onerror = () => {
      gerarConteudo(); 
    };
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={`Relatório de Contrato: ${contrato.numeroContrato}`}>
            Relatório de Contrato: {contrato.numeroContrato}
          </h2>
        </div>
        <button className="btn-sair" onClick={() => navigate('/painel')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Voltar
        </button>
      </header>

      <main className="detalhes-container">
        
        {contrato.dataDistrato && (
          <div style={{ backgroundColor: '#dc3545', color: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            ⚠️ CONTRATO DISTRATADO EM {formatarDataBr(contrato.dataDistrato)}
            {contrato.motivoDistrato && <div style={{ fontSize: '14px', marginTop: '5px', fontWeight: 'normal' }}>Motivo: {contrato.motivoDistrato}</div>}
          </div>
        )}

        <div className="acoes-relatorio">
          <button className="btn-acao btn-gerar" onClick={gerarRelatorioPDF}>📄 Gerar Relatório</button>
          <button className="btn-acao btn-aditivo" onClick={() => setIsModalAditivoOpen(true)} disabled={!!contrato.dataDistrato}>➕ Aditivo</button>
          <button className="btn-acao btn-distrato" onClick={() => setIsModalDistratoOpen(true)} disabled={!!contrato.dataDistrato}>🛑 Distrato</button>
          <button className="btn-acao btn-editar" onClick={() => setIsModalEditOpen(true)} disabled={!!contrato.dataDistrato}>✏️ Editar Contrato</button>
          
          <button className="btn-acao btn-excluir" onClick={excluirContrato} disabled={loading}>🗑️ Excluir Contrato</button>
          
          <button 
            className="btn-acao btn-lancar" 
            onClick={() => setIsModalLancamentoOpen(true)}
            disabled={!!contrato.dataDistrato}
            title={contrato.dataDistrato ? "Contrato Distratado" : "Funcionalidade em manutenção para a implementação de Secretarias (Fase 2)"}
          >
            + Lançar Consumo (Empenho)
          </button>
        </div>

        <div className="painel-relatorio">
          
          <div className="card-relatorio">
            <h3 style={{ color: '#1e293b', marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              Dados Gerais do Contrato
            </h3>
            
            <h4 className="fornecedor-destaque">{contrato.fornecedor}</h4>
            <p className="objeto-destaque">{contrato.objetoResumido}</p>

            <div className="dashboard-cards">
              
              <div className="info-card">
                <span className="card-label">Processo Nº</span>
                <span className="card-value">{contrato.numeroProcesso || '-'}</span>
              </div>

              <div className="info-card">
                <span className="card-label">Modalidade</span>
                <span className="card-value">{contrato.modalidade || '-'}</span>
              </div>

              <div className="info-card">
                <span className="card-label">{contrato.modalidade ? `${contrato.modalidade} Nº` : 'Nº Modalidade'}</span>
                <span className="card-value">{contrato.numeroModalidade || contrato.numeroPregao || '-'}</span>
              </div>

              {contrato.numeroAta && contrato.numeroAta.trim() !== '' && (
                <div className="info-card">
                  <span className="card-label">Ata Nº</span>
                  <span className="card-value">{contrato.numeroAta}</span>
                </div>
              )}

              <div className="info-card">
                <span className="card-label">Data Início</span>
                <span className="card-value">{formatarDataBr(contrato.dataInicio)}</span>
              </div>

              <div className="info-card" style={{ backgroundColor: fundoValidade, borderColor: borderValidade }}>
                <span className="card-label" style={{ color: contrato.dataDistrato ? '#dc3545' : diffDias <= 90 ? corValidade : '#94a3b8' }}>Validade</span>
                <span className="card-value" style={{ color: corValidade }}>
                  {formatarDataBr(contrato.dataFim)}
                  <span style={{ display: 'block', fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>
                    {labelValidade}
                  </span>
                </span>
              </div>

              <div className="info-card" style={{ gridColumn: 'span 2' }}>
                <span className="card-label">Fiscal Responsável</span>
                <span className="card-value">{contrato.fiscalContrato || 'Não informado'}</span>
              </div>
            </div>

            {contrato.observacao && contrato.observacao.trim() !== '' && (
              <div className="observacao-bloco">
                <span className="card-label">Observações</span>
                <span className="card-value small">{contrato.observacao}</span>
              </div>
            )}

          </div>

          <div className="card-financeiro">
            <div>
              <h3 style={{ color: '#10b981', marginTop: 0, textAlign: 'center' }}>Posição Financeira</h3>
              <div className="bloco-saldo">
                <div style={{ fontSize: '15px', color: '#475569', marginBottom: '5px' }}>
                  <strong>Global Autorizado:</strong> {contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div style={{ fontSize: '15px', color: '#ef4444', marginBottom: '10px' }}>
                  <strong>Valor Consumido:</strong> {totalConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '10px 0' }}></div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Saldo Atual Disponível</div>
                
                <div className={`valor-saldo ${contrato.saldoContrato >= 0 ? 'saldo-positivo' : 'saldo-negativo'}`} style={alertaSaldoCritico && !contrato.dataDistrato ? { color: '#ea580c', border: '2px solid #ea580c', padding: '10px', backgroundColor: '#fff7ed', borderRadius: '8px' } : { borderRadius: '8px' }}>
                  {alertaSaldoCritico && !contrato.dataDistrato && <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>⚠️ SALDO INFERIOR A 30%</div>}
                  {contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>Atualizado em: {contrato.dataUltimaAtualizacao || 'N/A'}</div>
              </div>
            </div>
            <div className="metricas-itens">
              <div><strong>{totalItens}</strong> Nº de Lançamentos</div>
              <div><strong>{totalUnidades.toLocaleString('pt-BR')}</strong> Unidades Consumidas</div>
            </div>
          </div>
        </div>

        {/* --- EXIBIÇÃO DE ADITIVOS NA TELA --- */}
        {contrato.aditivos && contrato.aditivos.length > 0 && (
          <div className="secao-itens">
            <h3 style={{ color: '#f59e0b' }}>📑 Histórico de Aditivos</h3>
            <table className="tabela-itens">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Nova Validade</th>
                  <th>Valor Aditivado/Suprimido</th>
                  <th>Itens Aditivados</th>
                  <th>Data Registro</th>
                </tr>
              </thead>
              <tbody>
                {contrato.aditivos.map(ad => (
                  <tr key={ad.id}>
                    <td style={{ fontWeight: '600' }}>{ad.descricao}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: '12px' }}>{ad.tipo}</td>
                    <td style={{ fontWeight: '600' }}>{ad.novaDataFim ? formatarDataBr(ad.novaDataFim) : '-'}</td>
                    <td style={{ color: ad.valorAditivado < 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                      {ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {ad.itensAditivados && ad.itensAditivados.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '15px' }}>
                          {ad.itensAditivados.map((item, idx) => (
                            <li key={idx}>{item.quantidade}x Item {item.numeroItem}</li>
                          ))}
                        </ul>
                      ) : 'Nenhum item alterado'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>{ad.dataRegistro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- EXIBIÇÃO DE PLANILHA ORIGINAL --- */}
        {itensCatalogo.length > 0 ? (
          <div className="secao-itens">
            <h3 style={{ color: '#004a99' }}>📋 Planilha Original do Contrato</h3>
            <table className="tabela-itens">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Item</th>
                  <th>Descrição</th>
                  <th>Unidade</th>
                  <th>Quantidade</th>
                  <th>Valor Unitário</th>
                  <th>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {itensCatalogo.map(item => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>{item.numeroLote === 'Único' || !item.numeroLote ? '-' : item.numeroLote}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.numeroItem}</td>
                    <td>{item.discriminacao}</td>
                    <td style={{ textAlign: 'center' }}>{item.unidade}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantidade}</td>
                    <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#555', fontWeight: 'bold' }}>{item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="secao-itens" style={{ textAlign: 'center', color: '#666' }}>
            <h3 style={{ color: '#004a99' }}>📋 Planilha Original do Contrato</h3>
            <p>Nenhum item original foi importado na criação deste contrato.</p>
          </div>
        )}

        {/* --- EXIBIÇÃO CONTROLE FÍSICO FINANCEIRO --- */}
        {tabelaDeSaldos.length > 0 && (
          <div className="secao-itens">
            <h3 style={{ color: '#2e7d32' }}>📊 Controle Físico-Financeiro (Saldos por Item Consolidados)</h3>
            <table className="tabela-saldos">
              <thead>
                <tr>
                  <th>Lote/Item</th>
                  <th>Descrição</th>
                  <th>Und</th>
                  <th>Vl. Unit.</th>
                  <th>Qtd Contratada</th>
                  <th>Vl. Contratado</th>
                  <th style={{ backgroundColor: '#fff3cd', color: '#856404' }}>Qtd Consumida</th>
                  <th style={{ backgroundColor: '#fff3cd', color: '#856404' }}>Vl Consumido</th>
                  <th className="th-saldo">Qtd Saldo</th>
                  <th className="th-saldo">Vl. Saldo</th>
                </tr>
              </thead>
              <tbody>
                {tabelaDeSaldos.map((linha, index) => {
                  const saldoQtd = linha.qtdContratada - linha.qtdConsumida;
                  const saldoValor = linha.vlContratado - linha.vlConsumido;
                  return (
                    <tr key={index}>
                      <td style={{ fontWeight: 'bold' }}>{linha.lote !== 'Único' && linha.lote ? `${linha.lote} / ` : ''}{linha.item}</td>
                      <td className="desc-esquerda">{linha.descricao}</td>
                      <td>{linha.unidade}</td>
                      <td>{linha.vlUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      
                      <td>{linha.qtdContratada}</td>
                      <td>{linha.vlContratado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      
                      <td style={{ backgroundColor: '#fffdf5', fontWeight: 'bold', color: '#856404' }}>{linha.qtdConsumida}</td>
                      <td style={{ backgroundColor: '#fffdf5', fontWeight: 'bold', color: '#856404' }}>{linha.vlConsumido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      
                      <td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold', color: saldoQtd < 0 ? 'red' : '#2e7d32' }}>{saldoQtd}</td>
                      <td style={{ backgroundColor: '#f3fbf3', fontWeight: 'bold', color: saldoValor < 0 ? 'red' : '#2e7d32' }}>{saldoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* --- EXIBIÇÃO HISTÓRICO DE CONSUMO --- */}
        <div className="secao-itens">
          <h3 style={{ color: '#dc3545' }}>📝 Histórico de Lançamentos (Auditoria de Empenhos)</h3>
          <table className="tabela-itens">
            <thead>
              <tr>
                <th>Lote/Item</th>
                <th>Descrição</th>
                <th>Qtd Consumida</th>
                <th>Vl. Unit.</th>
                <th>Valor Consumido</th>
                <th>Data do Log</th>
              </tr>
            </thead>
            <tbody>
              {itensConsumo.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center'}}>Nenhum empenho/consumo registrado ainda.</td></tr>
              ) : (
                itensConsumo.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold' }}>{item.numeroLote !== 'Único' && item.numeroLote ? `${item.numeroLote} / ` : ''}{item.numeroItem}</td>
                    <td>{item.discriminacao}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantidade} {item.unidade}</td>
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

      {/* --- MODAL DE ADITIVO --- */}
      {isModalAditivoOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="btn-fechar" onClick={() => setIsModalAditivoOpen(false)}>×</button>
            <h2 style={{ color: '#f59e0b', marginTop: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Registrar Aditivo</h2>
            
            <form onSubmit={salvarAditivo} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div className="form-group full-width">
                <label>Descrição do Aditivo:</label>
                <input type="text" required placeholder="Ex: 1º Termo Aditivo de Prazo e Valor" value={aditivoDescricao} onChange={e => setAditivoDescricao(e.target.value)} />
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>Tipo de Aditivo:</label>
                  <select value={aditivoTipo} onChange={e => setAditivoTipo(e.target.value as any)}>
                    <option value="prazo">Apenas Prazo</option>
                    <option value="valor">Apenas Valor</option>
                    <option value="ambos">Prazo e Valor</option>
                  </select>
                </div>

                {(aditivoTipo === 'prazo' || aditivoTipo === 'ambos') && (
                  <div className="form-group">
                    <label>Nova Data de Validade:</label>
                    <input type="date" required value={aditivoNovaData} onChange={e => setAditivoNovaData(e.target.value)} />
                  </div>
                )}
              </div>

              {(aditivoTipo === 'valor' || aditivoTipo === 'ambos') && (
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#3b82f6' }}>📄 Importação de Itens (Opcional via IA)</h4>
                  
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Anexar Termo (PDF/DOCX em formato texto suportado):</label>
                      <input type="file" accept=".txt,.pdf,.docx" onChange={e => setArquivoPdfAditivo(e.target.files?.[0] || null)} />
                    </div>
                    <button type="button" onClick={lidarProcessamentoIA} disabled={processandoPdfIA} style={{ backgroundColor: '#8b5cf6', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                      {processandoPdfIA ? '🤖 Lendo...' : '🤖 Extrair com IA'}
                    </button>
                  </div>

                  <div className="form-grid" style={{ marginBottom: '0' }}>
                    <div className="form-group">
                      <label>Operação:</label>
                      <select value={aditivoOperacao} onChange={e => setAditivoOperacao(e.target.value as any)}>
                        <option value="acrescimo">Acréscimo (+)</option>
                        <option value="supressao">Supressão (-)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Valor Global Alterado (R$):</label>
                      <input type="number" required min="0.01" step="0.01" value={aditivoValor} onChange={e => setAditivoValor(Number(e.target.value))} placeholder="Ex: 5000.00" />
                    </div>
                  </div>

                  {itensDoAditivo.length > 0 && (
                    <div style={{ marginTop: '16px', backgroundColor: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#10b981' }}>✓ {itensDoAditivo.length} Itens extraídos</p>
                      <ul style={{ fontSize: '11px', margin: 0, paddingLeft: '16px', color: '#475569' }}>
                        {itensDoAditivo.map((item, idx) => (
                          <li key={idx}>{item.quantidade}x Item {item.numeroItem}: {item.discriminacao} (R$ {item.valorTotalItem})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-acoes">
                <button type="button" className="btn-cancelar" onClick={() => setIsModalAditivoOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-salvar" disabled={loading}>
                  {loading ? 'Salvando...' : 'Confirmar Aditivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE DISTRATO --- */}
      {isModalDistratoOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <button className="btn-fechar" onClick={() => setIsModalDistratoOpen(false)}>×</button>
            <h2 style={{ color: '#ef4444', marginTop: 0, borderBottom: '1px solid #fecaca', paddingBottom: '12px' }}>Registrar Distrato</h2>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Atenção: Ao registrar o distrato, o contrato será considerado encerrado e não aceitará novos aditivos ou lançamentos.</p>
            
            <form onSubmit={salvarDistrato} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div className="form-group">
                <label>Data do Distrato:</label>
                <input type="date" required value={distratoData} onChange={e => setDistratoData(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Motivo do Distrato (Opcional):</label>
                <textarea rows={3} value={distratoMotivo} onChange={e => setDistratoMotivo(e.target.value)} placeholder="Informe a justificativa ou embasamento legal..."></textarea>
              </div>
              
              <div className="modal-acoes">
                <button type="button" className="btn-cancelar" onClick={() => setIsModalDistratoOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-salvar" style={{ backgroundColor: '#ef4444' }} disabled={loading}>
                  {loading ? 'Registrando...' : 'Confirmar Distrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalLancarConsumo isOpen={isModalLancamentoOpen} onClose={() => setIsModalLancamentoOpen(false)} contratoId={id!} saldoContrato={contrato.saldoContrato} />
      <ModalEditarContrato isOpen={isModalEditOpen} onClose={() => setIsModalEditOpen(false)} contratoOriginal={contrato} />
    </div>
  );
}