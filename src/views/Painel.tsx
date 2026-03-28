import { useNavigate } from 'react-router-dom';

export default function Painel() {
  const navigate = useNavigate();
  const orgao = sessionStorage.getItem('orgaoLogado');

  const sair = () => {
    sessionStorage.removeItem('orgaoLogado');
    navigate('/');
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Bem-vindo ao Painel!</h1>
      <p>Órgão logado: {orgao}</p>
      <button onClick={sair} style={{ padding: '10px 20px', cursor: 'pointer' }}>Sair</button>
    </div>
  );
}