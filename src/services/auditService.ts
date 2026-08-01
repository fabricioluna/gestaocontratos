// src/services/auditService.ts
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';

export const registrarLog = async (acao: string, detalhes: string) => {
  try {
    const auth = getAuth();
    const usuarioLogado = auth.currentUser?.email || 'Administrador do Sistema';
    
    await addDoc(collection(db, 'auditoria_logs'), {
      usuario: usuarioLogado,
      acao: acao,
      detalhes: detalhes,
      dataHora: new Date().toLocaleString('pt-BR'),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Aviso: Falha ao gravar log de auditoria invisível.", error);
  }
};