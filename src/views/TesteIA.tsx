// src/views/TesteIA.tsx
import React, { useState } from 'react';

export default function TesteIA() {
  const [status, setStatus] = useState<string>('Aguardando...');
  const [log, setLog] = useState<string>('');

  const listarModelosDisponiveis = async () => {
    setStatus('A contactar a Google...');
    setLog('');

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      setStatus('ERRO CRÍTICO: Chave não encontrada!');
      return;
    }

    const cleanApiKey = apiKey.replace(/['"]/g, '').trim();
    
    // Endpoint para LISTAR os modelos, em vez de gerar conteúdo
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanApiKey}`;

    try {
      setLog(`✅ Chave detetada! Começa com: ${cleanApiKey.substring(0, 10)}...\n📡 A pedir a lista de modelos à Google...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(`FALHOU! HTTP Status: ${response.status}`);
        setLog(prev => prev + `\n\n❌ ERRO DEVOLVIDO PELA GOOGLE:\n${JSON.stringify(data, null, 2)}`);
        return;
      }

      setStatus('SUCESSO! Modelos Encontrados.');
      
      // Filtra e formata a lista para vermos apenas os nomes dos modelos que suportam geração de texto
      const modelosTexto = data.models
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => m.name.replace('models/', ''));

      setLog(prev => prev + `\n\n🎉 MODELOS DISPONÍVEIS PARA A SUA CHAVE:\n\n${modelosTexto.join('\n')}\n\n👇 JSON COMPLETO DA RESPOSTA:\n${JSON.stringify(data.models.map((m:any)=> m.name), null, 2)}`);

    } catch (error: any) {
      setStatus('ERRO DE REDE');
      setLog(prev => prev + `\n\n❌ Erro ao contactar a internet:\n${error.message}`);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#004a99' }}>🔍 Mapeamento de Modelos da API</h1>
      <p>Este teste vai perguntar à Google exatamente quais os modelos que a sua chave pode usar.</p>

      <button 
        onClick={listarModelosDisponiveis} 
        style={{ padding: '12px 24px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
      >
        📋 Listar Modelos Disponíveis
      </button>

      <h3 style={{ marginTop: '30px' }}>Status: {status}</h3>
      <pre style={{ background: '#1e1e1e', color: '#00ff00', padding: '20px', borderRadius: '8px', overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: '14px', border: '1px solid #333' }}>
        {log || 'Os logs do servidor aparecerão aqui...'}
      </pre>
    </div>
  );
}