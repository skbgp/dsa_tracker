import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQAs_aLO42sUBkPfZ_ajuTMlFWnaRiLpc",
    authDomain: "dsa-tracker-b1e5e.firebaseapp.com",
    projectId: "dsa-tracker-b1e5e",
    storageBucket: "dsa-tracker-b1e5e.firebasestorage.app",
    messagingSenderId: "850939002762",
    appId: "1:850939002762:web:69c1c3eb55fe00bd709273"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DRAFT CONSTANTS ---
const DRAFT_KEY_PROBLEM = "dsa_tracker_problem_draft";
const DRAFT_KEY_WIKI = "dsa_tracker_wiki_draft";

/* =========================================