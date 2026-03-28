import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logopmp.png';
import './Login.css';

export default function Login() {
  // Estados para guardar o que o usuário digita
  const [orgao, setOrgao] = useState('prefeitura');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  
  const navigate = useNavigate(); // Ferramenta de navegação do React Router

  const fazerLogin = (e: React.FormEvent) => {
    e.preventDefault(); // Evita que a página recarregue ao enviar o formulário
    let autenticado = false;

    // Nossa lógica de autenticação
    if (orgao === 'prefeitura' && login === 'prefeitura' && senha === 'pmp10') autenticado = true;
    else if (orgao === 'fmas' && login === 'fmas' && senha === 'fmas10') autenticado = true;
    else if (orgao === 'fme' && login === 'fme' && senha === 'fme10') autenticado = true;
    else if (orgao === 'fms' && login === 'fms' && senha === 'fms10') autenticado = true;

    if (autenticado) {
      sessionStorage.setItem('orgaoLogado', orgao);
      setErro(false);
      navigate('/painel'); // Redireciona sem recarregar a página!
    } else {
      setErro(true);
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
              <option value="fmas">Fundo Mun. de Assistência Social</option>
              <option value="fme">Fundo Mun. de Educação</option>
              <option value="fms">Fundo Mun. de Saúde</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="login">Login:</label>
            <input 
              type="text" 
              id="login" 
              placeholder="Digite seu login" 
              value={login}
              onChange={(e) => setLogin(e.target.value)}
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
            />
          </div>

          <button type="submit">Entrar</button>

          {erro && <p className="error-message">Login ou senha incorretos!</p>}
        </form>
      </div>
    </div>
  );
}