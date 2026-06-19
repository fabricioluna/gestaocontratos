// src/components/common/ErrorBoundary.tsx
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Aqui poderíamos enviar o erro para um serviço como o Sentry ou Firebase Crashlytics
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Esta é a tela que o utilizador vai ver em caso de "Crash"
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', textAlign: 'center', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '10px', fontSize: '24px' }}>
            ⚠️ Oops! Algo não correu como esperado.
          </h1>
          <p style={{ marginBottom: '20px', color: '#64748b' }}>
            Ocorreu um erro inesperado no sistema. A nossa equipa de desenvolvimento já foi notificada (no console).
          </p>
          
          <div style={{ backgroundColor: '#fee2e2', padding: '15px', borderRadius: '8px', border: '1px solid #fca5a5', maxWidth: '600px', width: '100%', marginBottom: '25px', fontSize: '13px', color: '#991b1b', wordWrap: 'break-word', textAlign: 'left' }}>
            <strong>Detalhes Técnicos:</strong> {this.state.errorMessage}
          </div>
          
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '12px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v6h6"></path></svg>
            Tentar Novamente (Recarregar)
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;