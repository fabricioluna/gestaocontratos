// src/utils/xlsxGerador.ts

// Gera e baixa uma planilha .xlsx a partir de uma lista de objetos —
// lógica que antes estava duplicada entre o relatório de contratos
// (Painel) e o relatório de itens de um contrato (DetalhesContrato)
// (Fase 7). `xlsx` continua carregado sob demanda (Fase 6).
export const gerarPlanilhaXlsx = async (
  dados: Record<string, unknown>[],
  nomeAba: string,
  nomeArquivo: string
): Promise<void> => {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, nomeAba);
  XLSX.writeFile(workbook, nomeArquivo);
};
