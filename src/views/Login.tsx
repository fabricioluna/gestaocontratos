// src/views/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import logo from '../assets/logopmp.png';
import './Login.css';

// Mapeamento de palavra curta -> e-mail institucional real. Usado tanto no
// login quanto na recuperação de senha, então fica fora do componente (não
// depende de props/estado, não precisa ser recriado a cada render).
const ADMIN_MAP: { [key: string]: string } = {
  'prefeitura': 'prefeitura@pesqueira.pe.gov.br',
  'saude': 'saude@pesqueira.pe.gov.br',
  'educacao': 'educacao@pesqueira.pe.gov.br',
  'assistencia': 'assistencia@pesqueira.pe.gov.br'
};

const resolverEmail = (identificacao: string) => {
  const inputLower = identificacao.toLowerCase().trim();
  return ADMIN_MAP[inputLower] || inputLower;
};

export default function Login() {
  const [identificacao, setIdentificacao] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const emailToUse = resolverEmail(identificacao);

      // 1. Conexão real com o Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, senha);

      // 2. Força o refresh do ID token: se o perfil/orgaoId foi definido há
      // pouco (ex: cadastro recente), o token em cache pode não os conter
      // ainda — sem isso, o passo seguinte veria claims desatualizados.
      const resultado = await userCredential.user.getIdTokenResult(true);
      if (!resultado.claims.perfil || !resultado.claims.orgaoId) {
        await signOut(auth);
        setErro('Esta conta ainda não tem um perfil configurado. Contacte o administrador.');
        setLoading(false);
        return;
      }

      void navigate('/painel');
    } catch (error) {
      console.error("Erro no login Firebase:", error);
      setErro('Usuário ou senha incorretos. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  const abrirRecuperarSenha = () => {
    setErro('');
    setEmailRecuperacao(identificacao);
    setMostrarRecuperar(true);
  };

  const handleRecuperarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoRecuperacao(true);
    const toastId = toast.loading('A enviar o link de redefinição...');

    const mensagemGenerica = 'Se este e-mail estiver cadastrado, você vai receber um link de redefinição em instantes.';

    try {
      const emailToUse = resolverEmail(emailRecuperacao);
      await sendPasswordResetEmail(auth, emailToUse);
      toast.success(mensagemGenerica, { id: toastId, duration: 6000 });
      setMostrarRecuperar(false);
    } catch (error) {
      // Não revela se o e-mail existe ou não (evita enumerar contas) — a
      // mesma mensagem genérica cobre "não encontrado" e sucesso real.
      const codigo = error instanceof Object && 'code' in error ? (error as { code?: string }).code : undefined;
      if (codigo === 'auth/user-not-found') {
        toast.success(mensagemGenerica, { id: toastId, duration: 6000 });
        setMostrarRecuperar(false);
      } else if (codigo === 'auth/invalid-email') {
        toast.error('E-mail inválido. Confira o que foi digitado.', { id: toastId });
      } else {
        console.error('Erro ao enviar redefinição de senha:', error);
        toast.error('Não foi possível enviar o e-mail agora. Tente novamente em instantes.', { id: toastId });
      }
    } finally {
      setEnviandoRecuperacao(false);
    }
  };

  if (mostrarRecuperar) {
    return (
      <div className="login-container">
        <div className="login-box">
          <img src={logo} alt="Logo PMP" className="login-logo" />
          <h2>Recuperar Senha</h2>
          <p className="login-subtitle">Informe o usuário ou e-mail da conta</p>

          <form onSubmit={handleRecuperarSenha} className="login-form">
            <div className="form-group">
              <label>Usuário ou E-mail</label>
              <input
                type="text"
                value={emailRecuperacao}
                onChange={(e) => setEmailRecuperacao(e.target.value)}
                placeholder="ex: saude ou fiscal@pesqueira..."
                required
                autoFocus
              />
            </div>

            <button type="submit" className="btn-login" disabled={enviandoRecuperacao}>
              {enviandoRecuperacao ? 'A enviar...' : 'Enviar Link de Redefinição'}
            </button>
          </form>

          <div className="login-footer">
            <button type="button" className="link-voltar-login" onClick={() => setMostrarRecuperar(false)}>
              ← Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          <button type="button" className="link-esqueci-senha" onClick={abrirRecuperarSenha}>
            Esqueci minha senha
          </button>
        </form>

        <div className="login-footer">
          <p>Dúvidas sobre o acesso? Contacte o Setor de Licitações.</p>
        </div>
      </div>
    </div>
  );
}
