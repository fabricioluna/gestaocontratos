// src/hooks/useDetalhesContrato.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import * as mammoth from 'mammoth'; 
import * as pdfjsLib from 'pdfjs-dist'; 
import toast from 'react-hot-toast'; // IMPORTAÇÃO DO TOAST
import { db } from '../firebase';
import type { Contrato, Aditivo, ItemAditivo } from '../types/types';
import { extrairDadosAditivoComIA } from '../services/geminiService';

// CONFIGURAÇÃO DO WORKER DO PDFJS
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export interface ItemExtendido {
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

export const useDetalhesContrato = (id: string | undefined) => {
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itens, setItens] = useState<ItemExtendido[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados para Aditivo
  const [aditivoEmEdicao, setAditivoEmEdicao] = useState<Aditivo | null>(null);
  const [aditivoDataAditivo, setAditivoDataAditivo] = useState('');
  const [aditivoDescricao, setAditivoDescricao] = useState('');
  const [aditivoTipo, setAditivoTipo] = useState<'prazo' | 'valor' | 'ambos'>('prazo');
  const [aditivoOperacao, setAditivoOperacao] = useState<'acrescimo' | 'supressao'>('acrescimo');
  const [aditivoValor, setAditivoValor] = useState<number | ''>('');
  const [aditivoNovaData, setAditivoNovaData] = useState('');
  
  const [itensDoAditivo, setItensDoAditivo] = useState<ItemAditivo[]>([]);
  const [arquivoPdfAditivo, setArquivoPdfAditivo] = useState<File | null>(null);
  const [processandoPdfIA, setProcessandoPdfIA] = useState(false);

  // Estados para Inserção Manual de Itens
  const [itemManualSel, setItemManualSel] = useState<string>('');
  const [itemManualQtd, setItemManualQtd] = useState<number | ''>('');
  const [itemManualVlUnit, setItemManualVlUnit] = useState<number | ''>('');

  // Estados para Distrato
  const [distratoData, setDistratoData] = useState('');
  const [distratoMotivo, setDistratoMotivo] = useState('');

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

  // DERIVAÇÕES DE DADOS (CÁLCULOS)
  const itensCatalogo = itens.filter(i => i.tipoRegistro === 'catalogo' || !i.tipoRegistro);
  const itensConsumo = itens.filter(i => i.tipoRegistro === 'consumo');
  
  const valorGlobalAtualizado = contrato ? (Number(contrato.valorTotal) || 0) : 0;
  const totalAditivosAplicados = contrato?.aditivos ? contrato.aditivos.reduce((acc, ad) => acc + (ad.valorAditivado || 0), 0) : 0;
  const valorOriginal = valorGlobalAtualizado - totalAditivosAplicados;
  const totalConsumido = itensConsumo.reduce((acc, curr) => acc + curr.valorTotalItem, 0);

  const gerarTabelaSaldos = (incluirAditivos: boolean = true) => {
    if (!contrato) return [];
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

    if (incluirAditivos && contrato.aditivos) {
      contrato.aditivos.forEach(aditivo => {
        if (aditivo.itensAditivados) {
          aditivo.itensAditivados.forEach(itemAditivo => {
            const chave = `${itemAditivo.numeroLote}|${itemAditivo.numeroItem}`;
            if (mapaSaldos.has(chave)) {
              const existente = mapaSaldos.get(chave);
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

  const tabelaDeSaldosTela = gerarTabelaSaldos(true);

  // AÇÕES DO CONTRATO
  const excluirContrato = async (onSuccess: () => void) => {
    if (!id) return;
    if (window.confirm("Tem certeza que deseja excluir este contrato e TODO o seu histórico? Esta ação não pode ser desfeita.")) {
      const toastId = toast.loading('A excluir contrato...');
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
        
        toast.success("Contrato excluído com sucesso!", { id: toastId });
        onSuccess();
      } catch (error) {
        toast.error("Erro ao excluir contrato.", { id: toastId });
      } finally {
        setLoading(false);
      }
    }
  };

  // AÇÕES DE ADITIVOS E IA
  const fecharModalAditivoState = () => {
    setAditivoEmEdicao(null);
    setAditivoDescricao('');
    setAditivoDataAditivo('');
    setAditivoTipo('prazo');
    setAditivoOperacao('acrescimo');
    setAditivoValor('');
    setAditivoNovaData('');
    setItensDoAditivo([]);
    setArquivoPdfAditivo(null);
  };

  const lidarProcessamentoIA = async () => {
    if (!arquivoPdfAditivo) {
      toast.error("Por favor, selecione o arquivo do Termo Aditivo primeiro.");
      return;
    }
    
    setProcessandoPdfIA(true);
    const toastId = toast.loading('A processar documento com Inteligência Artificial...');
    
    try {
      const arrayBuffer = await arquivoPdfAditivo.arrayBuffer();
      let textoCompleto = '';
      
      if (arquivoPdfAditivo.name.toLowerCase().endsWith('.pdf')) {
        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          textoCompleto += strings.join(" ") + "\n";
        }
      } 
      else if (arquivoPdfAditivo.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        textoCompleto = result.value;
      } else {
         textoCompleto = await arquivoPdfAditivo.text();
      }

      const textoLimpo = textoCompleto.replace(/\s+/g, ' ');
      if (textoLimpo.trim().length < 50) throw new Error("Não foi possível extrair texto legível deste documento.");

      const dadosExtraidos = await extrairDadosAditivoComIA(textoLimpo);

      if (dadosExtraidos) {
        if (dadosExtraidos.descricao) setAditivoDescricao(dadosExtraidos.descricao);
        if (dadosExtraidos.tipo) setAditivoTipo(dadosExtraidos.tipo);
        if (dadosExtraidos.novaDataFim) setAditivoNovaData(dadosExtraidos.novaDataFim);
        if (dadosExtraidos.valorAditivado) setAditivoValor(Number(dadosExtraidos.valorAditivado));

        if (dadosExtraidos.itens && dadosExtraidos.itens.length > 0) {
          setItensDoAditivo(dadosExtraidos.itens);
          const soma = dadosExtraidos.itens.reduce((acc: number, item: any) => acc + (Number(item.valorTotalItem) || 0), 0);
          if (!dadosExtraidos.valorAditivado && soma > 0) setAditivoValor(soma);
          
          toast.success("IA extraiu os DADOS e ITENS com sucesso!", { id: toastId });
        } else {
          toast.success("Dados gerais lidos, mas não foram encontrados itens na tabela. Pode adicionar manualmente.", { id: toastId, duration: 5000 });
        }
      } else {
        toast.error("A IA analisou o ficheiro, mas não conseguiu estruturar os dados.", { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro inesperado ao processar o documento via IA.", { id: toastId });
    } finally {
      setProcessandoPdfIA(false);
    }
  };

  const lidarAdicionarItemManual = () => {
    if (!itemManualSel) return;
    const original = itensCatalogo.find(i => i.id === itemManualSel);
    if (!original) return;

    const qtd = Number(itemManualQtd) || 0;
    const vlUnit = Number(itemManualVlUnit) || original.valorUnitario;
    const vlTotal = qtd * vlUnit;

    const novoItem: ItemAditivo = {
      numeroLote: original.numeroLote,
      numeroItem: original.numeroItem,
      discriminacao: original.discriminacao,
      unidade: original.unidade,
      quantidade: qtd,
      valorUnitario: vlUnit,
      valorTotalItem: vlTotal
    };

    const novaListaItens = [...itensDoAditivo, novoItem];
    setItensDoAditivo(novaListaItens);
    const novaSoma = novaListaItens.reduce((acc, i) => acc + i.valorTotalItem, 0);
    setAditivoValor(novaSoma);

    setItemManualSel('');
    setItemManualQtd('');
    setItemManualVlUnit('');
  };

  const removerItemAditivo = (index: number) => {
    const novaLista = [...itensDoAditivo];
    novaLista.splice(index, 1);
    setItensDoAditivo(novaLista);
    const novaSoma = novaLista.reduce((acc, i) => acc + i.valorTotalItem, 0);
    setAditivoValor(novaSoma > 0 ? novaSoma : '');
  };

  const abrirEdicaoAditivo = (ad: Aditivo) => {
    setAditivoEmEdicao(ad);
    setAditivoDescricao(ad.descricao);
    setAditivoTipo(ad.tipo);
    setAditivoDataAditivo(ad.dataAditivo || '');
    setAditivoNovaData(ad.novaDataFim || '');
    if (ad.valorAditivado !== undefined && ad.valorAditivado !== 0) {
       setAditivoOperacao(ad.valorAditivado > 0 ? 'acrescimo' : 'supressao');
       setAditivoValor(Math.abs(ad.valorAditivado));
    } else {
       setAditivoValor('');
    }
    setItensDoAditivo(ad.itensAditivados || []);
  };

  const excluirAditivo = async (aditivoParaExcluir: Aditivo) => {
    if (!id || !contrato) return;
    if (!window.confirm("Tem certeza que deseja excluir este aditivo? O valor global e o saldo do contrato serão recalculados automaticamente.")) return;
    
    const toastId = toast.loading('A excluir aditivo...');
    setLoading(true);
    try {
      const valorAjuste = aditivoParaExcluir.valorAditivado || 0;
      const novoValorTotal = Number(contrato.valorTotal) - valorAjuste;
      const novoSaldo = Number(contrato.saldoContrato) - valorAjuste;
      const novaListaAditivos = contrato.aditivos ? contrato.aditivos.filter(a => a.id !== aditivoParaExcluir.id) : [];

      await updateDoc(doc(db, 'contratos', id), {
        valorTotal: novoValorTotal,
        saldoContrato: novoSaldo,
        aditivos: novaListaAditivos,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      toast.success('Aditivo excluído com sucesso!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir o aditivo.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const salvarAditivo = async (e: React.FormEvent, onSuccess: () => void) => {
    e.preventDefault();
    if (!id || !contrato) return;
    if (!aditivoDataAditivo) { 
      toast.error("Por favor, preencha a Data de Assinatura do Aditivo."); 
      return; 
    }

    try {
      let novoValorTotal = Number(contrato.valorTotal) || 0;
      let novoSaldo = Number(contrato.saldoContrato) || 0;
      let novaDataFimStr = contrato.dataFim;
      let valorAlteracao = 0;

      if (aditivoEmEdicao) {
        const valorAntigo = aditivoEmEdicao.valorAditivado || 0;
        novoValorTotal -= valorAntigo;
        novoSaldo -= valorAntigo;
      }

      if (aditivoTipo === 'valor' || aditivoTipo === 'ambos') {
        const v = Number(aditivoValor);
        valorAlteracao = aditivoOperacao === 'acrescimo' ? v : -v;
        const limite25 = novoValorTotal * 0.25;
        
        // Mantemos o confirm aqui porque é um alerta legal exigido e exige decisão humana, não um mero aviso.
        if (v > limite25 && aditivoOperacao === 'acrescimo') {
           if(!window.confirm(`Atenção: O acréscimo de ${v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} supera 25% do valor atual. Deseja prosseguir sob amparo legal específico?`)) {
               return; 
           }
        }
        novoValorTotal += valorAlteracao;
        novoSaldo += valorAlteracao;
      }

      if (aditivoTipo === 'prazo' || aditivoTipo === 'ambos') {
        if (!aditivoNovaData) { 
          toast.error('Informe a nova data de validade.'); 
          return; 
        }
        novaDataFimStr = aditivoNovaData;
      }

      const toastId = toast.loading('A guardar aditivo...');
      setLoading(true);

      const novoAditivo: Aditivo = {
        id: aditivoEmEdicao ? aditivoEmEdicao.id : Date.now().toString(),
        descricao: aditivoDescricao || 'Termo Aditivo',
        dataAditivo: aditivoDataAditivo, 
        tipo: aditivoTipo,
        valorAditivado: valorAlteracao,
        novaDataFim: (aditivoTipo === 'prazo' || aditivoTipo === 'ambos') && aditivoNovaData ? aditivoNovaData : "",
        dataRegistro: aditivoEmEdicao ? aditivoEmEdicao.dataRegistro : new Date().toLocaleString('pt-BR'),
        itensAditivados: itensDoAditivo.length > 0 ? itensDoAditivo : [],
      };

      let novaListaAditivos = contrato.aditivos ? [...contrato.aditivos] : [];
      if (aditivoEmEdicao) {
         const index = novaListaAditivos.findIndex(a => a.id === aditivoEmEdicao.id);
         if (index !== -1) novaListaAditivos[index] = novoAditivo;
      } else {
         novaListaAditivos.push(novoAditivo);
      }

      await updateDoc(doc(db, 'contratos', id), {
        valorTotal: novoValorTotal,
        saldoContrato: novoSaldo,
        dataFim: novaDataFimStr,
        aditivos: novaListaAditivos,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });

      toast.success(aditivoEmEdicao ? 'Aditivo atualizado com sucesso!' : 'Aditivo registado com sucesso!', { id: toastId });
      fecharModalAditivoState();
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao guardar aditivo. Verifique o log.");
    } finally {
      setLoading(false);
    }
  };

  const salvarDistrato = async (e: React.FormEvent, onSuccess: () => void) => {
    e.preventDefault();
    if (!id || !contrato) return;

    const toastId = toast.loading('A registar distrato...');
    try {
      setLoading(true);
      await updateDoc(doc(db, 'contratos', id), {
        dataDistrato: distratoData,
        motivoDistrato: distratoMotivo,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      toast.success('Distrato registado com sucesso!', { id: toastId });
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao registar distrato.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return {
    contrato,
    itensCatalogo,
    itensConsumo,
    loading,
    gerarTabelaSaldos,
    tabelaDeSaldosTela,
    valorGlobalAtualizado,
    totalAditivosAplicados,
    valorOriginal,
    totalConsumido,
    
    // Aditivo Form State & Handlers
    aditivoEmEdicao,
    aditivoDataAditivo, setAditivoDataAditivo,
    aditivoDescricao, setAditivoDescricao,
    aditivoTipo, setAditivoTipo,
    aditivoOperacao, setAditivoOperacao,
    aditivoValor, setAditivoValor,
    aditivoNovaData, setAditivoNovaData,
    itensDoAditivo,
    arquivoPdfAditivo, setArquivoPdfAditivo,
    processandoPdfIA,
    itemManualSel, setItemManualSel,
    itemManualQtd, setItemManualQtd,
    itemManualVlUnit, setItemManualVlUnit,
    
    fecharModalAditivoState,
    lidarProcessamentoIA,
    lidarAdicionarItemManual,
    removerItemAditivo,
    abrirEdicaoAditivo,
    excluirAditivo,
    salvarAditivo,

    // Distrato Form State & Handlers
    distratoData, setDistratoData,
    distratoMotivo, setDistratoMotivo,
    salvarDistrato,

    excluirContrato
  };
};