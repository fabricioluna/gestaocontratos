// src/components/Painel/ModalEditarContrato.tsx
import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { parseMoeda } from '../../utils/formatters';
import type { Contrato } from '../../types';

interface ModalEditarContratoProps {
  isOpen: boolean;
  onClose: () => void;
  contrato: Contrato | null;
}

export default function ModalEditarContrato({ isOpen, onClose, contrato }: ModalEditarContratoProps) {
  const [loading, setLoading] = useState(false);
  const [formEdit, setFormEdit] = useState<any>({});

  // Sincroniza o estado interno do formulário quando o contrato selecionado muda
  useEffect(() => {
    if (contrato) {
      setFormEdit({
        ...contrato,
        valorTotal: contrato.valorTotal.toFixed(2).replace('.', ',')
      });
    }
  }, [contrato]);

  if (!isOpen || !contrato) return null;

  const lidarComMudancaEdit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormEdit((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const formatarTresDigitos = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value && /^\d+$/.test(value)) {
      setFormEdit((prev: any) => ({ ...prev, [name]: value.padStart(3, '0') }));
    }
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const novoValorGlobal = parseMoeda(formEdit.valorTotal);
      const valorJaConsumido = contrato.valorTotal - contrato.saldoContrato;
      const novoSaldo = novoValorGlobal - valorJaConsumido;

      const contratoRef = doc(db, 'contratos', contrato.id!);
      await updateDoc(contratoRef, {
        ...formEdit,
        valorTotal: novoValorGlobal,
        saldoContrato: novoSaldo,
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });

      alert('Contrato atualizado com sucesso!');
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao editar contrato.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Editar Dados do Contrato</h2>
        <form onSubmit={salvarEdicao}>
          <div className="form-grid">
            <div className="form-group">
              <label>Nº do Contrato</label>
              <input type="text" name="numeroContrato" required value={formEdit.numeroContrato || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group">
              <label>Nº do Processo</label>
              <input type="text" name="numeroProcesso" required value={formEdit.numeroProcesso || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group">
              <label>Modalidade</label>
              <select name="modalidade" required value={formEdit.modalidade || ''} onChange={lidarComMudancaEdit} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="">Selecione...</option>
                <option value="Pregão Eletrônico">Pregão Eletrônico</option>
                <option value="Dispensa">Dispensa</option>
                <option value="Concorrência Eletrônica">Concorrência Eletrônica</option>
                <option value="Inexigibilidade">Inexigibilidade</option>
                <option value="Edital">Edital</option>
                <option value="Credenciamento">Credenciamento</option>
                <option value="Chamamento">Chamamento</option>
              </select>
            </div>
            <div className="form-group">
              <label>Nº da Licitação</label>
              <input type="text" name="numeroPregao" value={formEdit.numeroPregao || ''} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} />
            </div>
            <div className="form-group">
              <label>Nº da Ata</label>
              <input type="text" name="numeroAta" value={formEdit.numeroAta || ''} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitos} />
            </div>
            <div className="form-group full-width">
              <label>Fornecedor</label>
              <input type="text" name="fornecedor" required value={formEdit.fornecedor || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group full-width">
              <label>Objeto Resumido</label>
              <input type="text" name="objetoResumido" required value={formEdit.objetoResumido || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group full-width">
              <label>Objeto Completo</label>
              <textarea name="objetoCompleto" rows={2} value={formEdit.objetoCompleto || ''} onChange={lidarComMudancaEdit}></textarea>
            </div>
            <div className="form-group">
              <label>Data Início</label>
              <input type="date" name="dataInicio" required value={formEdit.dataInicio || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group">
              <label>Data Fim (Validade)</label>
              <input type="date" name="dataFim" required value={formEdit.dataFim || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group">
              <label>Fiscal do Contrato</label>
              <input type="text" name="fiscalContrato" value={formEdit.fiscalContrato || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group">
              <label>Observação</label>
              <input type="text" name="observacao" value={formEdit.observacao || ''} onChange={lidarComMudancaEdit} />
            </div>
            <div className="form-group full-width">
              <label>Valor Global (R$)</label>
              <input 
                type="text" 
                name="valorTotal" 
                required 
                value={formEdit.valorTotal || ''} 
                onChange={lidarComMudancaEdit} 
                style={{ border: '2px solid #ffc107', fontWeight: 'bold' }} 
              />
            </div>
          </div>
          <div className="modal-acoes">
            <button type="button" className="btn-cancelar" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-salvar" disabled={loading} style={{ backgroundColor: '#ffc107', color: '#333' }}>
              {loading ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}