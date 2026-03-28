// src/views/DetalhesContrato.tsx
import { useParams, useNavigate } from 'react-router-dom';

export default function DetalhesContrato() {
  const { id } = useParams(); // Pega o ID do contrato lá da barra de endereço (URL)
  const navigate = useNavigate();

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>Página de Detalhes do Contrato</h1>
      <p>ID do Contrato Selecionado: <strong>{id}</strong></p>
      
      <button onClick={() => navigate('/painel')} style={{ padding: '10px 20px', cursor: 'pointer', marginTop: '20px' }}>
        Voltar para o Painel
      </button>
    </div>
  );
}