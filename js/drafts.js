import { db, auth, app, state } from './globals.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

   DRAFT LOGIC (Persistence) - FIXED
   ========================================= */
function saveProblemDraft() {
    if (state.editId) return; // Do not overwrite draft if we are editing an existing item

    // If the modal is hidden, do NOT save. This prevents the "empty init" bug on refresh.
    const modal = document.getElementById("problemModal");
    if (!modal || window.getComputedStyle(modal).display === "none") {
        return; 
    }

    // Safely get values
    const pEl = document.getElementById("problem");
    const tEl = document.getElementById("tags");
    const dEl = document.getElementById("difficulty");
    const nEl = document.getElementById("problemTextNotes");
    
    // If inputs aren't rendered yet, don't save
    if (!pEl || !tEl) return; 

    const draft = {
        problem: pEl.value,
        tags: tEl.value,
        difficulty: dEl ? dEl.value : "Medium",
        notes: nEl ? nEl.innerHTML : "",
        code: state.monacoEditor ? state.monacoEditor.getValue() : "",
        links: state.currentPracticeLinks
    };
    localStorage.setItem(DRAFT_KEY_PROBLEM, JSON.stringify(draft));
}

function loadProblemDraft() {
    const saved = localStorage.getItem(DRAFT_KEY_PROBLEM);
    if (!saved) return;
    try {
        const draft = JSON.parse(saved);
        if(draft.problem && document.getElementById("problem")) document.getElementById("problem").value = draft.problem;
        if(draft.tags && document.getElementById("tags")) document.getElementById("tags").value = draft.tags;
        if(draft.difficulty && document.getElementById("difficulty")) document.getElementById("difficulty").value = draft.difficulty;
        if(draft.notes && document.getElementById("problemTextNotes")) document.getElementById("problemTextNotes").innerHTML = draft.notes;
        
        if (draft.links) {
            state.currentPracticeLinks = draft.links;
            renderPracticeLinksPreview();
        }
    } catch (e) {
        console.error("Error loading problem draft", e);
    }
}

function saveWikiDraft() {
    if (state.currentNoteId) return; // Do not overwrite draft if editing existing
    
    // Check if Wiki Modal is Open
    const modal = document.getElementById("wikiEditModal");
    if (!modal || window.getComputedStyle(modal).display === "none") {
        return;
    }
    
    const tEl = document.getElementById("wikiTopic");
    const sEl = document.getElementById("wikiSubtopic");
    const nEl = document.getElementById("wikiTextNotes");

    if (!tEl || !sEl) return;

    const draft = {
        topic: tEl.value,
        subtopic: sEl.value,
        notes: nEl ? nEl.innerHTML : "",
        code: state.wikiEditor ? state.wikiEditor.getValue() : ""
    };
    localStorage.setItem(DRAFT_KEY_WIKI, JSON.stringify(draft));
    showSaveStatus("Draft Saved", false);
}

function loadWikiDraft() {
    const saved = localStorage.getItem(DRAFT_KEY_WIKI);
    if (!saved) return;
    try {
        const draft = JSON.parse(saved);
        if(draft.topic && document.getElementById("wikiTopic")) document.getElementById("wikiTopic").value = draft.topic;
        if(draft.subtopic && document.getElementById("wikiSubtopic")) document.getElementById("wikiSubtopic").value = draft.subtopic;
        if(draft.notes && document.getElementById("wikiTextNotes")) document.getElementById("wikiTextNotes").innerHTML = draft.notes;
        if (state.wikiEditor && draft.code && draft.code !== "// Code implementation goes here...") {
            state.wikiEditor.setValue(draft.code);
        }
    } catch (e) {
        console.error("Error loading wiki draft", e);
    }
}


onAuthStateChanged(auth, (user) => {
    const authSection = document.getElementById("auth-section");
    const appSection = document.getElementById("app-section");
    const welcomeText = document.getElementById("welcome-text");
    if (user) {
        state.currentUser = user;
state.isAdmin = (user.email === state.ADMIN_EMAIL);
        if(authSection) authSection.style.display = "none";
        if(appSection) appSection.style.display = "block";
        if(welcomeText) welcomeText.textContent = `Hi, ${user.displayName || 'User'}`;
        loadProblems();
        loadWikiNotes();
    } else {
        state.currentUser = null;
        if(authSection) authSection.style.display = "grid"; 
        if(appSection) appSection.style.display = "none";
    }
});

