import { db, auth, app, state } from './globals.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";













// Wiki Globals


 
 
 

document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById("googleBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    if (googleBtn) googleBtn.onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (err) { console.error(err); } };
    if (logoutBtn) logoutBtn.onclick = async () => signOut(auth);
    const darkModeBtn = document.getElementById("darkModeToggle");
    if (darkModeBtn) {
        darkModeBtn.onclick = () => {
            document.body.classList.toggle("dark");
            const isDark = document.body.classList.contains('dark');
            darkModeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i> Light' : '<i class="fa-solid fa-moon"></i> Dark';
            localStorage.setItem("darkMode", isDark ? "on" : "off");
            updateMonacoTheme();
        };
    }
    enableAutoLinking('problemTextNotes');
    enableAutoLinking('wikiTextNotes');
    
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.closest('.editor-content')) {
            link.target = '_blank';
        }
    });

    // --- POPUP CLOSING LOGIC ---
    const noteModal = document.getElementById("noteModal");
    if (noteModal) noteModal.addEventListener("click", (e) => { if (e.target === noteModal) window.closeNoteModal(); });

    const problemModal = document.getElementById("problemModal");
    if (problemModal) problemModal.addEventListener("click", (e) => { if (e.target === problemModal) window.closeProblemModal(); });

    const wikiEditModal = document.getElementById("wikiEditModal");
    if (wikiEditModal) wikiEditModal.addEventListener("click", (e) => { if (e.target === wikiEditModal) window.closeWikiEditModal(); });

    const confirmModal = document.getElementById("confirmModal");
    if (confirmModal) confirmModal.addEventListener("click", (e) => { if (e.target === confirmModal) window.closeConfirmModal(); });
    
    // Wiki Popup Close Logic
    const wikiModal = document.getElementById("wikiModal");
    if (wikiModal) wikiModal.addEventListener("click", (e) => { if (e.target === wikiModal) window.closeWikiModal(); });

    // --- SEARCH & SORT EVENTS ---
    const sortSelect = document.getElementById("sortBySelect");
    const searchInput = document.getElementById("searchProblemInput");

    if (sortSelect) sortSelect.addEventListener("change", () => { state.currentPage = 1; renderTable(); });
    if (searchInput) searchInput.addEventListener("input", () => { state.currentPage = 1; renderTable(); });

    // --- PAGINATION LISTENERS ---
    document.getElementById("prevPageBtn").onclick = () => { if(state.currentPage > 1) { state.currentPage--; renderTable(); } };
    document.getElementById("nextPageBtn").onclick = () => { state.currentPage++; renderTable(); };
    
    document.getElementById("fastPrevBtn").onclick = () => { 
        state.currentPage = Math.max(1, state.currentPage - 5); 
        renderTable(); 
    };
    document.getElementById("fastNextBtn").onclick = () => { 
        state.currentPage += 5; 
        renderTable(); 
    };

    // --- DRAFT LISTENERS (Attach to inputs) ---
    // Safe check if element exists before adding listener
    const problemIds = ['problem', 'tags', 'difficulty'];
    problemIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', saveProblemDraft);
    });
    const pNotes = document.getElementById('problemTextNotes');
    if(pNotes) pNotes.addEventListener('input', saveProblemDraft);

    const wikiIds = ['wikiTopic', 'wikiSubtopic'];
    wikiIds.forEach(id => {
         const el = document.getElementById(id);
         if(el) el.addEventListener('input', saveWikiDraft);
    });
    const wNotes = document.getElementById('wikiTextNotes');
    if(wNotes) wNotes.addEventListener('input', saveWikiDraft);
});

/* =========================================