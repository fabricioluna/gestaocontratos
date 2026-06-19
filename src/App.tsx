// src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';

// IMPORTAÇÃO PADRÃO PARA A TELA INICIAL (Mais rápido)
import Login from './views/Login';

// LAZY LOADING: Estas páginas só são descarregadas da internet quando o utilizador precisar delas
const Painel = lazy(() => import('./views/Painel'));
const DetalhesContrato = lazy(() => import('./views/DetalhesContrato'));

// Um simples componente de carregamento enquanto o código da página é descarregado
const LoadingScreen = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#0f172a' }}>
    <h2>A carregar sistema...</h2>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      {/* Suspense é a "sala de espera" enquanto as páginas Lazy são carregadas */}
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Rota Pública */}
          <Route path="/" element={<Login />} />
          
          {/* Rotas Privadas (Protegidas pelo nosso guarda) */}
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
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;