window.switchTab = (tab) => {
    const trackerView = document.getElementById('tracker-view');
    const wikiView = document.getElementById('wiki-view');
    const tabTracker = document.getElementById('tabTracker');
    const tabWiki = document.getElementById('tabWiki');
    if (trackerView && wikiView) {
        trackerView.style.display = tab === 'tracker' ? 'block' : 'none';
        wikiView.style.display = tab === 'wiki' ? 'flex' : 'none';
    }
    if (tabTracker && tabWiki) {
        tabTracker.classList.toggle('active', tab === 'tracker');
        tabWiki.classList.toggle('active', tab === 'wiki');
    }
};

function validateField(elementId, errorMessage) {
    const el = document.getElementById(elementId);
    if (!el) return true;
    const value = el.value.trim();
    const nextEl = el.nextElementSibling;
    const hasError = nextEl && nextEl.classList.contains('error-text');
    if (!value) {
        if (!hasError) {
            el.classList.add('input-error');
            const errDiv = document.createElement('div');
            errDiv.className = 'error-text';
            errDiv.innerText = errorMessage;
            el.insertAdjacentElement('afterend', errDiv);
            el.addEventListener('input', function() {
                el.classList.remove('input-error');
                if (el.nextElementSibling && el.nextElementSibling.classList.contains('error-text')) el.nextElementSibling.remove();
            }, { once: true });
        }
        return false;
    }
    return true;
}

function showSaveStatus(msg, isError = false) {
    const statusEl = document.getElementById('wikiSaveStatus');
    if (statusEl) {
        statusEl.textContent = msg;
        statusEl.style.color = isError ? "#e74c3c" : "#27ae60";
        statusEl.style.opacity = "1";
        setTimeout(() => { statusEl.style.opacity = "0"; }, 2000);
    }
}

function getWebsiteName(url) {
    try {
        const domain = new URL(url).hostname.replace("www.", "");
        if (domain.includes("leetcode")) return "LeetCode";
        if (domain.includes("geeksforgeeks")) return "GFG";
        const name = domain.split('.')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    } catch { return "Link"; }
}

function renderPracticeLinksPreview() {
    const container = document.getElementById("practiceLinksPreview");
    if (!container) return;
    container.innerHTML = "";
    state.currentPracticeLinks.forEach((link, index) => {
        const div = document.createElement("div");
        div.style.marginBottom = "4px";
        div.innerHTML = `<span>${getWebsiteName(link)}</span> <button type="button" onclick="removePracticeLink(${index})" style="color:red; background:none; padding:0 5px; margin-left:5px;"><i class="fa-solid fa-xmark"></i></button>`;
        container.appendChild(div);
    });
}
window.removePracticeLink = (index) => { state.currentPracticeLinks.splice(index, 1); renderPracticeLinksPreview(); saveProblemDraft(); }; // Updated to save draft
const addLinkBtn = document.getElementById("addPracticeLinkBtn");
if (addLinkBtn) {
    addLinkBtn.onclick = () => {
        const input = document.getElementById("practiceLinkInput");
        const link = input.value.trim();
        if (!link) { alert("Please paste a link first"); return; }
        state.currentPracticeLinks.push(link);
        input.value = "";
        renderPracticeLinksPreview();
        saveProblemDraft(); // Updated to save draft
    };
}

/* =========================================

// --- Global Exports ---
window.renderPracticeLinksPreview = renderPracticeLinksPreview;
window.validateField = validateField;
window.loadProblemDraft = loadProblemDraft;
window.getWebsiteName = getWebsiteName;
window.saveProblemDraft = saveProblemDraft;
window.showSaveStatus = showSaveStatus;
window.loadWikiDraft = loadWikiDraft;
window.saveWikiDraft = saveWikiDraft;
