import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";


const firebaseConfig = {
  apiKey: "AIzaSyAkpMxmDOlyjnpNILrP7xTHwwCKwqt2tCg",
  authDomain: "dentavis-db2d4.firebaseapp.com",
  projectId: "dentavis-db2d4",
  storageBucket: "dentavis-db2d4.appspot.com", // <- MUST be .appspot.com
  messagingSenderId: "243506310449",
  appId: "1:243506310449:web:7b03745c303b583b5ed410"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 
export const functions = getFunctions(app); 

