// src/components/Painel/ModalGerenciarUsuarios.tsx
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../../firebase';

interface ModalGerenciarUsuariosProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalGerenciarUsuarios({ isOpen, onClose }: ModalGerenciarUsuariosProps) {
  const [emailUsuario, setEmailUsuario] = useState('');
  const [orgaoVinculado, setOrgaoVinculado] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const cadastrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailUsuario) {
      toast.error("Por favor, preencha o e-mail do Usuário.");
      return;
    }
    if (!orgaoVinculado) {
      toast.error("Selecione o Fundo/Órgão vinculado.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading('A processar permissões e a enviar credenciais...');

    try {
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email: emailUsuario, nomeOrgao: orgaoVinculado })
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Falha na comunicação com o servidor.");
      }

      if (!response.ok || !data.success) {
        toast.error(data.message || "Erro ao tentar validar/criar o usuário.", { id: toastId });
        return;
      }

      const responsePerfil = await fetch('/api/definir-perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email: emailUsuario, perfil: 'viewer', orgaoId: orgaoVinculado })
      });
      const dataPerfil = await responsePerfil.json();

      if (!responsePerfil.ok || !dataPerfil.success) {
        toast.error("Usuário criado, mas o perfil de acesso não pôde ser definido. Reenvie o formulário para tentar novamente.", { id: toastId });
        return;
      }

      toast.success(data.message, { id: toastId });
      setEmailUsuario('');
      setOrgaoVinculado('');
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro de comunicação. Tente novamente.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>👥 Adicionar Usuário (Fiscal)</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        <form onSubmit={cadastrarUsuario}>
          <div className="form-group full-width">
            <label>E-mail do Usuário</label>
            <input 
              type="email" 
              required 
              value={emailUsuario} 
              onChange={(e) => setEmailUsuario(e.target.value)} 
              placeholder="fiscal.fms@pesqueira.pe.gov.br" 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div className="form-group full-width" style={{ marginTop: '15px' }}>
            <label>Fundo / Órgão Vinculado</label>
            <select
              required
              value={orgaoVinculado}
              onChange={(e) => setOrgaoVinculado(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="">Selecione o Órgão</option>
              <option value="fms">Fundo Municipal de Saúde</option>
              <option value="fme">Fundo Municipal de Educação</option>
              <option value="fmas">Fundo Municipal de Assistência Social</option>
              <option value="prefeitura">Prefeitura (Geral)</option>
            </select>
          </div>

          <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '6px', marginTop: '20px', border: '1px solid #bbf7d0' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
              <strong>Nota de Segurança:</strong> Ao cadastrar, o sistema gerará uma <strong>Senha</strong> aleatória e enviará um e-mail com as credenciais de acesso para este usuário.
            </p>
          </div>

          <div className="modal-acoes" style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-cancelar" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="btn-salvar" disabled={loading}>
              {loading ? 'A processar...' : 'Criar Acesso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}