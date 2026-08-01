// src/hooks/useContratos.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import type { Contrato } from '../types/types';

export const useContratos = () => {
  const { user, perfil, orgaoId, carregando } = useAuth();
  const isAdmin = perfil === 'admin';

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);

  const [termoBusca, setTermoBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: string, direcao: 'asc' | 'desc' }>({ campo: 'numeroContrato', direcao: 'desc' });

  // 1. CARREGAR DADOS DO FIREBASE
  useEffect(() => {
    if (carregando || !user || !perfil || !orgaoId) return;

    const contratosRef = collection(db, 'contratos');
    // As Firestore Rules da Fase 3 exigem que a query já venha filtrada por
    // orgaoId (uma query sem esse where() é rejeitada inteira, não filtrada
    // silenciosamente) — por isso o filtro não pode mais ser feito no
    // cliente depois de ler tudo, mesmo para admin.
    const q = isAdmin
      ? query(contratosRef, where('orgaoId', '==', orgaoId))
      : query(contratosRef, where('emailSecretaria', '==', user.email));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Contrato[] = [];
      snapshot.forEach((docSnap) => {
        lista.push({ id: docSnap.id, ...docSnap.data() } as Contrato);
      });
      setContratos(lista);
    }, (error) => {
      console.error("[Firebase Debug] Erro ao ler contratos:", error);
      toast.error('Erro ao conectar com a base de dados.');
    });

    return () => unsubscribe();
  }, [carregando, user, perfil, orgaoId, isAdmin]);

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
        let numero = 0; let ano = 0;
        if (partes.length > 0) numero = parseInt(partes[0].replace(/\D/g, ''), 10) || 0;
        if (partes.length > 1 && partes[1].replace(/\D/g, '').length >= 4) {
          ano = parseInt(partes[1].replace(/\D/g, '').substring(0, 4), 10) || 0;
        } else {
          if (c.dataInicio) ano = parseInt(c.dataInicio.substring(0, 4), 10) || 0;
        }
        return { ano, numero };
      };
      const valA = extrairAnoNumero(a);
      const valB = extrairAnoNumero(b);
      if (valA.ano !== valB.ano) return ordenacao.direcao === 'asc' ? valA.ano - valB.ano : valB.ano - valA.ano;
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
      const exclusaoPromise = async () => {
        setLoading(true);
        await deleteDoc(doc(db, 'contratos', contratoId));
        const qItens = query(collection(db, 'itens'), where('contratoId', '==', contratoId));
        const querySnapshot = await getDocs(qItens);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((itemDoc) => { batch.delete(itemDoc.ref); });
          await batch.commit();
        }
        setLoading(false);
      };
      toast.promise(exclusaoPromise(), {
        loading: 'A excluir contrato e itens...',
        success: 'Contrato excluído com sucesso!',
        error: 'Erro ao excluir o contrato.',
      });
    }
  };

  return {
    contratosFiltrados, loading, termoBusca, setTermoBusca, 
    ordenacao, lidarComOrdenacao, excluirContrato
  };
};