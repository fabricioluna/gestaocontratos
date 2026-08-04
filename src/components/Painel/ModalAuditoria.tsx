// src/components/Painel/ModalAuditoria.tsx
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface LogAuditoria {
  id: string;
  usuario: string;
  acao: string;
  detalhes: string;
  dataHora: string;
  timestamp: number;
}

interface ModalAuditoriaProps {
  onClose: () => void;
}

// O pai (Painel.tsx) só monta este componente quando o modal deve estar
// aberto, então a assinatura do Firestore já nasce no mount — sem
// precisar de um `isOpen` prop nem de resetar estado dentro do efeito a
// cada abertura (mesmo padrão dos outros modais, Fase 7; achado de lint
// react-hooks/set-state-in-effect).
export default function ModalAuditoria({ onClose }: ModalAuditoriaProps) {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'auditoria_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista: LogAuditoria[] = [];
      snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, ...docSnap.data() } as LogAuditoria));
      setLogs(lista);
      setCarregando(false);
    }, (error) => {
      console.error('[Firebase Debug] Erro ao ler auditoria_logs:', error);
      setErro('Erro ao carregar o histórico de auditoria. Verifique a sua conexão ou permissão de acesso.');
      setCarregando(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '850px', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>📋 Histórico de Auditoria</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        {carregando && <p>A carregar...</p>}
        {erro && <p style={{ color: '#dc3545' }}>{erro}</p>}
        {!carregando && !erro && logs.length === 0 && <p>Nenhum registo de auditoria encontrado.</p>}

        {!carregando && !erro && logs.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '8px' }}>Data/Hora</th>
                  <th style={{ padding: '8px' }}>Usuário</th>
                  <th style={{ padding: '8px' }}>Ação</th>
                  <th style={{ padding: '8px' }}>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{log.dataHora}</td>
                    <td style={{ padding: '8px' }}>{log.usuario}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{log.acao}</td>
                    <td style={{ padding: '8px' }}>{log.detalhes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '15px' }}>Mostrando os 100 registos mais recentes.</p>
          </>
        )}
      </div>
    </div>
  );
}
