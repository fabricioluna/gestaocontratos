// src/views/Painel.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Contrato } from '../types';
import logo from '../assets/logopmp.png';
import './Painel.css';

export default function Painel() {
  const navigate = useNavigate();
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');

  // Estados
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estado para o formulário (um objeto com todos os campos vazios)
  const [formData, setFormData] = useState({
    numeroContrato: '',
    numeroProcesso: '',
    numeroPregao: '',
    numeroAta: '',
    fornecedor: '',
    objetoCompleto: '',
    objetoResumido: '',
    dataInicio: '',
    dataFim: '',
    valorTotal: '',
    fiscalContrato: '',
    observacao: ''
  });

  // Nomes amigáveis dos órgãos
  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social',
    'fme': 'Fundo Municipal de Educação',
    'fms': 'Fundo Municipal de Saúde'
  };

  // Efeito para buscar os contratos no Firebase em tempo real
  useEffect(() => {
    if (!orgaoLogado) {
      navigate('/');
      return;
    }

    // Cria uma "query" (busca) para pegar apenas os contratos do órgão logado
    const q = query(collection(db, 'contratos'), where('orgaoId', '==', orgaoLogado));

    // onSnapshot fica "escutando" o banco. Mudou lá, muda aqui na hora!
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const listaContratos: Contrato[] = [];
      querySnapshot.forEach((doc) => {
        listaContratos.push({ id: doc.id, ...doc.data() } as Contrato);
      });
      setContratos(listaContratos);
    });

    return () => unsubscribe(); // Limpa a escuta ao sair da tela
  }, [orgaoLogado, navigate]);

  const fazerLogout = () => {
    sessionStorage.removeItem('orgaoLogado');
    navigate('/');
  };

  const lidarComMudanca = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const salvarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Salva no Firebase na coleção "contratos"
      await addDoc(collection(db, 'contratos'), {
        ...formData,
        orgaoId: orgaoLogado,
        valorTotal: Number(formData.valorTotal) // Garante que o valor seja salvo como número
      });

      alert('Contrato salvo com sucesso!');
      setIsModalOpen(false); // Fecha o modal
      // Limpa o formulário
      setFormData({
        numeroContrato: '', numeroProcesso: '', numeroPregao: '', numeroAta: '',
        fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '',
        dataFim: '', valorTotal: '', fiscalContrato: '', observacao: ''
      });
    } catch (error) {
      console.error("Erro ao adicionar documento: ", error);
      alert('Erro ao salvar o contrato. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2>{orgaoLogado ? nomesOrgaos[orgaoLogado] : 'Carregando...'}</h2>
        </div>
        <button className="btn-sair" onClick={fazerLogout}>Sair</button>
      </header>

      <main className="conteudo">
        <div className="acoes-topo">
          <h2>Contratos Cadastrados</h2>
          <button className="btn-novo" onClick={() => setIsModalOpen(true)}>+ Novo Contrato</button>
        </div>

        <table className="tabela-contratos">
          <thead>
            <tr>
              <th>Nº Contrato</th>
              <th>Fornecedor</th>
              <th>Objeto Resumido</th>
              <th>Fim do Contrato</th>
              <th>Valor Total (R$)</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center' }}>Nenhum contrato cadastrado.</td>
              </tr>
            ) : (
              contratos.map((contrato) => (
                <tr key={contrato.id}>
                  <td>{contrato.numeroContrato}</td>
                  <td>{contrato.fornecedor}</td>
                  <td>{contrato.objetoResumido}</td>
                  <td>{contrato.dataFim}</td>
                  <td>{contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>

      {/* MODAL DE NOVO CONTRATO */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Cadastrar Novo Contrato</h2>
            <form onSubmit={salvarContrato}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Número do Contrato</label>
                  <input type="text" name="numeroContrato" required value={formData.numeroContrato} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Número do Processo</label>
                  <input type="text" name="numeroProcesso" required value={formData.numeroProcesso} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Número do Pregão</label>
                  <input type="text" name="numeroPregao" value={formData.numeroPregao} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Ata de Registro de Preços</label>
                  <input type="text" name="numeroAta" value={formData.numeroAta} onChange={lidarComMudanca} />
                </div>
                <div className="form-group full-width">
                  <label>Fornecedor (Empresa)</label>
                  <input type="text" name="fornecedor" required value={formData.fornecedor} onChange={lidarComMudanca} />
                </div>
                <div className="form-group full-width">
                  <label>Objeto Resumido</label>
                  <input type="text" name="objetoResumido" required value={formData.objetoResumido} onChange={lidarComMudanca} />
                </div>
                <div className="form-group full-width">
                  <label>Objeto Completo</label>
                  <textarea name="objetoCompleto" rows={3} style={{ width: '100%' }} value={formData.objetoCompleto} onChange={lidarComMudanca}></textarea>
                </div>
                <div className="form-group">
                  <label>Data de Início</label>
                  <input type="date" name="dataInicio" required value={formData.dataInicio} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Data de Fim</label>
                  <input type="date" name="dataFim" required value={formData.dataFim} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Valor Total (Ex: 150000.50)</label>
                  <input type="number" step="0.01" name="valorTotal" required value={formData.valorTotal} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Fiscal do Contrato</label>
                  <input type="text" name="fiscalContrato" value={formData.fiscalContrato} onChange={lidarComMudanca} />
                </div>
                <div className="form-group full-width">
                  <label>Observação</label>
                  <input type="text" name="observacao" value={formData.observacao} onChange={lidarComMudanca} />
                </div>
              </div>

              <div className="modal-acoes">
                <button type="button" className="btn-cancelar" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-salvar" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}