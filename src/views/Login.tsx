// src/views/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import logo from '../assets/logopmp.png';
import './Login.css';

export default function Login() {
  const [identificacao, setIdentificacao] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const inputLower = identificacao.toLowerCase().trim();
      
      // Mapeamento inteligente: converte a palavra curta no e-mail real do Firebase
      const adminMap: { [key: string]: string } = {
        'prefeitura': 'prefeitura@pesqueira.pe.gov.br',
        'saude': 'saude@pesqueira.pe.gov.br',
        'educacao': 'educacao@pesqueira.pe.gov.br',
        'assistencia': 'assistencia@pesqueira.pe.gov.br'
      };

      // Se a palavra estiver no mapa, usa o e-mail completo. Se não, usa o que foi digitado.
      const emailToUse = adminMap[inputLower] || inputLower;

      // 1. Conexão real com o Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, senha);
      const userEmail = userCredential.user.email || '';
      const emailLogado = userEmail.toLowerCase();

      // 2. Inteligência de Roteamento de Órgão
      let orgao = 'prefeitura'; 
      if (emailLogado.includes('assistencia')) orgao = 'fmas';
      else if (emailLogado.includes('educacao')) orgao = 'fme';
      else if (emailLogado.includes('saude')) orgao = 'fms';

      // 3. Inteligência de Perfil (Admin vs Fiscal)
      let perfil = 'admin';
      if (emailLogado.includes('fiscal') || emailLogado.includes('leitura')) {
        perfil = 'viewer';
      }

      // 4. Salva a sessão e entra
      sessionStorage.setItem('orgaoLogado', orgao);
      sessionStorage.setItem('perfilLogado', perfil);
      
      navigate('/painel');
    } catch (error: any) {
      console.error("Erro no login Firebase:", error);
      setErro('Usuário ou senha incorretos. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logo} alt="Logo PMP" className="login-logo" />
        <h2>Sistema de Gestão de Contratos</h2>
        <p className="login-subtitle">Prefeitura Municipal de Pesqueira</p>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Usuário ou E-mail</label>
            <input 
              type="text" 
              value={identificacao} 
              onChange={(e) => setIdentificacao(e.target.value)} 
              placeholder="ex: saude ou fiscal@pesqueira..."
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Palavra-passe</label>
            <input 
              type="password" 
              value={senha} 
              onChange={(e) => setSenha(e.target.value)} 
              placeholder="Introduza a sua senha"
              required 
            />
          </div>

          {erro && <div className="login-erro">{erro}</div>}
          
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'A autenticar...' : 'Entrar no Sistema'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Dúvidas sobre o acesso? Contacte o Setor de Licitações.</p>
        </div>
      </div>
    </div>
  );
}