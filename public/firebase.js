import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyADWmrB3lFyXV3jrAhuMp3CFAB89eCdlAA",
  authDomain: "school-guidance-program-964ce.firebaseapp.com",
  projectId: "school-guidance-program-964ce",
  storageBucket: "school-guidance-program-964ce.firebasestorage.app",
  messagingSenderId: "825349409723",
  appId: "1:825349409723:web:f4204935aadf92d745129e",
  measurementId: "G-GB178NYDHM"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);