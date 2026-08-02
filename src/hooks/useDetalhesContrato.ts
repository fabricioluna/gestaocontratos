// src/hooks/useDetalhesContrato.ts
import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs, writeBatch, updateDoc, runTransaction } from 'firebase/firestore';
import * as mammoth from 'mammoth'; 
import * as pdfjsLib from 'pdfjs-dist'; 
import toast from 'react-hot-toast';
import { db } from '../firebase';
import type { Contrato, Aditivo, ItemAditivado, Item } from '../types/types';
import { extrairDadosAditivoComIA } from '../services/geminiService';
import { registrarLog } from '../services/auditService'; // NOVO: Motor de Auditoria
import {
  calcularResumoValorGlobal,
  calcularValorAlteracaoAditivo,
  excedeLimite25,
  recalcularValorTotalComAditivo,
  substituirAditivo,
} from '../domain/aditivos';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export const useDetalhesContrato = (id: string | undefined) => {
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itensCatalogo, setItensCatalogo] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [aditivoEmEdicao, setAditivoEmEdicao] = useState<Aditivo | null>(null);
  const [aditivoDataAditivo, setAditivoDataAditivo] = useState('');
  const [aditivoDescricao, setAditivoDescricao] = useState('');
  const [aditivoTipo, setAditivoTipo] = useState<'prazo' | 'valor' | 'ambos'>('prazo');
  const [aditivoOperacao, setAditivoOperacao] = useState<'acrescimo' | 'supressao'>('acrescimo');
  const [aditivoValor, setAditivoValor] = useState<number | ''>('');
  const [aditivoNovaData, setAditivoNovaData] = useState('');
  const [itensDoAditivo, setItensDoAditivo] = useState<ItemAditivado[]>([]);
  const [arquivoPdfAditivo, setArquivoPdfAditivo] = useState<File | null>(null);
  const [processandoPdfIA, setProcessandoPdfIA] = useState(false);

  const [itemManualSel, setItemManualSel] = useState<string>('');
  const [itemManualQtd, setItemManualQtd] = useState<number | ''>('');
  const [itemManualVlUnit, setItemManualVlUnit] = useState<number | ''>('');

  const [distratoData, setDistratoData] = useState('');
  const [distratoMotivo, setDistratoMotivo] = useState('');

  useEffect(() => {
    if (!id) return;
    const unsubContrato = onSnapshot(doc(db, 'contratos', id as string), (docSnap) => {
      if (docSnap.exists()) {
        setContrato({ id: docSnap.id, ...docSnap.data() } as Contrato);
        setErro(null);
      } else {
        setErro('Contrato não encontrado.');
      }
    }, (error) => {
      console.error('[Firebase Debug] Erro ao ler contrato:', error);
      setErro('Erro ao carregar o contrato. Verifique a sua conexão ou permissão de acesso.');
    });

    const qItens = query(collection(db, 'itens'), where('contratoId', '==', id as string), where('tipoRegistro', '==', 'catalogo'));
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
    }, (error) => {
      console.error('[Firebase Debug] Erro ao ler itens do catálogo:', error);
      toast.error('Erro ao carregar o catálogo de itens.');
    });

    return () => { unsubContrato(); unsubItens(); };
  }, [id]);

  const { valorGlobalAtualizado, totalAditivosAplicados, valorOriginal } = calcularResumoValorGlobal(contrato);

  const excluirContrato = async (onSuccess: () => void) => {
    if (!id || !contrato) return;
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
        
        await registrarLog('EXCLUSÃO CONTRATO', `Contrato ${contrato.numeroContrato} do fornecedor ${contrato.fornecedor} foi totalmente excluído.`);
        toast.success("Contrato excluído com sucesso!", { id: toastId });
        onSuccess();
      } catch (error) { toast.error("Erro ao excluir o contrato.", { id: toastId }); 
      } finally { setLoading(false); }
    }
  };

  const fecharModalAditivoState = () => {
    setAditivoEmEdicao(null); setAditivoDescricao(''); setAditivoDataAditivo(''); setAditivoTipo('prazo'); 
    setAditivoOperacao('acrescimo'); setAditivoValor(''); setAditivoNovaData(''); setItensDoAditivo([]); setArquivoPdfAditivo(null);
  };

  const lidarProcessamentoIA = async () => {
    if (!arquivoPdfAditivo) return toast.error("Selecione o arquivo do aditivo primeiro.");
    setProcessandoPdfIA(true); const toastId = toast.loading('A processar IA...');
    try {
      const arrayBuffer = await arquivoPdfAditivo.arrayBuffer();
      let textoCompleto = '';
      if (arquivoPdfAditivo.name.toLowerCase().endsWith('.pdf')) {
        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i); const content = await page.getTextContent();
          textoCompleto += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
      } else if (arquivoPdfAditivo.name.toLowerCase().endsWith('.docx')) {
        textoCompleto = (await mammoth.extractRawText({ arrayBuffer })).value;
      } else textoCompleto = await arquivoPdfAditivo.text();

      const textoLimpo = textoCompleto.replace(/\s+/g, ' ');
      if (textoLimpo.trim().length < 50) throw new Error("Texto extraído é ilegível.");

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
          toast.success("A IA extraiu os dados!", { id: toastId });
        } else { toast.success("Dados lidos, sem itens.", { id: toastId }); }
      } else { toast.error("A IA falhou na estruturação.", { id: toastId }); }
    } catch (error: any) { toast.error(error.message, { id: toastId }); 
    } finally { setProcessandoPdfIA(false); }
  };

  const lidarAdicionarItemManual = () => {
    if (!itemManualSel) return;
    const original = itensCatalogo.find(i => i.id === itemManualSel); if (!original) return;
    const qtd = Number(itemManualQtd) || 0; const vlUnit = Number(itemManualVlUnit) || original.valorUnitario;
    const novoItem: ItemAditivado = { numeroLote: original.numeroLote, numeroItem: original.numeroItem, discriminacao: original.discriminacao, unidade: original.unidade, quantidade: qtd, valorUnitario: vlUnit, valorTotalItem: qtd * vlUnit };
    const novaLista = [...itensDoAditivo, novoItem];
    setItensDoAditivo(novaLista); setAditivoValor(novaLista.reduce((acc, i) => acc + i.valorTotalItem, 0));
    setItemManualSel(''); setItemManualQtd(''); setItemManualVlUnit('');
  };

  const removerItemAditivo = (index: number) => {
    const novaLista = [...itensDoAditivo]; novaLista.splice(index, 1); setItensDoAditivo(novaLista);
    const novaSoma = novaLista.reduce((acc, i) => acc + i.valorTotalItem, 0); setAditivoValor(novaSoma > 0 ? novaSoma : '');
  };

  const abrirEdicaoAditivo = (ad: Aditivo) => {
    setAditivoEmEdicao(ad); setAditivoDescricao(ad.descricao); setAditivoTipo(ad.tipo); setAditivoDataAditivo(ad.dataAditivo || ''); setAditivoNovaData(ad.novaDataFim || '');
    if (ad.valorAditivado && ad.valorAditivado !== 0) { setAditivoOperacao(ad.valorAditivado > 0 ? 'acrescimo' : 'supressao'); setAditivoValor(Math.abs(ad.valorAditivado));
    } else { setAditivoValor(''); } setItensDoAditivo(ad.itensAditivados || []);
  };

  const excluirAditivo = async (aditivo: Aditivo) => {
    if (!id || !contrato) return;
    if (!window.confirm("Excluir este aditivo e recalcular valor global?")) return;
    const toastId = toast.loading('A excluir aditivo...'); setLoading(true);
    try {
      const contratoRef = doc(db, 'contratos', id as string);
      // Transação: lê o contrato mais recente do servidor em vez do estado
      // local (que pode estar desatualizado se outro fiscal alterou os
      // aditivos entretanto) antes de recalcular e regravar valorTotal +
      // aditivos — evita a condição de corrida do read-modify-write direto
      // (CLAUDE.md, problema conhecido nº 1).
      await runTransaction(db, async (transaction) => {
        const contratoSnap = await transaction.get(contratoRef);
        if (!contratoSnap.exists()) throw new Error('Contrato não encontrado.');
        const contratoAtual = contratoSnap.data() as Contrato;
        const valorAjuste = aditivo.valorAditivado || 0;
        const novoValorTotal = recalcularValorTotalComAditivo(Number(contratoAtual.valorTotal) || 0, valorAjuste, 0);
        const novaLista = contratoAtual.aditivos ? contratoAtual.aditivos.filter(a => a.id !== aditivo.id) : [];
        transaction.update(contratoRef, { valorTotal: novoValorTotal, aditivos: novaLista, dataUltimaAtualizacao: new Date().toLocaleString('pt-BR') });
      });

      await registrarLog('EXCLUSÃO ADITIVO', `Aditivo "${aditivo.descricao}" excluído do Contrato ${contrato.numeroContrato}.`);
      toast.success('Aditivo excluído com sucesso!', { id: toastId });
    } catch (error) { toast.error("Erro ao excluir o aditivo.", { id: toastId });
    } finally { setLoading(false); }
  };

  const salvarAditivo = async (e: React.FormEvent, onSuccess: () => void) => {
    e.preventDefault(); if (!id || !contrato) return;
    if (!aditivoDataAditivo) return toast.error("Preencha a Data de Assinatura.");
    let toastId: string | undefined;
    try {
      // Pré-checagem com o estado local só para decidir se mostra o aviso
      // de "acréscimo supera 25%" — window.confirm não pode rodar dentro da
      // transação abaixo (Firestore pode reexecutar o corpo da transação em
      // caso de conflito, e um confirm() duplicado seria péssima UX). O
      // valor e a lista realmente gravados vêm de dentro da transação,
      // lidos do servidor no momento do commit — se o usuário já confirmou
      // aqui, aceitamos prosseguir mesmo que o valor real tenha oscilado
      // levemente entretanto.
      let avisoConfirmado = false;
      let novoValorTotalPreview = recalcularValorTotalComAditivo(Number(contrato.valorTotal) || 0, aditivoEmEdicao?.valorAditivado || 0, 0);
      let valorAlteracaoPreview = 0;
      if (aditivoTipo === 'valor' || aditivoTipo === 'ambos') {
        const v = Number(aditivoValor); valorAlteracaoPreview = calcularValorAlteracaoAditivo(aditivoOperacao, v);
        if (aditivoOperacao === 'acrescimo' && excedeLimite25(v, novoValorTotalPreview)) {
          if (!window.confirm(`Acréscimo supera 25%. Prosseguir?`)) return;
          avisoConfirmado = true;
        }
        novoValorTotalPreview += valorAlteracaoPreview;
      }
      if (aditivoTipo === 'prazo' || aditivoTipo === 'ambos') {
        if (!aditivoNovaData) return toast.error('Informe a nova validade.');
      }

      toastId = toast.loading('A guardar aditivo...'); setLoading(true);

      let novoAditivo: Aditivo | null = null;
      const contratoRef = doc(db, 'contratos', id as string);
      // Transação: lê o contrato mais recente do servidor em vez do estado
      // local antes de recalcular valorTotal/aditivos — evita a condição de
      // corrida do read-modify-write direto (CLAUDE.md, problema conhecido
      // nº 1). Repete a checagem dos 25% aqui contra o valor real: se o
      // usuário NÃO tinha sido avisado na pré-checagem (achava que era um
      // acréscimo normal) mas o valor base mudou entretanto — outro fiscal
      // registou aditivo nesse intervalo — e agora ultrapassa 25%, aborta
      // em vez de gravar silenciosamente sem aviso (achado do revisor-pmp
      // nesta fase). Se já tinha sido avisado e confirmado, prossegue.
      await runTransaction(db, async (transaction) => {
        const contratoSnap = await transaction.get(contratoRef);
        if (!contratoSnap.exists()) throw new Error('Contrato não encontrado.');
        const contratoAtual = contratoSnap.data() as Contrato;

        let novoValorTotal = recalcularValorTotalComAditivo(Number(contratoAtual.valorTotal) || 0, aditivoEmEdicao?.valorAditivado || 0, 0);
        let novaDataFimStr = contratoAtual.dataFim;
        let valorAlteracao = 0;
        if (aditivoTipo === 'valor' || aditivoTipo === 'ambos') {
          const v = Number(aditivoValor);
          if (aditivoOperacao === 'acrescimo' && !avisoConfirmado && excedeLimite25(v, novoValorTotal)) {
            throw new Error('CONCORRENCIA_25');
          }
          valorAlteracao = calcularValorAlteracaoAditivo(aditivoOperacao, v);
          novoValorTotal += valorAlteracao;
        }
        if (aditivoTipo === 'prazo' || aditivoTipo === 'ambos') {
          novaDataFimStr = aditivoNovaData;
        }

        novoAditivo = { id: aditivoEmEdicao ? aditivoEmEdicao.id : Date.now().toString(), descricao: aditivoDescricao || 'Termo Aditivo', dataAditivo: aditivoDataAditivo, tipo: aditivoTipo, valorAditivado: valorAlteracao, novaDataFim: (aditivoTipo === 'prazo' || aditivoTipo === 'ambos') && aditivoNovaData ? aditivoNovaData : "", itensAditivados: itensDoAditivo.length > 0 ? itensDoAditivo : [], };
        const novaLista = substituirAditivo(contratoAtual.aditivos, novoAditivo, !!aditivoEmEdicao, aditivoEmEdicao?.id);
        transaction.update(contratoRef, { valorTotal: novoValorTotal, dataFim: novaDataFimStr, aditivos: novaLista, dataUltimaAtualizacao: new Date().toLocaleString('pt-BR') });
      });

      await registrarLog('ADITIVO', `Aditivo "${novoAditivo!.descricao}" ${aditivoEmEdicao ? 'atualizado' : 'registado'} no Contrato ${contrato.numeroContrato}.`);
      toast.success(aditivoEmEdicao ? 'Aditivo atualizado!' : 'Aditivo registado!', { id: toastId });
      fecharModalAditivoState(); onSuccess();
    } catch (error) {
      if (error instanceof Error && error.message === 'CONCORRENCIA_25') {
        toast.error('O valor base do contrato mudou enquanto o formulário estava aberto e este acréscimo passou a ultrapassar 25%. Reabra o aditivo para confirmar com os dados atualizados.', { id: toastId, duration: 6000 });
      } else {
        toast.error("Erro ao guardar o aditivo.", toastId ? { id: toastId } : undefined);
      }
    } finally { setLoading(false); }
  };

  const salvarDistrato = async (e: React.FormEvent, onSuccess: () => void) => {
    e.preventDefault(); if (!id || !contrato) return;
    const toastId = toast.loading('A registar distrato...'); setLoading(true);
    try {
      await updateDoc(doc(db, 'contratos', id as string), { dataDistrato: distratoData, motivoDistrato: distratoMotivo, dataUltimaAtualizacao: new Date().toLocaleString('pt-BR') });
      await registrarLog('DISTRATO', `Contrato ${contrato.numeroContrato} foi distratado. Motivo: ${distratoMotivo}`);
      toast.success('Distrato registado!', { id: toastId }); onSuccess();
    } catch (error) { toast.error("Erro ao registar distrato.", { id: toastId }); 
    } finally { setLoading(false); }
  };

  // --- NOVA FUNÇÃO: SALVAR EDIÇÃO DE ITEM DO CATÁLOGO ---
  const salvarEdicaoItem = async (itemEditado: Item) => {
    if (!id || !contrato || !itemEditado.id) return false;
    setLoading(true);
    const toastId = toast.loading('A atualizar item...');
    try {
      const itemOriginal = itensCatalogo.find(i => i.id === itemEditado.id);
      const diferencaValor = itemEditado.valorTotalItem - (itemOriginal?.valorTotalItem || 0);

      // Atualiza o próprio item
      await updateDoc(doc(db, 'itens', itemEditado.id), {
        numeroItem: itemEditado.numeroItem,
        discriminacao: itemEditado.discriminacao,
        unidade: itemEditado.unidade,
        quantidade: itemEditado.quantidade,
        valorUnitario: itemEditado.valorUnitario,
        valorTotalItem: itemEditado.valorTotalItem
      });

      // Recalcula o Contrato global se o item mudou de valor. Transação:
      // soma a diferença sobre o valorTotal lido do servidor no momento do
      // commit, não o do estado local (mesma condição de corrida do
      // problema conhecido nº 1 do CLAUDE.md).
      if (diferencaValor !== 0) {
        const contratoRef = doc(db, 'contratos', id as string);
        await runTransaction(db, async (transaction) => {
          const contratoSnap = await transaction.get(contratoRef);
          if (!contratoSnap.exists()) throw new Error('Contrato não encontrado.');
          const valorAtual = Number((contratoSnap.data() as Contrato).valorTotal) || 0;
          transaction.update(contratoRef, {
            valorTotal: valorAtual + diferencaValor,
            dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
          });
        });
      }

      await registrarLog('EDIÇÃO CATÁLOGO', `Item "${itemEditado.discriminacao}" do contrato ${contrato.numeroContrato} editado.`);
      toast.success('Item atualizado com sucesso!', { id: toastId });
      return true;
    } catch (error) {
      toast.error('Erro ao atualizar item.', { id: toastId });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    contrato, itensCatalogo, loading, erro, valorGlobalAtualizado, totalAditivosAplicados, valorOriginal,
    aditivoEmEdicao, aditivoDataAditivo, setAditivoDataAditivo, aditivoDescricao, setAditivoDescricao, 
    aditivoTipo, setAditivoTipo, aditivoOperacao, setAditivoOperacao, aditivoValor, setAditivoValor,
    aditivoNovaData, setAditivoNovaData, itensDoAditivo, arquivoPdfAditivo, setArquivoPdfAditivo, 
    processandoPdfIA, itemManualSel, setItemManualSel, itemManualQtd, setItemManualQtd,
    itemManualVlUnit, setItemManualVlUnit, fecharModalAditivoState, lidarProcessamentoIA, 
    lidarAdicionarItemManual, removerItemAditivo, abrirEdicaoAditivo, excluirAditivo, salvarAditivo,
    distratoData, setDistratoData, distratoMotivo, setDistratoMotivo, salvarDistrato, excluirContrato,
    salvarEdicaoItem // <-- Exportação da nova função
  };
};