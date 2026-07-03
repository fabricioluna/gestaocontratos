// src/components/DetalhesContrato/ModalEmitirOS.tsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logopmp.png';
import type { Contrato, Item } from '../../types/types';

interface ModalEmitirOSProps {
  isOpen: boolean;
  onClose: () => void;
  contrato: Contrato | null;
  itensCatalogo: Item[];
}

export default function ModalEmitirOS({ isOpen, onClose, contrato, itensCatalogo }: ModalEmitirOSProps) {
  // Estados da Tabela e do Documento
  const [quantidadesPedidas, setQuantidadesPedidas] = useState<{ [id: string]: number | '' }>({});
  const [tipoDocumento, setTipoDocumento] = useState<'Ordem de Serviço' | 'Solicitação de Compra'>('Ordem de Serviço');
  const [localData, setLocalData] = useState('');

  // Estados do Formulário
  const [orgao, setOrgao] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [nomeSolicitante, setNomeSolicitante] = useState('');
  const [documentoSolicitante, setDocumentoSolicitante] = useState('');
  const [cargoSolicitante, setCargoSolicitante] = useState('');

  // Data dinâmica formatada nativamente em português (Pesqueira-PE, 03 de julho de 2026)
  useEffect(() => {
    if (isOpen) {
      const hoje = new Date();
      const formatador = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      setLocalData(`Pesqueira-PE, ${formatador.format(hoje)}`);
    }
  }, [isOpen]);

  if (!isOpen || !contrato) return null;

  // Dicionário Oficial de Qualificações
  const orgaosQualificacao: Record<string, { nome: string, cnpj: string }> = {
    'prefeitura': { nome: 'Prefeitura Municipal de Pesqueira', cnpj: '10.264.406/0001-35' },
    'fme': { nome: 'Fundo Municipal de Educação', cnpj: '06.074.663/0001-37' },
    'fmas': { nome: 'Fundo Municipal de Assistência Social', cnpj: '12.200.692/0001-09' },
    'fms': { nome: 'Fundo Municipal de Saúde', cnpj: '10.488.181/0001-09' }
  };

  const lidarComMudancaQtd = (itemId: string, valorStr: string) => {
    if (valorStr === '') {
      setQuantidadesPedidas(prev => ({ ...prev, [itemId]: '' }));
      return;
    }
    let valor = Number(valorStr);
    if (isNaN(valor) || valor < 0) valor = 0;
    setQuantidadesPedidas(prev => ({ ...prev, [itemId]: valor }));
  };

  const calcularTotalPedido = () => {
    let total = 0;
    itensCatalogo.forEach(item => {
      const pedida = Number(quantidadesPedidas[item.id!] || 0);
      total += pedida * item.valorUnitario;
    });
    return total;
  };

  const formatarDoc = (valor: string) => {
    return valor.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const gerarDocumentoPDF = () => {
    const itensParaPedir = itensCatalogo.filter(item => Number(quantidadesPedidas[item.id!] || 0) > 0);

    if (itensParaPedir.length === 0) {
      toast.error("Preencha a quantidade de pelo menos 1 item para gerar o documento.");
      return;
    }

    if (!orgao || !nomeSolicitante || !cargoSolicitante || !justificativa) {
      toast.error("Por favor, preencha o Órgão, Justificativa e os Dados do Assinante.");
      return;
    }

    const docPdf = new jsPDF('portrait');

    const construirPDF = () => {
      const qualificador = contrato.orgaoId && orgaosQualificacao[contrato.orgaoId] 
        ? orgaosQualificacao[contrato.orgaoId] 
        : orgaosQualificacao['prefeitura'];

      // --- Cabeçalho Timbrado ---
      docPdf.setFontSize(14);
      docPdf.setTextColor(0, 74, 153);
      docPdf.setFont("helvetica", "bold");
      docPdf.text(qualificador.nome.toUpperCase(), 105, 20, { align: 'center' });
      
      docPdf.setFontSize(10);
      docPdf.setTextColor(100, 100, 100);
      docPdf.setFont("helvetica", "normal");
      docPdf.text(`CNPJ: ${qualificador.cnpj}`, 105, 26, { align: 'center' });
      
      docPdf.setFontSize(16);
      docPdf.setTextColor(0, 0, 0);
      docPdf.setFont("helvetica", "bold");
      docPdf.text(tipoDocumento.toUpperCase(), 105, 42, { align: 'center' });

      // --- Dados Básicos ---
      let currentY = 52;
      docPdf.setFontSize(10);

      const adicionarCampo = (titulo: string, valor: string, offset: number) => {
        docPdf.setFont("helvetica", "bold"); 
        docPdf.text(titulo, 14, currentY);
        docPdf.setFont("helvetica", "normal"); 
        const linhas = docPdf.splitTextToSize(valor || 'Não informado', 190 - offset);
        docPdf.text(linhas, offset, currentY);
        currentY += (linhas.length * 5) + 1;
      };

      adicionarCampo("Contrato Nº:", contrato.numeroContrato || 'N/I', 38);
      adicionarCampo("Fornecedor:", contrato.fornecedor || 'N/I', 38);
      adicionarCampo("CNPJ:", contrato.cnpjFornecedor || 'Não informado', 26);
      adicionarCampo("Órgão:", orgao, 28);
      adicionarCampo("Objeto:", contrato.objetoResumido || 'N/I', 28);
      adicionarCampo("Justificativa:", justificativa, 38);

      // --- Construção da Tabela com Blindagem de Tipos (TypeScript fix) ---
      const exibirLote = itensParaPedir.some(i => i.numeroLote && i.numeroLote !== 'Único' && i.numeroLote !== '-');
      const tituloPrimeiraColuna = exibirLote ? 'Lote / Item' : 'Item';

      const headRow = [tituloPrimeiraColuna, 'Descrição', 'Unid.', 'Qtd. Pedida', 'V. Unitário', 'V. Total'];
      
      // Mapeamento garantindo que retornamos um Array de Strings (solução do erro TypeScript)
      const tableData: string[][] = itensParaPedir.map(item => {
        const qtd = Number(quantidadesPedidas[item.id!] || 0);
        const total = qtd * item.valorUnitario;
        
        const numeroExibicao = exibirLote 
          ? `${item.numeroLote || '-'}/${item.numeroItem || '-'}` 
          : String(item.numeroItem || '-');

        return [
          numeroExibicao,
          String(item.discriminacao || '-'),
          String(item.unidade || 'UND'),
          String(qtd),
          item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ];
      });

      autoTable(docPdf, {
        startY: currentY + 3,
        head: [headRow],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 74, 153], halign: 'center' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 'wrap' }, 
          1: { cellWidth: 'auto' },
          2: { halign: 'center', cellWidth: 'wrap' },
          3: { halign: 'center', cellWidth: 'wrap' },
          4: { halign: 'right', cellWidth: 'wrap' },
          5: { halign: 'right', cellWidth: 'wrap' },
        }
      });

      // --- Rodapé ---
      const finalY = (docPdf as any).lastAutoTable.finalY || currentY;
      const valorTotalPedido = calcularTotalPedido();

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(11);
      docPdf.text(`VALOR TOTAL DO PEDIDO: ${valorTotalPedido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 196, finalY + 10, { align: 'right' });

      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(10);
      docPdf.text(localData, 105, finalY + 30, { align: 'center' });

      // Assinatura
      docPdf.line(60, finalY + 60, 150, finalY + 60); 
      docPdf.setFont("helvetica", "bold");
      docPdf.text(nomeSolicitante.toUpperCase(), 105, finalY + 65, { align: 'center' });
      docPdf.setFont("helvetica", "normal");
      
      const docStr = documentoSolicitante ? ` - CPF: ${documentoSolicitante}` : '';
      docPdf.text(`${cargoSolicitante}${docStr}`, 105, finalY + 70, { align: 'center' });

      window.open(URL.createObjectURL(docPdf.output('blob')), '_blank');
      setQuantidadesPedidas({});
      onClose(); 
    };

    const img = new Image();
    img.src = logo;
    img.onload = () => { docPdf.addImage(img, 'PNG', 14, 10, 25, 25); construirPDF(); };
    img.onerror = () => { construirPDF(); };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '950px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', padding: '25px' }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, color: '#0f172a' }}>📝 Emitir Documento de Pedido</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
          
          {/* BLOCO 1: DADOS DO SOLICITANTE E DO DOCUMENTO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#334155', fontSize: '13px' }}>1. TIPO DE DOCUMENTO</label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input type="radio" checked={tipoDocumento === 'Ordem de Serviço'} onChange={() => setTipoDocumento('Ordem de Serviço')} /> Ordem de Serviço (O.S.)
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input type="radio" checked={tipoDocumento === 'Solicitação de Compra'} onChange={() => setTipoDocumento('Solicitação de Compra')} /> Solicitação de Compra
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#334155', fontSize: '13px' }}>Órgão Solicitante / Setor:</label>
              <input type="text" value={orgao} onChange={e => setOrgao(e.target.value)} placeholder="Ex: Setor de Compras da Saúde" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
            
            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#334155', fontSize: '13px' }}>Local e Data (Rodapé do PDF):</label>
              <input type="text" value={localData} onChange={e => setLocalData(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#334155', fontSize: '13px' }}>Justificativa Detalhada da Solicitação:</label>
              <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={3} placeholder="Descreva pormenorizadamente a motivação e finalidade deste pedido." style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', resize: 'vertical' }}></textarea>
            </div>

            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #cbd5e1', marginTop: '5px', paddingTop: '15px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#334155', fontSize: '13px' }}>2. DADOS DO ASSINANTE (RODAPÉ)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nome Completo</label>
                  <input type="text" value={nomeSolicitante} onChange={e => setNomeSolicitante(e.target.value)} placeholder="João da Silva" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Cargo / Função</label>
                  <input type="text" value={cargoSolicitante} onChange={e => setCargoSolicitante(e.target.value)} placeholder="Secretário Municipal" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>CPF (Opcional)</label>
                  <input type="text" value={documentoSolicitante} onChange={e => setDocumentoSolicitante(formatarDoc(e.target.value))} placeholder="000.000.000-00" maxLength={14} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 2: TABELA DE ITENS */}
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#334155', fontSize: '13px' }}>3. SELECIONAR PRODUTOS / SERVIÇOS</label>
          <table className="tabela-contratos" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>Item</th>
                <th>Descrição</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Unid.</th>
                <th style={{ textAlign: 'center' }}>Qtd. Contrato</th>
                <th style={{ textAlign: 'center' }}>Valor Unitário</th>
                <th style={{ textAlign: 'center', width: '140px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>Qtd. Pedir Agora</th>
              </tr>
            </thead>
            <tbody>
              {itensCatalogo.map(item => {
                const pedida = quantidadesPedidas[item.id!] ?? '';
                const numeroExibicao = (item.numeroLote && item.numeroLote !== 'Único' && item.numeroLote !== '-') 
                  ? `${item.numeroLote}/${item.numeroItem}` 
                  : item.numeroItem;

                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 'bold', textAlign: 'center' }}>{numeroExibicao}</td>
                    <td>{item.discriminacao}</td>
                    <td style={{ textAlign: 'center' }}>{item.unidade || 'UND'}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantidade}</td>
                    <td style={{ textAlign: 'center' }}>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ padding: '6px' }}>
                      <input 
                        type="number" 
                        min="0"
                        value={pedida}
                        onChange={(e) => lidarComMudancaQtd(item.id!, e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px', textAlign: 'center', border: '2px solid #0369a1', borderRadius: '4px', fontWeight: 'bold', backgroundColor: pedida ? '#f0fdf4' : 'white' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Valor Total desta Emissão:</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#004a99' }}>
              {calcularTotalPedido().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn-cancelar" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn-salvar" onClick={gerarDocumentoPDF} style={{ backgroundColor: '#10b981', fontSize: '15px', padding: '10px 25px' }}>
              🖨️ Gerar PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}