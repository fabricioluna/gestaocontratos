// src/views/Painel.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import toast from 'react-hot-toast';
import type { Contrato } from '../types/types';
import logo from '../assets/logopmp.png';
import './Painel.css';

import { formatarDataBr } from '../utils/formatters';
import { parseDataLocal } from '../domain/vencimento';
import { carregarJsPDF } from '../utils/pdfGerador';
import type { RowInput, Styles } from 'jspdf-autotable';
import { gerarPlanilhaXlsx } from '../utils/xlsxGerador';
import { NOMES_ORGAOS } from '../utils/orgaos';
import { auth, db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import ModalNovoContrato from '../components/Painel/ModalNovoContrato';
import ModalEditarContrato from '../components/Painel/ModalEditarContrato';
import ModalRelatorioGlobal from '../components/Painel/ModalRelatorioGlobal';
import ModalGerenciarUsuarios from '../components/Painel/ModalGerenciarUsuarios';
import TabelaContratos from '../components/Painel/TabelaContratos';
import { infoVencimento } from '../utils/statusContrato';
import { useContratos } from '../hooks/useContratos';

export default function Painel() {
  const navigate = useNavigate();
  const { perfil, orgaoId: orgaoLogado } = useAuth();
  const isAdmin = perfil === 'admin';

  const {
    contratosFiltrados, loading, termoBusca, setTermoBusca,
    ordenacao, lidarComOrdenacao, excluirContrato,
    temMais, carregarMaisContratos
  } = useContratos();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [isModalUsuariosOpen, setIsModalUsuariosOpen] = useState(false); 
  const [contratoParaEditar, setContratoParaEditar] = useState<Contrato | null>(null);

  const [isModalRelatorioOpen, setIsModalRelatorioOpen] = useState(false);
  const [opcIncluirAditivos, setOpcIncluirAditivos] = useState(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        setIsModalEditOpen(false);
        setIsModalRelatorioOpen(false);
        setIsModalUsuariosOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // --- MOTOR DE FILTRO DE DATAS PARA RELATÓRIOS ---
  const filtrarContratosPorPeriodo = (lista: Contrato[], dataI: string, dataF: string) => {
    if (!dataI && !dataF) return lista;
    return lista.filter(c => {
      if (!c.dataFim) return false;
      const vencimento = parseDataLocal(c.dataFim); vencimento.setHours(0, 0, 0, 0);
      let passaInicio = true;
      let passaFim = true;

      if (dataI) {
        const inicio = parseDataLocal(dataI);
        inicio.setHours(0, 0, 0, 0);
        if (vencimento < inicio) passaInicio = false;
      }
      if (dataF) {
        const fim = parseDataLocal(dataF);
        fim.setHours(0, 0, 0, 0);
        if (vencimento > fim) passaFim = false;
      }
      return passaInicio && passaFim;
    });
  };

  // --- GERAÇÃO DE EXCEL COM FILTRO ---
  const exportarParaExcel = async (dataInicio: string, dataFim: string) => {
    setIsModalRelatorioOpen(false);
    const listaFiltrada = filtrarContratosPorPeriodo(contratosFiltrados, dataInicio, dataFim);

    const dadosPlanilha = listaFiltrada.map(c => {
      const vTotal = Number(c.valorTotal) || 0;
      return {
        'Nº Contrato': c.numeroContrato || '-',
        'Processo': c.numeroProcesso || '-',
        'Modalidade': `${c.modalidade || ''} ${c.numeroModalidade || ''}`.trim(),
        'Fornecedor': c.fornecedor || '-',
        'CPF/CNPJ': c.cnpjFornecedor || '-',
        'Objeto': c.objetoResumido || '-',
        'Valor Global (R$)': vTotal,
        'Data Início': formatarDataBr(c.dataInicio),
        'Data Fim (Validade)': formatarDataBr(c.dataFim),
        'Fiscal do Contrato': c.fiscalContrato || '-',
        'Status Atual': infoVencimento(c.dataFim).titulo,
        'Qtd Aditivos': c.aditivos?.length || 0
      };
    });

    const nomeFundo = orgaoLogado ? orgaoLogado.toUpperCase() : 'GERAL';
    await gerarPlanilhaXlsx(dadosPlanilha, 'Contratos', `Relatorio_Contratos_${nomeFundo}.xlsx`);
  };

  // --- GERAÇÃO DE PDF COM FILTRO ---
  const gerarRelatorioPDF = async (dataInicio: string, dataFim: string) => {
    setIsModalRelatorioOpen(false);
    const listaFiltrada = filtrarContratosPorPeriodo(contratosFiltrados, dataInicio, dataFim);
    const { jsPDF, autoTable } = await carregarJsPDF();
    const docPdf = new jsPDF('landscape');

    const gerarTabela = () => {
      docPdf.setFontSize(16); docPdf.setTextColor(0, 74, 153);
      docPdf.text(orgaoLogado ? NOMES_ORGAOS[orgaoLogado] : 'Relatório de Contratos', 45, 20);
      docPdf.setFontSize(11); docPdf.setTextColor(100, 100, 100);
      
      let textoFiltro = termoBusca ? ` (Filtro: "${termoBusca}")` : '';
      if (dataInicio || dataFim) {
        const strInicio = dataInicio ? formatarDataBr(dataInicio) : 'Início';
        const strFim = dataFim ? formatarDataBr(dataFim) : 'Fim';
        textoFiltro += ` [Vencimentos de ${strInicio} a ${strFim}]`;
      }

      docPdf.text(`Listagem de Contratos${textoFiltro} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 45, 28);
      
      const headRow = ['Nº Contrato', 'Objeto', 'Fornecedor', 'CPF/CNPJ', 'Validade', 'Valor Global\n/ Aditivo', 'Fiscal'];
      const tableData: RowInput[] = [];

      listaFiltrada.forEach(c => {
        const vTotal = Number(c.valorTotal) || 0;
        tableData.push([
          c.numeroContrato || '-',
          c.objetoCompleto || c.objetoResumido || '-',
          c.fornecedor || '-',
          c.cnpjFornecedor || 'Não inf.',
          formatarDataBr(c.dataFim),
          vTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          c.fiscalContrato || '-'
        ]);

        if (opcIncluirAditivos && c.aditivos && c.aditivos.length > 0) {
          c.aditivos.forEach(ad => {
            const strValidade = ad.novaDataFim ? formatarDataBr(ad.novaDataFim) : '-';
            const strValor = ad.valorAditivado ? ad.valorAditivado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';
            const estiloAditivo: Partial<Styles> = { fillColor: [248, 250, 252], textColor: [100, 100, 100], fontStyle: 'italic' };

            tableData.push([
              { content: '+ ADITIVO', styles: { ...estiloAditivo, fontStyle: 'bold', halign: 'center' } },
              { content: `${ad.descricao}\n(Tipo: ${ad.tipo.toUpperCase()})`, colSpan: 3, styles: { ...estiloAditivo, halign: 'left' } },
              { content: `Assinado:\n${formatarDataBr(ad.dataAditivo)}\n\nNova Valid:\n${strValidade}`, styles: { ...estiloAditivo, halign: 'center' } },
              { content: strValor, styles: { ...estiloAditivo, halign: 'right', fontStyle: 'bold' } },
              { content: '-', styles: { ...estiloAditivo, halign: 'center' } }
            ]);
          });
        }
      });

      const colStyles: Record<number, Partial<Styles>> = {
        0: { halign: 'center', cellWidth: 30 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40 },
        3: { halign: 'center', cellWidth: 26 }, 4: { halign: 'center', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 32 },  6: { halign: 'center', cellWidth: 24 }
      };

      autoTable(docPdf, {
        startY: 40, head: [headRow], body: tableData, theme: 'striped',
        headStyles: { fillColor: [0, 74, 153] }, styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: colStyles
      });

      const pdfBlob = docPdf.output('blob');
      window.open(URL.createObjectURL(pdfBlob), '_blank');
    };

    const img = new Image(); img.src = logo;
    img.onload = () => { docPdf.addImage(img, 'PNG', 14, 10, 25, 25); gerarTabela(); };
    img.onerror = () => { gerarTabela(); };
  };

  const abrirEdicao = (c: Contrato) => {
    setContratoParaEditar(c);
    setIsModalEditOpen(true);
  };

  const lidarComSaida = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      toast.error('Erro ao encerrar sessão. Tente novamente.');
      return;
    }
    // Limpa o cache persistente do Firestore (IndexedDB) no logout — sem
    // isso, num computador compartilhado o próximo usuário recuperava os
    // contratos do usuário anterior direto do IndexedDB, sem precisar de
    // senha (achado A9 da auditoria). `clearIndexedDbPersistence` exige
    // que a instância não tenha operações em andamento, por isso
    // `terminate(db)` primeiro; como isso invalida `db` pelo resto desta
    // aba, um reload completo (não navegação client-side) é necessário
    // para reinicializar o Firestore do zero.
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (error) {
      // Falha esperada se houver outra aba do sistema aberta na mesma
      // origem: `firebase.ts` usa `persistentMultipleTabManager`, que
      // compartilha o IndexedDB entre abas — `clearIndexedDbPersistence`
      // rejeita enquanto outra conexão o mantém aberto (comportamento
      // documentado da própria API de IndexedDB, não específico deste
      // código). Não bloqueia o logout, mas avisa o usuário em vez de
      // falhar em silêncio: sem o aviso, a limpeza — que é justamente a
      // mitigação do achado A9 — poderia não acontecer sem nenhum indício
      // visível. Não testado com múltiplas abas reais nesta sessão (ver
      // docs/PLANO.md, achado do revisor-pmp na Fase 6).
      console.error('Erro ao limpar o cache local do Firestore:', error);
      toast.error('Sessão encerrada, mas não foi possível limpar todos os dados locais deste navegador. Feche todas as abas do sistema para concluir a limpeza.', { duration: 8000 });
    }
    window.location.href = '/';
  };

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <img src={logo} alt="Logo PMP" className="logo-pequena" />
          <h2 title={orgaoLogado ? NOMES_ORGAOS[orgaoLogado] : ''}>{orgaoLogado ? NOMES_ORGAOS[orgaoLogado] : 'Carregando...'}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '12px', color: isAdmin ? '#28a745' : '#64748b', fontWeight: 'bold', backgroundColor: 'white', padding: '5px 10px', borderRadius: '4px' }}>
            {isAdmin ? '🛡️ Admin' : '👁️ Visualizador'}
          </span>
          <button className="btn-sair" onClick={lidarComSaida}>
            Sair
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </header>

      <main className="conteudo">
        <div className="acoes-topo" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px' }}>
          <h2 style={{ margin: 0, whiteSpace: 'nowrap' }}>Contratos Cadastrados</h2>
          
          <div style={{ position: 'relative', flex: '1 1 300px', minWidth: '250px' }}>
            <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Buscar por Nº, CNPJ, Fornecedor, Objeto ou Fiscal..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setIsModalRelatorioOpen(true)} className="btn-cancelar" style={{ backgroundColor: 'white' }}>📤 Exportar Relatório</button>
            
            {isAdmin && (
              <button onClick={() => setIsModalUsuariosOpen(true)} style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                👥 Usuários
              </button>
            )}

            {isAdmin && <button onClick={() => setIsModalOpen(true)} className="btn-salvar">Novo Contrato</button>}
          </div>
        </div>
        <TabelaContratos
          contratosFiltrados={contratosFiltrados}
          loading={loading}
          isAdmin={isAdmin}
          termoBusca={termoBusca}
          ordenacao={ordenacao}
          lidarComOrdenacao={lidarComOrdenacao}
          onDetalhes={(id) => navigate(`/contrato/${id}`)}
          onEditar={abrirEdicao}
          onExcluir={excluirContrato}
          temMais={temMais}
          carregarMaisContratos={carregarMaisContratos}
        />
      </main>

      {isAdmin && isModalOpen && <ModalNovoContrato onClose={() => setIsModalOpen(false)} orgaoLogado={orgaoLogado} />}
      {isAdmin && isModalEditOpen && contratoParaEditar && <ModalEditarContrato onClose={() => setIsModalEditOpen(false)} contratoOriginal={contratoParaEditar} />}
      
      {isAdmin && <ModalGerenciarUsuarios isOpen={isModalUsuariosOpen} onClose={() => setIsModalUsuariosOpen(false)} />}
      
      <ModalRelatorioGlobal 
        isOpen={isModalRelatorioOpen} onClose={() => setIsModalRelatorioOpen(false)}
        opcIncluirAditivos={opcIncluirAditivos} setOpcIncluirAditivos={setOpcIncluirAditivos}
        gerarRelatorioPDF={gerarRelatorioPDF}
        gerarRelatorioExcel={exportarParaExcel}
      />
    </div>
  );
}