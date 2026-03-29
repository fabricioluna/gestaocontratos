// src/components/DetalhesContrato/ModalLancarConsumo.tsx
import React, { useState, useRef } from 'react';
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
  const [formItem, setFormItem] = useState({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });

  if (!isOpen) return null;

  const lidarComMudancaItem = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormItem((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const adicionarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const qtd = parseMoeda(formItem.quantidade);
      const vUnit = parseMoeda(formItem.valorUnitario);
      if (!formItem.discriminacao || qtd <= 0 || vUnit <= 0) { alert("Preencha corretamente os valores."); setLoading(false); return; }
      const valorTotalItem = qtd * vUnit;
      const dataAtual = new Date().toLocaleString('pt-BR');

      await addDoc(collection(db, 'itens'), {
        ...formItem, contratoId: contratoId, quantidade: qtd, valorUnitario: vUnit,
        valorTotalItem: valorTotalItem, dataAdicao: dataAtual, tipoRegistro: 'consumo'
      });

      await updateDoc(doc(db, 'contratos', contratoId), {
        saldoContrato: saldoContrato - valorTotalItem, dataUltimaAtualizacao: dataAtual
      });

      alert('Consumo registrado e saldo reduzido com sucesso!');
      setFormItem({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });
      onClose();
    } catch (error) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  const importarPlanilha = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const numeroLote = String(linha['LOTE'] || 'Único'); 
          const numeroItem = String(linha['ITEM'] || '');
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || '');
          const unidade = String(linha['UNIDADE'] || linha['UND.'] || linha['UND'] || '');
          const quantidade = extrairNumeroPlanilha(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = extrairNumeroPlanilha(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND'] || linha['VL. UNIT.'] || linha['VL. UNIT'] || linha['VL UNIT.']) || 0;
          const valorTotalItem = quantidade * valorUnitario;

          if (discriminacao && quantidade > 0) {
            const itemRef = doc(collection(db, 'itens')); 
            batch.set(itemRef, {
              contratoId: contratoId, numeroLote, numeroItem, discriminacao, unidade,
              quantidade, valorUnitario, valorTotalItem, dataAdicao: dataAtual, tipoRegistro: 'consumo'
            });
            valorTotalConsumidoLoop += valorTotalItem;
            itensValidos++;
          }
        });

        if (itensValidos > 0) {
          await batch.update(doc(db, 'contratos', contratoId), {
            saldoContrato: saldoContrato - valorTotalConsumidoLoop, dataUltimaAtualizacao: dataAtual
          });
          await batch.commit();
          alert(`${itensValidos} itens processados! Saldo reduzido em ${valorTotalConsumidoLoop.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
          onClose();
        } else { alert('Nenhum item válido encontrado.'); }
      } catch (error) { alert("Erro ao ler Excel."); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <h2>Lançar Novo Consumo (Empenho)</h2>
        <div style={{ margin: '20px 0', textAlign: 'center' }}>
          <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={importarPlanilha} style={{ display: 'none' }} id="upload-excel-detalhes" />
          <label htmlFor="upload-excel-detalhes" style={{ backgroundColor: '#28a745', color: 'white', padding: '15px 30px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' }}>📄 Importar Planilha de Consumo</label>
          <div style={{ margin: '15px 0', fontWeight: 'bold', color: '#666' }}>OU LANÇAMENTO MANUAL ABAIXO:</div>
        </div>
        
        <form onSubmit={adicionarItem}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr', gap: '5px' }}>
            <div className="form-group"><input type="text" name="numeroLote" placeholder="Lote" value={formItem.numeroLote} onChange={lidarComMudancaItem} /></div>
            <div className="form-group"><input type="text" name="numeroItem" placeholder="Nº Item" value={formItem.numeroItem} onChange={lidarComMudancaItem} required /></div>
            <div className="form-group"><input type="text" name="discriminacao" placeholder="Descrição/Objeto" value={formItem.discriminacao} onChange={lidarComMudancaItem} required /></div>
            <div className="form-group"><input type="text" name="quantidade" placeholder="Qtd" value={formItem.quantidade} onChange={lidarComMudancaItem} required /></div>
            <div className="form-group"><input type="text" name="valorUnitario" placeholder="R$ Unit" value={formItem.valorUnitario} onChange={lidarComMudancaItem} required /></div>
            <button type="submit" style={{ backgroundColor: '#004a99', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={loading}>+ Consumir</button>
          </div>
        </form>
        <div className="modal-acoes"><button type="button" className="btn-cancelar" onClick={onClose}>Fechar</button></div>
      </div>
    </div>
  );
}