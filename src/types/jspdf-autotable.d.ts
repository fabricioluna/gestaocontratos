// src/types/jspdf-autotable.d.ts

// `jspdf-autotable` injeta `lastAutoTable` na instância de jsPDF em
// runtime após cada chamada a `autoTable()`, mas não declara essa
// propriedade nos tipos oficiais da lib (gap de terceiros). Sem esta
// augmentation, cada ponto de uso precisava do próprio cast
// `(doc as unknown as { lastAutoTable?: {...} })`, duplicado em
// DetalhesContrato.tsx e ModalEmitirOS.tsx (achado do /simplify, Fase 7).
import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: { finalY: number };
  }
}
