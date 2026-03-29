// src/components/Painel/ModalEditarContrato.tsx
import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { parseMoeda } from '../../utils/formatters';
import type { Contrato } from '../../types';

interface ModalEditarContratoProps {
  isOpen: boolean;
  onClose: () => void;
  contratoOriginal: Contrato | null;
}

export default function ModalEditarContrato({ isOpen, onClose, contratoOriginal }: ModalEditarContratoProps) {
  const [formEdit, setFormEdit] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && contratoOriginal) {
      setFormEdit({ 
        ...contratoOriginal, 
        valorTotal: contratoOriginal.valorTotal.toFixed(2).replace('.', ','),
        modalidade: contratoOriginal.modalidade || '',
        numeroModalidade: contratoOriginal.numeroModalidade || contratoOriginal.numeroPregao || ''
      });
    }
  }, [isOpen, contratoOriginal]);

  if (!isOpen || !contratoOriginal) return null;

  const lidarComMudancaEdit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormEdit((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const formatarTresDigitosEdit = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value && /^\d+$/.test(value)) {
      setFormEdit((prev: any) => ({ ...prev, [name]: value.padStart(3, '0') }));
    }
  };

  const salvarEdicaoContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const novoValorGlobal = parseMoeda(formEdit.valorTotal);
      const valorJaConsumido = contratoOriginal.valorTotal - contratoOriginal.saldoContrato;
      const novoSaldo = novoValorGlobal - valorJaConsumido;

      await updateDoc(doc(db, 'contratos', contratoOriginal.id!), {
        ...formEdit, 
        valorTotal: novoValorGlobal, 
        saldoContrato: novoSaldo, 
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      alert('Contrato atualizado com sucesso!');
      onClose();
    } catch (error) { 
      alert("Erro ao editar contrato."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Editar Dados do Contrato</h2>
        <form onSubmit={salvarEdicaoContrato}>
          <div className="form-grid">
            <div className="form-group"><label>Nº do Contrato</label><input type="text" name="numeroContrato" required value={formEdit.numeroContrato || ''} onChange={lidarComMudancaEdit} onBlur={formatarTresDigitosEdit} /></div>
            <div className="form-group"><label>Nº/Ano Processo</label><input type="text" name="numeroProcesso" required value={formEdit.numeroProcesso || ''} onChange={lidarComMudancaEdit} placeholder="000/0000" /></div>
            <div className="form-group">
              <label>Modalidade</label>
              <select name="modalidade" value={formEdit.modalidade || ''} onChange={lidarComMudancaEdit} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', height: '36px' }}>
                <option value="">Selecione...</option>
                <option value="Pregão">Pregão</option>
                <option value="Concorrência">Concorrência</option>
                <option value="Dispensa">Dispensa</option>
                <option value="Inexigibilidade">Inexigibilidade</option>
                <option value="Credenciamento">Credenciamento</option>
              </select>
            </div>
            <div className="form-group"><label>Nº/Ano Modalidade</label><input type="text" name="numeroModalidade" value={formEdit.numeroModalidade || ''} onChange={lidarComMudancaEdit} placeholder="000/0000" /></div>
            <div className="form-group"><label>Nº/Ano da Ata</label><input type="text" name="numeroAta" value={formEdit.numeroAta || ''} onChange={lidarComMudancaEdit} placeholder="000/0000" /></div>
            <div className="form-group full-width"><label>Fornecedor</label><input type="text" name="fornecedor" required value={formEdit.fornecedor || ''} onChange={lidarComMudancaEdit} /></div>
            <div className="form-group full-width"><label>Objeto Resumido</label><input type="text" name="objetoResumido" required value={formEdit.objetoResumido || ''} onChange={lidarComMudancaEdit} /></div>
            <div className="form-group full-width"><label>Objeto Completo</label><textarea name="objetoCompleto" rows={2} value={formEdit.objetoCompleto || ''} onChange={lidarComMudancaEdit}></textarea></div>
            <div className="form-group"><label>Data Início</label><input type="date" name="dataInicio" required value={formEdit.dataInicio || ''} onChange={lidarComMudancaEdit} /></div>
            <div className="form-group"><label>Data Fim (Validade)</label><input type="date" name="dataFim" required value={formEdit.dataFim || ''} onChange={lidarComMudancaEdit} /></div>
            <div className="form-group"><label>Fiscal do Contrato</label><input type="text" name="fiscalContrato" value={formEdit.fiscalContrato || ''} onChange={lidarComMudancaEdit} /></div>
            <div className="form-group"><label>Observação</label><input type="text" name="observacao" value={formEdit.observacao || ''} onChange={lidarComMudancaEdit} /></div>
            <div className="form-group full-width"><label>Valor Global (R$)</label><input type="text" name="valorTotal" required value={formEdit.valorTotal || ''} onChange={lidarComMudancaEdit} style={{ border: '2px solid #ffc107', fontWeight: 'bold' }} /></div>
          </div>
          <div className="modal-acoes">
            <button type="button" className="btn-cancelar" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-salvar" disabled={loading} style={{ backgroundColor: '#ffc107', color: '#333' }}>{loading ? 'A Guardar...' : 'Salvar Alterações'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}