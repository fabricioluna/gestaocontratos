// src/components/DetalhesContrato/ModalLancarConsumo.tsx
import { useState, useRef } from 'react';
import { collection, addDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../../firebase';
import { parseMoeda, extrairNumeroPlanilha } from '../../utils/formatters';

interface ModalLancarConsumoProps {
  isOpen: boolean;
  onClose: () => void;
  contratoId: string;
  saldoContrato: number;
}

export default function ModalLancarConsumo({ isOpen, onClose, contratoId, saldoContrato }: ModalLancarConsumoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [formItem, setFormItem] = useState({ 
    numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' 
  });

  if (!isOpen) return null;

  const lidarComMudancaItem = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Lançamento Manual
  const adicionarItemManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const qtd = parseMoeda(formItem.quantidade);
      const vUnit = parseMoeda(formItem.valorUnitario);
      
      if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) {
        alert("Preencha corretamente os valores.");
        setLoading(false);
        return;
      }

      const valorTotalItem = qtd * vUnit;
      const dataAtual = new Date().toLocaleString('pt-BR');

      // Grava o item de consumo
      await addDoc(collection(db, 'itens'), {
        ...formItem,
        contratoId,
        quantidade: qtd,
        valorUnitario: vUnit,
        valorTotalItem,
        dataAdicao: dataAtual,
        tipoRegistro: 'consumo'
      });

      // Atualiza o saldo global do contrato
      const contratoRef = doc(db, 'contratos', contratoId);
      await updateDoc(contratoRef, {
        saldoContrato: saldoContrato - valorTotalItem,
        dataUltimaAtualizacao: dataAtual
      });

      alert('Consumo registado com sucesso!');
      setFormItem({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });
      onClose();
    } catch (error) {
      alert("Erro ao salvar lançamento.");
    } finally {
      setLoading(false);
    }
  };

  // Importação via Excel
  const importarPlanilhaConsumo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        const batch = writeBatch(db);
        let valorTotalConsumidoLoop = 0;
        const dataAtual = new Date().toLocaleString('pt-BR');
        let itensValidos = 0;

        data.forEach((row: any) => {
          const linha: any = {};
          for (const key in row) linha[key.trim().toUpperCase()] = row[key];
          
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || '');
          const quantidade = extrairNumeroPlanilha(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = extrairNumeroPlanilha(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND'] || linha['VL. UNIT.'] || linha['VL. UNIT'] || linha['VL UNIT.']) || 0;
          const valorTotalItem = quantidade * valorUnitario;

          if (discriminacao && quantidade > 0) {
            const itemRef = doc(collection(db, 'itens'));
            batch.set(itemRef, {
              contratoId,
              numeroLote: String(linha['LOTE'] || 'Único'),
              numeroItem: String(linha['ITEM'] || ''),
              discriminacao,
              unidade: String(linha['UNIDADE'] || linha['UND.'] || linha['UND'] || ''),
              quantidade,
              valorUnitario,
              valorTotalItem,
              dataAdicao: dataAtual,
              tipoRegistro: 'consumo'
            });
            valorTotalConsumidoLoop += valorTotalItem;
            itensValidos++;
          }
        });

        if (itensValidos > 0) {
          batch.update(doc(db, 'contratos', contratoId), {
            saldoContrato: saldoContrato - valorTotalConsumidoLoop,
            dataUltimaAtualizacao: dataAtual
          });
          await batch.commit();
          alert(`${itensValidos} itens de consumo processados com sucesso!`);
          onClose();
        } else {
          alert('Nenhum item válido encontrado na folha de cálculo.');
        }
      } catch (error) {
        alert("Erro ao ler folha de cálculo.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px' }}>
        <h2>Lançar Novo Consumo (Empenho)</h2>
        
        <div style={{ margin: '20px 0', textAlign: 'center' }}>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            ref={fileInputRef} 
            onChange={importarPlanilhaConsumo} 
            style={{ display: 'none' }} 
            id="upload-excel-detalhes" 
          />
          <label htmlFor="upload-excel-detalhes" style={{ backgroundColor: '#28a745', color: 'white', padding: '15px 30px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' }}>
            📄 Importar Folha de Consumo (Excel)
          </label>
          <div style={{ margin: '15px 0', fontWeight: 'bold', color: '#666' }}>OU LANÇAMENTO MANUAL:</div>
        </div>

        <form onSubmit={adicionarItemManual}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}>
            <input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={lidarComMudancaItem} />
            <input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={lidarComMudancaItem} required />
            <input type="text" name="discriminacao" placeholder="Descrição" value={formItem.discriminacao} onChange={lidarComMudancaItem} required />
            <input type="text" name="quantidade" placeholder="Qtd" value={formItem.quantidade} onChange={lidarComMudancaItem} required />
            <input type="text" name="valorUnitario" placeholder="R$ Unit" value={formItem.valorUnitario} onChange={lidarComMudancaItem} required />
            <button type="submit" style={{ backgroundColor: '#004a99', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={loading}>
              {loading ? '...' : '+ Consumir'}
            </button>
          </div>
        </form>

        <div className="modal-acoes">
          <button className="btn-cancelar" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}