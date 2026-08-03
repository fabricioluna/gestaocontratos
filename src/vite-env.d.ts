/// <reference types="vite/client" />

// Tipa as variáveis VITE_* consumidas em src/firebase.ts — sem isso,
// `import.meta.env.VITE_*` é `any`, o que o ESLint type-aware (Fase 7)
// aponta como no-unsafe-assignment em cada campo do firebaseConfig.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
