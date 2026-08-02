// src/utils/pdfGerador.ts

// jsPDF + jspdf-autotable só são necessários quando o usuário efetivamente
// pede um PDF (relatório, O.S.) — import() dinâmico para tirar as duas do
// bundle inicial (Fase 6). Antes as duas apareciam agrupadas no chunk
// rotulado `geminiService` por um artefato de nomeação do bundler (ver
// CLAUDE.md, problema conhecido nº 6 — o SDK do Gemini em si saiu do
// cliente na Fase 2).
export const carregarJsPDF = async () => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
};
