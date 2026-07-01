// src/views/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // Importa a autenticação oficial do seu Firebase
import logo from '../assets/logopmp.png';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      // 1. Conexão real com o seu Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const userEmail = userCredential.user.email || '';
      const emailLower = userEmail.toLowerCase();

      // 2. Inteligência de Roteamento de Órgão
      let orgao = 'prefeitura'; 
      if (emailLower.includes('fmas')) orgao = 'fmas';
      else if (emailLower.includes('fme')) orgao = 'fme';
      else if (emailLower.includes('fms')) orgao = 'fms';

      // 3. Inteligência de Perfil (Admin vs Fiscal)
      let perfil = 'admin';
      // Se o e-mail cadastrado no Firebase tiver a palavra 'fiscal' ou 'leitura', ele vira visualizador
      if (emailLower.includes('fiscal') || emailLower.includes('leitura')) {
        perfil = 'viewer';
      }

      // 4. Salva a sessão de forma segura e entra
      sessionStorage.setItem('orgaoLogado', orgao);
      sessionStorage.setItem('perfilLogado', perfil);
      
      navigate('/painel');
    } catch (error: any) {
      console.error("Erro no login Firebase:", error);
      setErro('E-mail ou senha incorretos. Verifique os dados cadastrados no Firebase.');
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
            <label>E-mail de Acesso</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="ex: admin@pesqueira.pe.gov.br"
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
            {loading ? 'A autenticar no Firebase...' : 'Entrar no Sistema'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Dúvidas sobre o acesso? Contacte o Setor de Licitações.</p>
        </div>
      </div>
    </div>
  );
}