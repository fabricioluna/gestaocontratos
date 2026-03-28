import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './views/Login';
import Painel from './views/Painel';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota inicial é o Login */}
        <Route path="/" element={<Login />} />
        
        {/* Rota do Painel */}
        <Route path="/painel" element={<Painel />} />
        
        {/* Se o usuário digitar qualquer rota que não existe, manda pro login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;