
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQAs_aLO42sUBkPfZ_ajuTMlFWnaRiLpc",
    authDomain: "dsa-tracker-b1e5e.firebaseapp.com",
    projectId: "dsa-tracker-b1e5e",
    storageBucket: "dsa-tracker-b1e5e.firebasestorage.app",
    messagingSenderId: "850939002762",
    appId: "1:850939002762:web:69c1c3eb55fe00bd709273"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const state = {
    ADMIN_EMAIL: "shubhamkr.590@gmail.com",
    isAdmin: false,
    currentUser: null,
    editId: null,
    globalProblemsList: [],
    userProblemsMap: {},
    allProblems: [],
    allTags: [],
    currentPracticeLinks: [],
    currentPage: 1,
    PAGE_SIZE: 10,
    currentNoteId: null,
    allWikiNotes: [],
    wikiTopicOrder: [],
    wikiSubtopicOrder: {},
    expandedTopics: {},
    monacoEditor: null,
    monacoModalEditor: null,
    wikiEditor: null,
    wikiPopupEditor: null,
    addFormFocusIndex: -1,
    wikiTopicFocusIndex: -1
};
