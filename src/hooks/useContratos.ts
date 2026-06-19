// src/hooks/useContratos.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Contrato } from '../types/types';

export const useContratos = (orgaoLogado: string | null) => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [termoBusca, setTermoBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: string, direcao: 'asc' | 'desc' }>({ campo: 'numeroContrato', direcao: 'desc' });

  // 1. CARREGAR DADOS DO FIREBASE
  useEffect(() => {
    if (!orgaoLogado) return;
    
    const q = query(collection(db, 'contratos'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Contrato[] = [];
      
      console.log(`[Firebase Debug] Documentos encontrados na coleção 'contratos': ${snapshot.size}`);
      
      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const identificadorOrgao = dados.orgaoId || dados.orgao || '';
        
        if (identificadorOrgao.toLowerCase().includes(orgaoLogado.toLowerCase())) {
          lista.push({ id: docSnap.id, ...dados } as Contrato);
        }
      });
      
      setContratos(lista);
    }, (error) => {
      console.error("[Firebase Debug] Erro ao ler a coleção 'contratos':", error);
    });
    
    return () => unsubscribe();
  }, [orgaoLogado]);

  // 2. FUNÇÃO DE ORDENAÇÃO
  const lidarComOrdenacao = (campo: string) => {
    setOrdenacao(prev => ({ campo, direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc' }));
  };

  // 3. ORDENAÇÃO INTELIGENTE
  const contratosOrdenados = [...contratos].sort((a, b) => {
    if (ordenacao.campo === 'numeroContrato') {
      const extrairAnoNumero = (c: Contrato) => {
        const numStr = c.numeroContrato || '';
        const partes = numStr.split('/');
        
        let numero = 0;
        let ano = 0;
        
        if (partes.length > 0) {
          numero = parseInt(partes[0].replace(/\D/g, ''), 10) || 0;
        }
        
        if (partes.length > 1 && partes[1].replace(/\D/g, '').length >= 4) {
          ano = parseInt(partes[1].replace(/\D/g, '').substring(0, 4), 10) || 0;
        } else {
          if (c.dataInicio) {
            ano = parseInt(c.dataInicio.substring(0, 4), 10) || 0;
          }
        }
        return { ano, numero };
      };

      const valA = extrairAnoNumero(a);
      const valB = extrairAnoNumero(b);

      if (valA.ano !== valB.ano) {
        return ordenacao.direcao === 'asc' ? valA.ano - valB.ano : valB.ano - valA.ano;
      }
      return ordenacao.direcao === 'asc' ? valA.numero - valB.numero : valB.numero - valA.numero;
    }

    let valorA: any = a[ordenacao.campo as keyof Contrato] || '';
    let valorB: any = b[ordenacao.campo as keyof Contrato] || '';
    if (typeof valorA === 'string') valorA = valorA.toLowerCase();
    if (typeof valorB === 'string') valorB = valorB.toLowerCase();
    
    if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
    if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
    return 0;
  });

  // 4. FILTRAGEM (TERMO DE BUSCA)
  const contratosFiltrados = contratosOrdenados.filter((c) => {
    const termo = termoBusca.toLowerCase();
    return (
      (c.numeroContrato || '').toLowerCase().includes(termo) ||
      (c.fornecedor || '').toLowerCase().includes(termo) ||
      (c.objetoResumido || '').toLowerCase().includes(termo) ||
      (c.objetoCompleto || '').toLowerCase().includes(termo) ||
      (c.fiscalContrato || '').toLowerCase().includes(termo)
    );
  });

  // 5. EXCLUSÃO COM CASCADE (DELETA ITENS VINCULADOS)
  const excluirContrato = async (contratoId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este contrato e todos os itens vinculados?')) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'contratos', contratoId));
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', contratoId));
        const querySnapshot = await getDocs(qItens);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((itemDoc) => { batch.delete(itemDoc.ref); });
          await batch.commit();
        }
        alert('Contrato excluído com sucesso!');
      } catch (error) { 
        alert('Erro ao excluir contrato.'); 
        console.error(error);
      } finally { 
        setLoading(false); 
      }
    }
  };

  return {
    contratosFiltrados,
    loading,
    termoBusca,
    setTermoBusca,
    ordenacao,
    lidarComOrdenacao,
    excluirContrato
  };
};