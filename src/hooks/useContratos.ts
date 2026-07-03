// src/hooks/useContratos.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import type { Contrato } from '../types/types';

export const useContratos = (orgaoLogado: string | null) => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [termoBusca, setTermoBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<{ campo: string, direcao: 'asc' | 'desc' }>({ campo: 'numeroContrato', direcao: 'desc' });

  // 1. CARREGAR DADOS DO FIREBASE (COM ISOLAMENTO DE SEGURANÇA)
  useEffect(() => {
    // 1.1. Identifica quem é o utilizador logado diretamente no hook
    const isAdmin = localStorage.getItem('userRole') === 'admin';
    const userEmail = localStorage.getItem('userEmail');

    // Segurança Base: Se for fiscal e não tiver email, aborta. Se for admin e não tiver órgão, aborta.
    if (!isAdmin && !userEmail) return;
    if (isAdmin && !orgaoLogado) return;
    
    const contratosRef = collection(db, 'contratos');
    let q;

    // 1.2. A MÁGICA DA SEGURANÇA (RLS - Row Level Security)
    if (isAdmin) {
      // O Administrador pode puxar todos os contratos do banco de dados
      q = query(contratosRef);
    } else {
      // O Fiscal puxa EXCLUSIVAMENTE os contratos onde o e-mail dele está cadastrado.
      // O Firebase bloqueia o envio de qualquer outro contrato pela rede!
      q = query(contratosRef, where('emailSecretaria', '==', userEmail));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: Contrato[] = [];
      
      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        
        if (isAdmin) {
          // O Admin continua com a filtragem visual do órgão logado (mantendo a sua lógica original)
          const identificadorOrgao = dados.orgaoId || dados.orgao || '';
          if (orgaoLogado && identificadorOrgao.toLowerCase().includes(orgaoLogado.toLowerCase())) {
            lista.push({ id: docSnap.id, ...dados } as Contrato);
          }
        } else {
          // Para o fiscal, a query segura do Firebase já fez todo o trabalho. É só injetar!
          lista.push({ id: docSnap.id, ...dados } as Contrato);
        }
      });
      
      setContratos(lista);
    }, (error) => {
      console.error("[Firebase Debug] Erro ao ler a coleção 'contratos':", error);
      toast.error('Erro de segurança ou falha ao conectar com a base de dados.'); 
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
    contratosFiltrados,
    loading,
    termoBusca,
    setTermoBusca,
    ordenacao,
    lidarComOrdenacao,
    excluirContrato
  };
};