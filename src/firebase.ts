// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Importamos o Firestore

const firebaseConfig = {
  apiKey: "AIzaSyBnbbSqV_RO6rBl5YmU4gUPHFBdDQoj_rU",
  authDomain: "gestao-contratos-pmp.firebaseapp.com",
  projectId: "gestao-contratos-pmp",
  storageBucket: "gestao-contratos-pmp.firebasestorage.app",
  messagingSenderId: "223367239696",
  appId: "1:223367239696:web:6ccd5d4e3b5954eba8d295"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o banco de dados (db) para podermos usá-lo nas nossas telas
export const db = getFirestore(app);