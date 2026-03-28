// src/views/DetalhesContrato.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, addDoc, updateDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import type { Contrato, ItemContrato } from '../types';
import './DetalhesContrato.css';

export default function DetalhesContrato() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [itens, setItens] = useState<ItemContrato[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formItem, setFormItem] = useState({
    numeroLote: '', numeroItem: '', discriminacao: '',
    unidade: '', quantidade: '', valorUnitario: ''
  });

  useEffect(() => {
    if (!id) return;
    const unsubContrato = onSnapshot(doc(db, 'contratos', id), (docSnap) => {
      if (docSnap.exists()) setContrato({ id: docSnap.id, ...docSnap.data() } as Contrato);
    });

    const qItens = query(collection(db, 'itens'), where('contratoId', '==', id));
    const unsubItens = onSnapshot(qItens, (querySnapshot) => {
      const lista: ItemContrato[] = [];
      querySnapshot.forEach((d) => lista.push({ id: d.id, ...d.data() } as ItemContrato));
      lista.sort((a, b) => (b.dataAdicao || '').localeCompare(a.dataAdicao || ''));
      setItens(lista);
    });

    return () => { unsubContrato(); unsubItens(); };
  }, [id]);

  const lidarComMudanca = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormItem({ ...formItem, [e.target.name]: e.target.value });
  };

  const adicionarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contrato || !id) return;

    setLoading(true);
    try {
      const qtd = Number(formItem.quantidade);
      const vUnitario = Number(formItem.valorUnitario);
      const valorTotalItem = qtd * vUnitario;
      const dataAtual = new Date().toLocaleString('pt-BR');

      await addDoc(collection(db, 'itens'), {
        ...formItem, contratoId: id, quantidade: qtd, valorUnitario: vUnitario,
        valorTotalItem: valorTotalItem, dataAdicao: dataAtual
      });

      const novoSaldo = contrato.saldoContrato - valorTotalItem;
      await updateDoc(doc(db, 'contratos', id), {
        saldoContrato: novoSaldo, dataUltimaAtualizacao: dataAtual
      });

      alert('Item adicionado e saldo atualizado com sucesso!');
      setFormItem({ numeroLote: '', numeroItem: '', discriminacao: '', unidade: '', quantidade: '', valorUnitario: '' });
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar o item.");
    } finally {
      setLoading(false);
    }
  };

  // FUNÇÃO DE IMPORTAÇÃO ATUALIZADA (Mais flexível e inteligente)
  const importarPlanilha = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contrato || !id) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0]; 
        const ws = wb.Sheets[wsname];
        
        const data = XLSX.utils.sheet_to_json(ws);
        
        const batch = writeBatch(db); 
        let valorTotalReduzido = 0;
        const dataAtual = new Date().toLocaleString('pt-BR');
        let itensValidos = 0;

        data.forEach((row: any) => {
          // 1. Cria um objeto "linha" com as chaves normalizadas (Tudo maiúsculo e sem espaços sobrando)
          const linha: any = {};
          for (const key in row) {
            linha[key.trim().toUpperCase()] = row[key];
          }

          // 2. Busca os valores considerando as várias formas de escrever o cabeçalho
          // Se não houver a coluna lote na planilha, ele define como "Único"
          const numeroLote = String(linha['LOTE'] || 'Único'); 
          const numeroItem = String(linha['ITEM'] || '');
          const discriminacao = String(linha['DESCRIÇÃO'] || linha['DESCRICAO'] || linha['DISCRIMINAÇÃO'] || linha['DISCRIMINACAO'] || '');
          const unidade = String(linha['UNIDADE'] || linha['UND.'] || linha['UND'] || '');
          const quantidade = Number(linha['QUANTIDADE'] || linha['QTD.'] || linha['QTD']) || 0;
          const valorUnitario = Number(linha['VALOR UNITÁRIO'] || linha['VALOR UNITARIO'] || linha['VALOR UND.'] || linha['VALOR UND']) || 0;
          
          const valorTotalItem = quantidade * valorUnitario;

          // 3. Validação: Só processa se tiver pelo menos o Número do Item, a Descrição e Quantidade válida
          if (numeroItem && discriminacao && quantidade > 0) {
            const itemRef = doc(collection(db, 'itens')); 
            batch.set(itemRef, {
              contratoId: id,
              numeroLote,
              numeroItem,
              discriminacao,
              unidade,
              quantidade,
              valorUnitario,
              valorTotalItem,
              dataAdicao: dataAtual
            });
            valorTotalReduzido += valorTotalItem;
            itensValidos++;
          }
        });

        if (itensValidos > 0) {
          const contratoRef = doc(db, 'contratos', id);
          batch.update(contratoRef, {
            saldoContrato: contrato.saldoContrato - valorTotalReduzido,
            dataUltimaAtualizacao: dataAtual
          });

          await batch.commit();
          alert(`${itensValidos} itens importados! Saldo reduzido em ${valorTotalReduzido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
        } else {
          alert('Nenhum item válido encontrado. Verifique se as colunas estão corretas (Item, Descrição, Unidade, Quantidade, Valor Unitário).');
        }

      } catch (error) {
        console.error("Erro na leitura do Excel:", error);
        alert("Erro ao ler o ficheiro Excel.");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    
    reader.readAsBinaryString(file);
  };

  if (!contrato) return <div style={{textAlign: 'center', padding: '50px'}}>A carregar dados...</div>;

  return (
    <div className="painel-container">
      <header className="header">
        <div className="header-logo">
          <h2>Detalhes do Contrato: {contrato.numeroContrato}</h2>
        </div>
        <button className="btn-sair" onClick={() => navigate('/painel')} style={{backgroundColor: '#6c757d'}}>Voltar ao Painel</button>
      </header>

      <main className="detalhes-container">
        
        <div className="card-resumo">
          <div className="linha-resumo">
            <div>
              <h3>{contrato.fornecedor}</h3>
              <p><strong>Objeto:</strong> {contrato.objetoResumido}</p>
              <p><strong>Vigência:</strong> {contrato.dataInicio} até {contrato.dataFim}</p>
              <p><strong>Valor Global:</strong> {contrato.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            
            <div className="saldo-destaque">
              <span style={{ fontSize: '14px', color: '#666', display: 'block' }}>Saldo Disponível</span>
              <span className={contrato.saldoContrato >= 0 ? 'saldo-positivo' : 'saldo-negativo'}>
                {contrato.saldoContrato.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="log-data">Última atualização: {contrato.dataUltimaAtualizacao || 'Sem registro'}</span>
            </div>
          </div>
        </div>

        <div className="secao-itens">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3>Adicionar Item / Empenho</h3>
            
            <div>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                ref={fileInputRef} 
                onChange={importarPlanilha} 
                style={{ display: 'none' }} 
                id="upload-excel"
              />
              <label 
                htmlFor="upload-excel" 
                style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {loading ? 'A processar...' : '📄 Importar Planilha Excel'}
              </label>
            </div>
          </div>
          
          <form className="form-item" onSubmit={adicionarItem}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr' }}>
              <div className="form-group"><label>Lote</label><input type="text" name="numeroLote" value={formItem.numeroLote} onChange={lidarComMudanca} placeholder="Opcional" /></div>
              <div className="form-group"><label>Item</label><input type="text" name="numeroItem" required value={formItem.numeroItem} onChange={lidarComMudanca} /></div>
              <div className="form-group"><label>Descrição / Discriminação</label><input type="text" name="discriminacao" required value={formItem.discriminacao} onChange={lidarComMudanca} /></div>
              <div className="form-group"><label>Unidade</label><input type="text" name="unidade" required value={formItem.unidade} onChange={lidarComMudanca} /></div>
              <div className="form-group"><label>Quantidade</label><input type="number" step="0.01" name="quantidade" required value={formItem.quantidade} onChange={lidarComMudanca} /></div>
              <div className="form-group"><label>Valor Unit. (R$)</label><input type="number" step="0.01" name="valorUnitario" required value={formItem.valorUnitario} onChange={lidarComMudanca} /></div>
            </div>
            <div style={{ textAlign: 'right', marginTop: '10px' }}>
              <button type="submit" className="btn-salvar" disabled={loading}>+ Adicionar Manualmente</button>
            </div>
          </form>

          <h3>Histórico de Itens (Logs de Redução)</h3>
          <table className="tabela-itens">
            <thead>
              <tr>
                <th>Data/Hora (Log)</th>
                <th>Lote/Item</th>
                <th>Descrição / Discriminação</th>
                <th>Qtd</th>
                <th>V. Unitário</th>
                <th>Total Reduzido</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center'}}>Nenhuma movimentação registada.</td></tr>
              ) : (
                itens.map(item => (
                  <tr key={item.id}>
                    <td style={{ color: '#004a99', fontWeight: 'bold' }}>{item.dataAdicao}</td>
                    <td>{item.numeroLote} / {item.numeroItem}</td>
                    <td>{item.discriminacao}</td>
                    <td>{item.quantidade} {item.unidade}</td>
                    <td>{item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ color: '#dc3545', fontWeight: 'bold' }}>
                      - {item.valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  );
}