// src/views/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // Importação do auth seguro
import logo from '../assets/logopmp.png';
import './Login.css';

export default function Login() {
  const [orgao, setOrgao] = useState('prefeitura');
  const [loginUsuario, setLoginUsuario] = useState(''); // Renomeado para não conflitar
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(false);
    setLoading(true);

    try {
      // Cria o email fake baseado no login digitado para enviar pro Firebase
      const emailFirebase = `${loginUsuario.trim().toLowerCase()}@pesqueira.pe.gov.br`;
      
      // AUTENTICAÇÃO REAL NO SERVIDOR DO GOOGLE
      await signInWithEmailAndPassword(auth, emailFirebase, senha);

      // Se passou da linha acima, a senha e o utilizador existem e estão corretos!
      sessionStorage.setItem('orgaoLogado', orgao);
      navigate('/painel');

    } catch (error) {
      console.error("Erro na autenticação:", error);
      setErro(true); // Mostra erro se as credenciais estiverem erradas
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <img src={logo} alt="Logo Prefeitura de Pesqueira" className="logo" />
        <h2>Gestão de Contratos</h2>

        <form onSubmit={fazerLogin}>
          <div className="form-group">
            <label htmlFor="orgao">Selecione o Órgão/Fundo:</label>
            <select id="orgao" value={orgao} onChange={(e) => setOrgao(e.target.value)}>
              <option value="prefeitura">Prefeitura Municipal</option>
              <option value="fmas">Fundo Mun. de Assistência Social (FMAS)</option>
              <option value="fme">Fundo Mun. de Educação (FME)</option>
              <option value="fms">Fundo Mun. de Saúde (FMS)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="login">Login:</label>
            <input 
              type="text" 
              id="login" 
              placeholder="Digite seu login (ex: prefeitura)" 
              value={loginUsuario}
              onChange={(e) => setLoginUsuario(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="senha">Senha:</label>
            <input 
              type="password" 
              id="senha" 
              placeholder="Digite sua senha" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'A autenticar...' : 'Entrar'}
          </button>

          {erro && <p className="error-message">Login ou senha incorretos!</p>}
        </form>
      </div>
    </div>
  );
}