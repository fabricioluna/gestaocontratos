// src/components/Painel/ModalEditarContrato.tsx
import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { parseMoeda } from '../../utils/formatters';
import type { Contrato, FormContratoState } from '../../types/types';

interface ModalEditarContratoProps {
  isOpen: boolean;
  onClose: () => void;
  contratoOriginal: Contrato | null;
}

export default function ModalEditarContrato({ isOpen, onClose, contratoOriginal }: ModalEditarContratoProps) {
  const [formEdit, setFormEdit] = useState<Partial<FormContratoState>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && contratoOriginal) {
      setFormEdit({ 
        ...contratoOriginal, 
        valorTotal: contratoOriginal.valorTotal.toFixed(2).replace('.', ','),
        modalidade: contratoOriginal.modalidade || '',
        numeroModalidade: contratoOriginal.numeroModalidade || contratoOriginal.numeroPregao || '',
        cnpjFornecedor: contratoOriginal.cnpjFornecedor || '',
        emailSecretaria: contratoOriginal.emailSecretaria || ''
      });
    }
  }, [isOpen, contratoOriginal]);

  if (!isOpen || !contratoOriginal) return null;

  const lidarComMudancaEdit = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormEdit(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const formatarTresDigitosEdit = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value && /^\d+$/.test(value)) {
      setFormEdit(prev => ({ ...prev, [name]: value.padStart(3, '0') }));
    }
  };

  const formatarCNPJEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, '');
    if (valor.length > 14) valor = valor.slice(0, 14);
    valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
    valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
    valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
    setFormEdit(prev => ({ ...prev, cnpjFornecedor: valor }));
  };

  const salvarEdicaoContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading('A guardar alterações...');
    
    try {
      const novoValorGlobal = parseMoeda(formEdit.valorTotal || '0');

      // Removida a lógica de Saldo. Apenas guardamos os dados e o novo valor.
      await updateDoc(doc(db, 'contratos', contratoOriginal.id!), {
        ...formEdit, 
        valorTotal: novoValorGlobal, 
        dataUltimaAtualizacao: new Date().toLocaleString('pt-BR')
      });
      toast.success('Contrato atualizado com sucesso!', { id: toastId });
      onClose();
    } catch (error) { 
      toast.error("Erro ao editar contrato.", { id: toastId }); 
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
            <div className="form-group"><label>Nº/Ano Processo</label><input type="text" name="numeroProcesso" value={formEdit.numeroProcesso || ''} onChange={lidarComMudancaEdit} placeholder="000/0000" /></div>
            
            <div className="form-group">
              <label>Modalidade</label>
              <select name="modalidade" value={formEdit.modalidade || ''} onChange={lidarComMudancaEdit} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', height: '36px' }}>
                <option value="">Selecione...</option>
                <option value="Pregão">Pregão</option>
                <option value="Concorrência">Concorrência</option>
                <option value="Dispensa">Dispensa</option>
                <option value="Inexigibilidade">Inexigibilidade</option>
                <option value="Credenciamento">Credenciamento</option>
                <option value="Contratação Direta">Contratação Direta</option>
              </select>
            </div>
            
            <div className="form-group"><label>Nº/Ano Modalidade</label><input type="text" name="numeroModalidade" value={formEdit.numeroModalidade || ''} onChange={lidarComMudancaEdit} placeholder="000/0000" /></div>
            <div className="form-group"><label>Nº/Ano da Ata</label><input type="text" name="numeroAta" value={formEdit.numeroAta || ''} onChange={lidarComMudancaEdit} placeholder="000/0000" /></div>
            
            {/* NOVOS CAMPOS */}
            <div className="form-group"><label>CNPJ do Fornecedor</label><input type="text" name="cnpjFornecedor" value={formEdit.cnpjFornecedor || ''} onChange={formatarCNPJEdit} placeholder="00.000.000/0000-00" maxLength={18} /></div>
            <div className="form-group"><label>Fornecedor</label><input type="text" name="fornecedor" required value={formEdit.fornecedor || ''} onChange={lidarComMudancaEdit} /></div>
            <div className="form-group full-width"><label>E-mail da Secretaria</label><input type="email" name="emailSecretaria" value={formEdit.emailSecretaria || ''} onChange={lidarComMudancaEdit} placeholder="exemplo@pesqueira.pe.gov.br" /></div>
            
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