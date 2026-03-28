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

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    numeroContrato: '', numeroProcesso: '', numeroPregao: '', numeroAta: '',
    fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '',
    dataFim: '', valorTotal: '', fiscalContrato: '', observacao: ''
  });

  const nomesOrgaos: { [key: string]: string } = {
    'prefeitura': 'Prefeitura Municipal de Pesqueira',
    'fmas': 'Fundo Municipal de Assistência Social',
    'fme': 'Fundo Municipal de Educação',
    'fms': 'Fundo Municipal de Saúde'
  };

  useEffect(() => {
    if (!orgaoLogado) {
      navigate('/');
      return;
    }
    const q = query(collection(db, 'contratos'), where('orgaoId', '==', orgaoLogado));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const listaContratos: Contrato[] = [];
      querySnapshot.forEach((doc) => {
        listaContratos.push({ id: doc.id, ...doc.data() } as Contrato);
      });
      setContratos(listaContratos);
    });
    return () => unsubscribe();
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
      const valorTotalNumerico = Number(formData.valorTotal);
      
      await addDoc(collection(db, 'contratos'), {
        ...formData,
        orgaoId: orgaoLogado,
        valorTotal: valorTotalNumerico,
        saldoContrato: valorTotalNumerico // O saldo começa igual ao valor total!
      });

      alert('Contrato salvo com sucesso!');
      setIsModalOpen(false);
      setFormData({
        numeroContrato: '', numeroProcesso: '', numeroPregao: '', numeroAta: '',
        fornecedor: '', objetoCompleto: '', objetoResumido: '', dataInicio: '',
        dataFim: '', valorTotal: '', fiscalContrato: '', observacao: ''
      });
    } catch (error) {
      console.error("Erro ao adicionar documento: ", error);
      alert('Erro ao salvar o contrato.');
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
              <th>Saldo Atual</th>
              <th>Ações</th> {/* NOVA COLUNA DE AÇÕES */}
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>Nenhum contrato cadastrado.</td>
              </tr>
            ) : (
              contratos.map((contrato) => (
                <tr key={contrato.id}>
                  <td>{contrato.numeroContrato}</td>
                  <td>{contrato.fornecedor}</td>
                  {/* Mostramos o Saldo na tabela inicial com formatação de Moeda */}
                  <td style={{ fontWeight: 'bold', color: contrato.saldoContrato < 0 ? 'red' : 'green' }}>
                    {contrato.saldoContrato ? contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                  </td>
                  <td>
                    {/* BOTÃO PARA A NOVA PÁGINA DE DETALHES */}
                    <button 
                      style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => navigate(`/contrato/${contrato.id}`)}
                    >
                      Ver Detalhes / Itens
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </main>

      {/* O Modal continua exatamente igual */}
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
                  <label>Ata de Reg. de Preços</label>
                  <input type="text" name="numeroAta" value={formData.numeroAta} onChange={lidarComMudanca} />
                </div>
                <div className="form-group full-width">
                  <label>Fornecedor</label>
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
                  <label>Data Início</label>
                  <input type="date" name="dataInicio" required value={formData.dataInicio} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Data Fim</label>
                  <input type="date" name="dataFim" required value={formData.dataFim} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Valor Total (Ex: 150000.50)</label>
                  <input type="number" step="0.01" name="valorTotal" required value={formData.valorTotal} onChange={lidarComMudanca} />
                </div>
                <div className="form-group">
                  <label>Fiscal</label>
                  <input type="text" name="fiscalContrato" value={formData.fiscalContrato} onChange={lidarComMudanca} />
                </div>
                <div className="form-group full-width">
                  <label>Observação</label>
                  <input type="text" name="observacao" value={formData.observacao} onChange={lidarComMudanca} />
                </div>
              </div>
              <div className="modal-acoes">
                <button type="button" className="btn-cancelar" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-salvar" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}