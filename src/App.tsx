// src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast'; // IMPORTAÇÃO DO TOAST

import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import Login from './views/Login';

// LAZY LOADING
const Painel = lazy(() => import('./views/Painel'));
const DetalhesContrato = lazy(() => import('./views/DetalhesContrato'));

const LoadingScreen = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#0f172a' }}>
    <h2>A carregar sistema...</h2>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      {/* O Toaster fica aqui em cima. Ele escuta os pedidos de notificação de qualquer ecrã! */}
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          style: {
            background: '#333',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '8px',
          },
          success: { style: { background: '#10b981' } },
          error: { style: { background: '#ef4444' } },
        }} 
      />
      
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Login />} />
            
            <Route 
              path="/painel" 
              element={
                <ProtectedRoute>
                  <Painel />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/contrato/:id" 
              element={
                <ProtectedRoute>
                  <DetalhesContrato />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;