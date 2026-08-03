// src/utils/pdfjs.ts

// pdfjs-dist só é carregado quando alguém efetivamente sobe um PDF (aditivo
// ou contrato) — import() dinâmico para tirar a lib do bundle inicial
// (Fase 6). O `workerSrc` aponta para o worker empacotado pelo Vite a
// partir do próprio pacote instalado, em vez da CDN unpkg usada antes (sem
// SRI, dependia de disponibilidade externa em runtime — achado A3 da
// auditoria).
export const carregarPdfjs = async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
  return pdfjsLib;
};
