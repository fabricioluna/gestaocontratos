// src/types/types.ts

export interface ItemAditivado {
  numeroLote?: string;
  numeroItem?: string;
  discriminacao: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
}

export interface Aditivo {
  id?: string;
  descricao: string;
  tipo: 'prazo' | 'valor' | 'ambos';
  dataAditivo: string;
  novaDataFim?: string;
  valorAditivado: number;
  itensAditivados?: ItemAditivado[];
}

export interface Contrato {
  id?: string;
  numeroContrato: string;
  numeroProcesso?: string;
  modalidade?: string;
  numeroModalidade?: string;
  numeroPregao?: string; // Mantido por retrocompatibilidade
  numeroAta?: string;
  fornecedor: string;
  
  // OS NOSSOS NOVOS CAMPOS INTELIGENTES:
  cnpjFornecedor?: string;
  emailSecretaria?: string;
  orgaoId?: string | null;
  
  objetoCompleto?: string;
  objetoResumido: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
  fiscalContrato?: string;
  observacao?: string;
  aditivos?: Aditivo[];
  dataDistrato?: string;
  motivoDistrato?: string;
  dataUltimaAtualizacao?: string;
}

export interface Item {
  id?: string;
  contratoId: string;
  numeroLote?: string;
  numeroItem?: string;
  discriminacao: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  tipoRegistro?: 'catalogo' | 'consumo';
  dataAdicao?: string;
  quantidadeConsumida?: number;
}

export interface FormContratoState {
  numeroContrato: string;
  numeroProcesso: string;
  modalidade: string;
  numeroModalidade: string;
  numeroPregao?: string; // Mantido por retrocompatibilidade
  numeroAta: string;
  fornecedor: string;
  
  // OS NOSSOS NOVOS CAMPOS INTELIGENTES:
  cnpjFornecedor: string;
  emailSecretaria: string;
  orgaoId?: string | null;
  
  objetoCompleto: string;
  objetoResumido: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: string;
  fiscalContrato: string;
  observacao: string;
}