// src/hooks/useDetalhesContrato.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import * as mammoth from 'mammoth'; 
import * as pdfjsLib from 'pdfjs-dist'; 
import toast from 'react-hot-toast';
import { db } from '../firebase';
import type { Contrato, Aditivo, ItemAditivo, Item } from '../types/types';
import { extrairDadosAditivoComIA } from '../services/geminiService';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export const useDetalhesContrato = (id: string | undefined) => {
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itensCatalogo, setItensCatalogo] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados Aditivo
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

  // Estados Inserção Manual
  const [itemManualSel, setItemManualSel] = useState<string>('');
  const [itemManualQtd, setItemManualQtd] = useState<number | ''>('');
  const [itemManualVlUnit, setItemManualVlUnit] = useState<number | ''>('');

  // Estados Distrato
  const [distratoData, setDistratoData] = useState('');
  const [distratoMotivo, setDistratoMotivo] = useState('');

  useEffect(() => {
    if (!id) return;
    
    // CORREÇÃO: "id as string" garante ao TypeScript que não passaremos undefined
    const unsubContrato = onSnapshot(doc(db, 'contratos', id as string), (docSnap) => {
      if (docSnap.exists()) {
        setContrato({ id: docSnap.id, ...docSnap.data() } as Contrato);
      }
    });

    const qItens = query(
      collection(db, 'itens'), 
      where('contratoId', '==', id as string), 
      where('tipoRegistro', '==', 'catalogo')
    );

    const unsubItens = onSnapshot(qItens, (querySnapshot) => {
      const lista: Item[] = [];
      querySnapshot.forEach((d) => lista.push({ id: d.id, ...d.data() } as Item));
      
      lista.sort((a, b) => {
        const loteA = a.numeroLote || '';
        const loteB = b.numeroLote || '';
        const cmpLote = loteA.localeCompare(loteB, undefined, { numeric: true });
        
        if (cmpLote !== 0) return cmpLote;
        
        return (a.numeroItem || '').localeCompare(b.numeroItem || '', undefined, { numeric: true });
      });
      
      setItensCatalogo(lista);
    });

    return () => { 
      unsubContrato(); 
      unsubItens(); 
    };
  }, [id]);

  const valorGlobalAtualizado = contrato ? (Number(contrato.valorTotal) || 0) : 0;
  
  const totalAditivosAplicados = contrato?.aditivos 
    ? contrato.aditivos.reduce((acc, ad) => acc + (ad.valorAditivado || 0), 0) 
    : 0;
    
  const valorOriginal = valorGlobalAtualizado - totalAditivosAplicados;

  const excluirContrato = async (onSuccess: () => void) => {
    if (!id) return;
    
    if (window.confirm("Excluir contrato e histórico? Ação irreversível.")) {
      const toastId = toast.loading('A excluir contrato...');
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', id as string));
        
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', id as string));
        const querySnapshot = await getDocs(qItens);
        
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((itemDoc) => batch.delete(itemDoc.ref));
          await batch.commit();
        }
        
        toast.success("Contrato excluído com sucesso!", { id: toastId });
        onSuccess();
      } catch (error) { 
        toast.error("Erro ao excluir o contrato.", { id: toastId }); 
      } finally { 
        setLoading(false); 
      }
    }
  };

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
      toast.error("Selecione o arquivo do aditivo primeiro."); 
      return; 
    }
    
    setProcessandoPdfIA(true);
    const toastId = toast.loading('A processar IA...');
    
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
      } else if (arquivoPdfAditivo.name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        textoCompleto = result.value;
      } else {
         textoCompleto = await arquivoPdfAditivo.text();
      }

      const textoLimpo = textoCompleto.replace(/\s+/g, ' ');
      if (textoLimpo.trim().length < 50) throw new Error("Texto extraído é ilegível ou muito curto.");

      const dados = await extrairDadosAditivoComIA(textoLimpo);
      
      if (dados) {
        if (dados.descricao) setAditivoDescricao(dados.descricao);
        if (dados.tipo) setAditivoTipo(dados.tipo);
        if (dados.novaDataFim) setAditivoNovaData(dados.novaDataFim);
        if (dados.valorAditivado) setAditivoValor(Number(dados.valorAditivado));
        
        if (dados.itens && dados.itens.length > 0) {
          setItensDoAditivo(dados.itens);
          const soma = dados.itens.reduce((acc: number, item: any) => acc + (Number(item.valorTotalItem) || 0), 0);
          if (!dados.valorAditivado && soma > 0) setAditivoValor(soma);
          
          toast.success("A IA extraiu os dados com sucesso!", { id: toastId });
        } else {
          toast.success("Dados gerais lidos, mas a tabela de itens estava vazia.", { id: toastId, duration: 5000 });
        }
      } else { 
        toast.error("A IA falhou na estruturação dos dados.", { id: toastId }); 
      }
    } catch (error: any) { 
      toast.error(error.message, { id: toastId }); 
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
    
    const novaLista = [...itensDoAditivo, novoItem];
    setItensDoAditivo(novaLista);
    setAditivoValor(novaLista.reduce((acc, i) => acc + i.valorTotalItem, 0));
    
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
    
    if (ad.valorAditivado && ad.valorAditivado !== 0) {
       setAditivoOperacao(ad.valorAditivado > 0 ? 'acrescimo' : 'supressao');
       setAditivoValor(Math.abs(ad.valorAditivado));
    } else { 
       setAditivoValor(''); 
    }
    
    setItensDoAditivo(ad.itensAditivados || []);
  };

  const excluirAditivo = async (aditivo: Aditivo) => {
    if (!id || !contrato) return;
    
    if (!window.confirm("Tem certeza que deseja excluir este aditivo? O valor global será recalculado.")) return;
    
    const toastId = toast.loading('A excluir aditivo...');
    setLoading(true);
    
    try {
      const valorAjuste = aditivo.valorAditivado || 0;
      const novoValorTotal = Number(contrato.valorTotal) - valorAjuste;
      const novaLista = contrato.aditivos ? contrato.aditivos.filter(a => a.id !== aditivo.id) : [];
      
      await updateDoc(doc(db, 'contratos', id as string), {
        valorTotal: novoValorTotal, 
        aditivos: novaLista,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      
      toast.success('Aditivo excluído com sucesso!', { id: toastId });
    } catch (error) { 
      toast.error("Erro ao excluir o aditivo.", { id: toastId }); 
    } finally { 
      setLoading(false); 
    }
  };

  const salvarAditivo = async (e: React.FormEvent, onSuccess: () => void) => {
    e.preventDefault();
    if (!id || !contrato) return;
    
    if (!aditivoDataAditivo) { 
      toast.error("Por favor, preencha a Data de Assinatura do aditivo."); 
      return; 
    }
    
    try {
      let novoValorTotal = Number(contrato.valorTotal) || 0;
      let novaDataFimStr = contrato.dataFim;
      let valorAlteracao = 0;

      if (aditivoEmEdicao) {
        novoValorTotal -= (aditivoEmEdicao.valorAditivado || 0);
      }

      if (aditivoTipo === 'valor' || aditivoTipo === 'ambos') {
        const v = Number(aditivoValor);
        valorAlteracao = aditivoOperacao === 'acrescimo' ? v : -v;
        const limite25 = novoValorTotal * 0.25;
        
        if (v > limite25 && aditivoOperacao === 'acrescimo') {
           if(!window.confirm(`Atenção: O acréscimo supera o limite legal de 25%. Deseja prosseguir sob amparo legal específico?`)) return; 
        }
        
        novoValorTotal += valorAlteracao;
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

      let novaLista = contrato.aditivos ? [...contrato.aditivos] : [];
      
      if (aditivoEmEdicao) {
         const index = novaLista.findIndex(a => a.id === aditivoEmEdicao.id);
         if (index !== -1) novaLista[index] = novoAditivo;
      } else { 
         novaLista.push(novoAditivo); 
      }

      await updateDoc(doc(db, 'contratos', id as string), {
        valorTotal: novoValorTotal, 
        dataFim: novaDataFimStr, 
        aditivos: novaLista,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      
      toast.success(aditivoEmEdicao ? 'Aditivo atualizado!' : 'Aditivo registado!', { id: toastId });
      fecharModalAditivoState(); 
      onSuccess();
    } catch (error) { 
      toast.error("Erro ao guardar o aditivo."); 
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
      
      await updateDoc(doc(db, 'contratos', id as string), {
        dataDistrato: distratoData, 
        motivoDistrato: distratoMotivo,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      
      toast.success('Distrato registado com sucesso!', { id: toastId });
      onSuccess();
    } catch (error) { 
      toast.error("Erro ao registar o distrato.", { id: toastId }); 
    } finally { 
      setLoading(false); 
    }
  };

  return {
    contrato, 
    itensCatalogo, 
    loading,
    valorGlobalAtualizado, 
    totalAditivosAplicados, 
    valorOriginal,
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
    distratoData, setDistratoData, 
    distratoMotivo, setDistratoMotivo,
    salvarDistrato, 
    excluirContrato
  };
};