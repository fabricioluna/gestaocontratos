// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './views/Login';
import Painel from './views/Painel';
import DetalhesContrato from './views/DetalhesContrato';
import TesteIA from './views/TesteIA';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/painel" element={<Painel />} />
        
        {/* ESTA ROTA É A QUE IMPEDE VOLTAR PRO LOGIN: */}
        <Route path="/contrato/:id" element={<DetalhesContrato />} />
        
        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/teste-ia" element={<TesteIA />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;