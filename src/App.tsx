// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './views/Login';
import Painel from './views/Painel';
import DetalhesContrato from './views/DetalhesContrato';

// IMPORTAÇÃO DO NOSSO COMPONENTE DE SEGURANÇA
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota Pública (Livre acesso) */}
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
        
        {/* Rota de Fallback: Se digitar um link que não existe, vai pro Login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;