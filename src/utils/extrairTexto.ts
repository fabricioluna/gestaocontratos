// src/utils/extrairTexto.ts
import { carregarPdfjs } from './pdfjs';

// Extrai o texto de um PDF, DOCX ou arquivo de texto simples — lógica que
// antes estava duplicada entre o upload de contrato (ModalNovoContrato) e
// o upload de aditivo (useDetalhesContrato), cada um com sua própria cópia
// do laço de páginas do pdf.js e da chamada ao mammoth (Fase 7).
export const extrairTextoDeArquivo = async (file: File): Promise<string> => {
  const nome = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (nome.endsWith('.pdf')) {
    const pdfjsLib = await carregarPdfjs();
    const typedArray = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
    let texto = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      texto += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
    }
    return texto;
  }

  if (nome.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const resultado = await mammoth.extractRawText({ arrayBuffer });
    return resultado.value;
  }

  return file.text();
};
