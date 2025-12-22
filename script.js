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
   MONACO EDITORS SETUP
   ========================================= */
let monacoEditor = null;      // Problem Edit
let monacoModalEditor = null; // Problem View
let wikiEditor = null;        // Wiki Edit
let wikiPopupEditor = null;   // Wiki View

require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    // 1. Problem Edit Editor
    const editorEl = document.getElementById('monacoEditor');
    if (editorEl) {
        monacoEditor = monaco.editor.create(editorEl, {
            value: '// Write your code implementation here...', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });
        
        // --- FIX: Clear default text on focus ---
        monacoEditor.onDidFocusEditorWidget(() => {
            const val = monacoEditor.getValue().trim();
            if (val === '// Write your code implementation here...') {
                monacoEditor.setValue('');
            }
        });

        // Auto-save on typing in code editor
        monacoEditor.onDidChangeModelContent(() => saveProblemDraft());
    }

    // 2. Problem View Editor
    const modalEl = document.getElementById('monacoModalEditor');
    if (modalEl) {
        monacoModalEditor = monaco.editor.create(modalEl, {
            value: '', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: true }, readOnly: true, fontSize: 13
        });
    }

    // 3. Wiki Edit Editor
    const wikiEl = document.getElementById('wikiMonaco');
    if (wikiEl) {
        wikiEditor = monaco.editor.create(wikiEl, {
            value: '// Code implementation goes here...',
            language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });

        // --- FIX: Clear default text on focus (Wiki) ---
        wikiEditor.onDidFocusEditorWidget(() => {
            const val = wikiEditor.getValue().trim();
            if (val === '// Code implementation goes here...') {
                wikiEditor.setValue('');
            }
        });

        // Auto-save on typing in wiki code editor
        wikiEditor.onDidChangeModelContent(() => saveWikiDraft());
    }

    // 4. Wiki View Editor
    const wikiPopupEl = document.getElementById('monacoWikiModalEditor');
    if (wikiPopupEl) {
        wikiPopupEditor = monaco.editor.create(wikiPopupEl, {
            value: '', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: true }, readOnly: true, fontSize: 13
        });
    }

    updateMonacoTheme();
});

function updateMonacoTheme() {
    const isDark = document.body.classList.contains('dark');
    const theme = isDark ? 'vs-dark' : 'vs';
    if (monacoEditor) monaco.editor.setTheme(theme);
    if (monacoModalEditor) monaco.editor.setTheme(theme);
    if (wikiEditor) monaco.editor.setTheme(theme);
    if (wikiPopupEditor) monaco.editor.setTheme(theme);
}

function getMonacoValue() { return monacoEditor ? monacoEditor.getValue() : ''; }

/* =========================================
   RICH TEXT & LAYOUT HELPERS
   ========================================= */
window.formatDoc = (cmd, value = null) => {
    if (value) document.execCommand(cmd, false, value);
    else document.execCommand(cmd);
};

window.toggleLayout = (context) => {
    let container;
    let editorToRefresh;
    if (context === 'wikiEditModal') { container = document.getElementById('wikiEditSplit'); editorToRefresh = wikiEditor; }
    else if (context === 'wikiModal') { container = document.getElementById('wikiModalSplit'); editorToRefresh = wikiPopupEditor; }
    else if (context === 'problemModal') { container = document.getElementById('problemSplit'); editorToRefresh = monacoEditor; }
    else if (context === 'noteModal') { container = document.getElementById('modalSplit'); editorToRefresh = monacoModalEditor; }

    if (container) {
        container.classList.toggle('layout-stacked');
        if (editorToRefresh) setTimeout(() => editorToRefresh.layout(), 50);
    }
};

window.togglePanel = (panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.toggle('collapsed');
    setTimeout(() => {
        if (monacoEditor) monacoEditor.layout();
        if (wikiEditor) wikiEditor.layout();
        if (monacoModalEditor) monacoModalEditor.layout();
        if (wikiPopupEditor) wikiPopupEditor.layout();
    }, 300);
};

function enableAutoLinking(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    editor.addEventListener('keydown', (e) => { 
        if (e.key !== ' ' && e.key !== 'Enter') return;
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;
        
        const textContent = node.textContent;
        const cursorPosition = range.startOffset;
        const textBefore = textContent.substring(0, cursorPosition);
        const words = textBefore.split(/\s+/);
        const lastWord = words[words.length - 1];
        
        const urlRegex = /^(https?:\/\/|www\.)[^\s]+$/i;
        if (urlRegex.test(lastWord)) {
            const wordEndIndex = cursorPosition;
            const wordStartIndex = wordEndIndex - lastWord.length;
            const urlRange = document.createRange();
            urlRange.setStart(node, wordStartIndex);
            urlRange.setEnd(node, wordEndIndex);
            
            selection.removeAllRanges();
            selection.addRange(urlRange);
            
            let href = lastWord;
            if (!/^https?:\/\//i.test(href)) href = 'http://' + href;
            document.execCommand('createLink', false, href);
            selection.collapseToEnd();
        }
    });
}

/* =========================================
   GLOBAL STATE & AUTH
   ========================================= */
let currentUser = null;
let editId = null;
let allProblems = [];
let allTags = [];
let currentPracticeLinks = [];
let currentPage = 1;
const PAGE_SIZE = 10;

// Wiki Globals
let currentNoteId = null;
let allWikiNotes = [];
let wikiTopicOrder = []; 
let wikiSubtopicOrder = {}; 
let expandedTopics = {}; 

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

    if (sortSelect) sortSelect.addEventListener("change", () => { currentPage = 1; renderTable(); });
    if (searchInput) searchInput.addEventListener("input", () => { currentPage = 1; renderTable(); });

    // --- PAGINATION LISTENERS ---
    document.getElementById("prevPageBtn").onclick = () => { if(currentPage > 1) { currentPage--; renderTable(); } };
    document.getElementById("nextPageBtn").onclick = () => { currentPage++; renderTable(); };
    
    document.getElementById("fastPrevBtn").onclick = () => { 
        currentPage = Math.max(1, currentPage - 5); 
        renderTable(); 
    };
    document.getElementById("fastNextBtn").onclick = () => { 
        currentPage += 5; 
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
   DRAFT LOGIC (Persistence) - FIXED
   ========================================= */
function saveProblemDraft() {
    if (editId) return; // Do not overwrite draft if we are editing an existing item

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
        code: monacoEditor ? monacoEditor.getValue() : "",
        links: currentPracticeLinks
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
            currentPracticeLinks = draft.links;
            renderPracticeLinksPreview();
        }
    } catch (e) {
        console.error("Error loading problem draft", e);
    }
}

function saveWikiDraft() {
    if (currentNoteId) return; // Do not overwrite draft if editing existing
    
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
        code: wikiEditor ? wikiEditor.getValue() : ""
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
        if (wikiEditor && draft.code && draft.code !== "// Code implementation goes here...") {
            wikiEditor.setValue(draft.code);
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
        currentUser = user;
        if(authSection) authSection.style.display = "none";
        if(appSection) appSection.style.display = "block";
        if(welcomeText) welcomeText.textContent = `Hi, ${user.displayName || 'User'}`;
        loadProblems();
        loadWikiNotes();
    } else {
        currentUser = null;
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
    currentPracticeLinks.forEach((link, index) => {
        const div = document.createElement("div");
        div.style.marginBottom = "4px";
        div.innerHTML = `<span>${getWebsiteName(link)}</span> <button type="button" onclick="removePracticeLink(${index})" style="color:red; background:none; padding:0 5px; margin-left:5px;"><i class="fa-solid fa-xmark"></i></button>`;
        container.appendChild(div);
    });
}
window.removePracticeLink = (index) => { currentPracticeLinks.splice(index, 1); renderPracticeLinksPreview(); saveProblemDraft(); }; // Updated to save draft
const addLinkBtn = document.getElementById("addPracticeLinkBtn");
if (addLinkBtn) {
    addLinkBtn.onclick = () => {
        const input = document.getElementById("practiceLinkInput");
        const link = input.value.trim();
        if (!link) { alert("Please paste a link first"); return; }
        currentPracticeLinks.push(link);
        input.value = "";
        renderPracticeLinksPreview();
        saveProblemDraft(); // Updated to save draft
    };
}

/* =========================================
   AUTOCOMPLETE (Only for Input Forms)
   ========================================= */
const tagsInput = document.getElementById("tags");
const formTagBox = document.getElementById("tagInputSuggestionsBox");
const wikiTopicInput = document.getElementById("wikiTopic");
const wikiTopicBox = document.getElementById("wikiTopicSuggestionsBox");

let addFormFocusIndex = -1;
let wikiTopicFocusIndex = -1;

function renderSuggestions(matches, container, onSelect, activeIndex) {
    container.innerHTML = "";
    if (!matches.length) { container.style.display = "none"; return; }
    matches.forEach((tag, index) => {
        const div = document.createElement("div");
        div.textContent = tag;
        div.className = "suggestion-item";
        if (index === activeIndex) { div.classList.add("active-suggestion"); div.scrollIntoView({ block: "nearest" }); }
        div.onclick = () => onSelect(tag);
        container.appendChild(div);
    });
    container.style.display = "block";
}

function updateActiveItem(items, index) {
    for (let i = 0; i < items.length; i++) items[i].classList.remove("active-suggestion");
    if (items[index]) {
        items[index].classList.add("active-suggestion");
        items[index].scrollIntoView({ block: "nearest" });
    }
}

if (tagsInput && formTagBox) {
    tagsInput.addEventListener("input", () => {
        const raw = tagsInput.value;
        const parts = raw.split(",");
        const lastPart = parts[parts.length - 1].trim().toLowerCase();
        addFormFocusIndex = -1;
        if (!lastPart) { formTagBox.style.display = "none"; return; }
        const matches = allTags.filter((tag) => tag.toLowerCase().includes(lastPart));
        renderSuggestions(matches, formTagBox, (selectedTag) => {
            parts[parts.length - 1] = " " + selectedTag;
            tagsInput.value = parts.join(",").replace(/^,/, "").trimStart();
            formTagBox.style.display = "none";
            tagsInput.focus();
            saveProblemDraft(); // Trigger save on tag select
        }, addFormFocusIndex);
    });
    tagsInput.addEventListener("keydown", (e) => {
        const items = formTagBox.getElementsByClassName("suggestion-item");
        if (formTagBox.style.display === "none") return;
        if (e.key === "ArrowDown") { e.preventDefault(); addFormFocusIndex = (addFormFocusIndex + 1) % items.length; updateActiveItem(items, addFormFocusIndex); }
        else if (e.key === "ArrowUp") { e.preventDefault(); addFormFocusIndex = (addFormFocusIndex - 1 + items.length) % items.length; updateActiveItem(items, addFormFocusIndex); }
        else if (e.key === "Enter") { e.preventDefault(); if (items[addFormFocusIndex]) items[addFormFocusIndex].click(); }
        else if (e.key === "Escape") formTagBox.style.display = "none";
    });
}

if (wikiTopicInput && wikiTopicBox) {
    wikiTopicInput.addEventListener("input", () => {
        const query = wikiTopicInput.value.trim().toLowerCase();
        wikiTopicFocusIndex = -1;
        if (!query) { wikiTopicBox.style.display = "none"; return; }
        const uniqueTopics = [...new Set(allWikiNotes.map(n => (n.topic || "").trim()).filter(Boolean))];
        const matches = uniqueTopics.filter(t => t.toLowerCase().includes(query));
        
        renderSuggestions(matches, wikiTopicBox, (selectedTopic) => {
            wikiTopicInput.value = selectedTopic;
            wikiTopicBox.style.display = "none";
            saveWikiDraft(); // Trigger save on topic select
        }, wikiTopicFocusIndex);
    });

    wikiTopicInput.addEventListener("keydown", (e) => {
        const items = wikiTopicBox.getElementsByClassName("suggestion-item");
        if (wikiTopicBox.style.display === "none") return;
        if (e.key === "ArrowDown") { e.preventDefault(); wikiTopicFocusIndex = (wikiTopicFocusIndex + 1) % items.length; updateActiveItem(items, wikiTopicFocusIndex); }
        else if (e.key === "ArrowUp") { e.preventDefault(); wikiTopicFocusIndex = (wikiTopicFocusIndex - 1 + items.length) % items.length; updateActiveItem(items, wikiTopicFocusIndex); }
        else if (e.key === "Enter") { e.preventDefault(); if (items[wikiTopicFocusIndex]) items[wikiTopicFocusIndex].click(); }
        else if (e.key === "Escape") wikiTopicBox.style.display = "none";
    });
}

document.addEventListener("click", (e) => {
    if (formTagBox && !formTagBox.contains(e.target) && e.target !== tagsInput) formTagBox.style.display = "none";
    if (wikiTopicBox && !wikiTopicBox.contains(e.target) && e.target !== wikiTopicInput) wikiTopicBox.style.display = "none";
});

/* =========================================
   TRACKER LOGIC (NEW: MODAL HANDLING)
   ========================================= */
const sortPanel = document.getElementById("sortPanel");
const problemModal = document.getElementById("problemModal");
const openAddFormBtn = document.getElementById("openAddFormBtn");
const toggleSortBtn = document.getElementById("toggleSortBtn");

// 1. Toggle Add Mode (Opens Modal now)
function toggleAddMode(show) {
    if (show) {
        sortPanel.style.display = "none"; // Close sort
        problemModal.style.display = "flex"; // Open modal
        
        if (!editId) {
            // 1. Clear fields FIRST
            document.getElementById("problem").value = "";
            document.getElementById("tags").value = "";
            document.getElementById("problemTextNotes").innerHTML = "";
            currentPracticeLinks = [];
            renderPracticeLinksPreview();

            // 2. Load Draft IMMEDIATELY (Before checking monaco)
            loadProblemDraft(); 
            
            // 3. Set Code Default (only if no draft code exists)
            if(monacoEditor) {
                 const saved = localStorage.getItem(DRAFT_KEY_PROBLEM);
                 if(!saved || !JSON.parse(saved).code) {
                      monacoEditor.setValue('// Write your code implementation here...');
                 } else {
                      monacoEditor.setValue(JSON.parse(saved).code);
                 }
            }
        }
        
        // Layout Monaco if it is ready
        if (monacoEditor) {
            setTimeout(() => monacoEditor.layout(), 100);
        }
    } else {
        closeProblemModal();
    }
}
window.closeProblemModal = () => {
    // 1. HIDE MODAL FIRST to stop Draft Saving
    problemModal.style.display = "none";
    
    // 2. Cleanup vars
    editId = null;
    currentPracticeLinks = [];
    renderPracticeLinksPreview();
    
    // 3. Clear Inputs (Draft logic ignores this because display is none)
    document.getElementById("problem").value = "";
    document.getElementById("tags").value = "";
    document.getElementById("problemTextNotes").innerHTML = ""; 
    document.querySelectorAll('.error-text').forEach(e => e.remove());
    document.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));
    
    // 4. Reset Editor
    if(monacoEditor) monacoEditor.setValue('');
};

// 2. Toggle Sort Mode
document.getElementById("toggleSortBtn").onclick = () => {
    const isCurrentlyClosed = sortPanel.style.display === "none";
    sortPanel.style.display = isCurrentlyClosed ? "flex" : "none";
};

openAddFormBtn.onclick = () => toggleAddMode(true);

function getSafeTime(dateVal) {
    if (!dateVal) return 0;
    if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
    return new Date(dateVal).getTime();
}

function loadProblems() {
    if(!currentUser) return;
    const ref = collection(db, "users", currentUser.uid, "problems");
    onSnapshot(ref, (snap) => {
        allProblems = []; allTags = [];
        snap.forEach((d) => {
            const p = { id: d.id, ...d.data() };
            if (!p.createdAt) p.createdAt = p.updatedAt || 0; 
            allProblems.push(p);
            (p.tags || []).forEach((tag) => allTags.push(tag));
        });

        // Default sort: Oldest creation first
        allProblems.sort((a, b) => {
            const timeA = getSafeTime(a.createdAt);
            const timeB = getSafeTime(b.createdAt);
            return timeA - timeB; 
        });

        allProblems.forEach((p, index) => { p.serialNo = index + 1; });
        allTags = [...new Set(allTags)];
        renderTable();
    });
}

const saveBtn = document.getElementById("saveProblemBtn");
if (saveBtn) {
    saveBtn.onclick = async () => {
        if (!currentUser) return alert("Please login first.");
        const isProblemValid = validateField("problem", "Required");
        const isTagsValid = validateField("tags", "Required");
        if (!isProblemValid || !isTagsValid) return;

        const problemInput = document.getElementById("problem");
        const tagsInput = document.getElementById("tags");
        const difficultySelect = document.getElementById("difficulty");
        const notesInput = document.getElementById("problemTextNotes");
        const cleanTags = tagsInput.value.split(",").map((t) => t.trim()).filter(Boolean);
        
        const baseData = {
            problem: problemInput.value.trim(),
            difficulty: difficultySelect.value,
            conceptNotes: notesInput.innerHTML, 
            code: getMonacoValue(),
            practiceLinks: currentPracticeLinks, 
            tags: cleanTags,
            updatedAt: new Date().toISOString()
        };

        try {
            const ref = collection(db, "users", currentUser.uid, "problems");
            if (editId) {
                // EDIT
                const docSnap = await getDoc(doc(ref, editId));
                const currentData = docSnap.data();
                const updatePayload = { ...baseData };
                
                if (!currentData.createdAt) {
                    updatePayload.createdAt = currentData.updatedAt || new Date().toISOString();
                }
                
                await updateDoc(doc(ref, editId), updatePayload); 
            } else {
                // ADD
                const revisionDate = new Date();
                revisionDate.setDate(revisionDate.getDate() + 7);
                await addDoc(ref, { 
                    ...baseData, 
                    createdAt: new Date().toISOString(), 
                    starred: false, 
                    revisionCount: 0, 
                    revisionDue: revisionDate.toISOString() 
                });
            }
            // CLEAR DRAFT ON SUCCESS
            localStorage.removeItem(DRAFT_KEY_PROBLEM);
            toggleAddMode(false); 
        } catch (error) { console.error(error); alert("Error saving: " + error.message); }
    };
}



// UPDATED: Render Logic with Search & Starred Sort
function renderTable() {
    const tableBody = document.getElementById("tableBody");
    const sortBy = document.getElementById("sortBySelect").value;
    const searchVal = document.getElementById("searchProblemInput").value.toLowerCase();
    
    tableBody.innerHTML = "";
    
    // 1. Filter
    let filtered = allProblems.filter(p => {
        return !searchVal || p.problem.toLowerCase().includes(searchVal);
    });

    // 2. Sort
    filtered.sort((a, b) => {
       
        
        if (sortBy === 'tag') {
            const tagA = (a.tags && a.tags[0]) ? a.tags[0].toLowerCase() : "";
            const tagB = (b.tags && b.tags[0]) ? b.tags[0].toLowerCase() : "";
            if (tagA < tagB) return -1;
            if (tagA > tagB) return 1;
            return 0;
        }
        if (sortBy === 'revision') {
            const dateA = new Date(a.revisionDue).getTime();
            const dateB = new Date(b.revisionDue).getTime();
            return dateA - dateB;
        }
        if (sortBy === 'starred') {
            // Starred items come first
            if (a.starred && !b.starred) return -1;
            if (!a.starred && b.starred) return 1;
            return 0;
        }
        
        // Default / 'none': returns 0 to preserve original creation order
        return 0; 
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages} (${totalItems})`;
    
    document.getElementById("prevPageBtn").disabled = currentPage === 1;
    document.getElementById("nextPageBtn").disabled = currentPage === totalPages;
    document.getElementById("fastPrevBtn").disabled = currentPage === 1;
    document.getElementById("fastNextBtn").disabled = currentPage === totalPages;

    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    pageItems.forEach((p) => {
        const diff = new Date(p.revisionDue) - new Date();
        const daysLeft = Math.ceil(diff / 86400000); 
        const dayLabel = Math.abs(daysLeft) === 1 ? "day" : "days";
        
        let difficultyColor = p.difficulty === "Medium" ? "#f39c12" : p.difficulty === "Hard" ? "#e74c3c" : "#27ae60"; 
        
        let revisionColor = "#27ae60"; 
        let revisionText = `${daysLeft} ${dayLabel}`;
        if (daysLeft < 0) {
             revisionColor = "#e74c3c"; 
             revisionText = `${Math.abs(daysLeft)} ${dayLabel} ago`;
        } else if (daysLeft <= 1) {
             revisionColor = "#e67e22"; 
        }

        const hasNotes = p.conceptNotes || p.code || p.notes; 

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight:bold; color:#777;">#${p.serialNo}</td>
            <td>${p.problem}</td>
            <td style="color:${difficultyColor};">${p.difficulty}</td>
            <td>${hasNotes ? `<button onclick="viewNote('${p.id}')"><i class="fa-regular fa-eye"></i></button>` : "-"}</td>
            <td>${(p.tags || []).join(", ")}</td>
            <td style="color:${revisionColor}; white-space:nowrap;">
                ${revisionText}
                <button onclick="renewRevision('${p.id}')" title="Reset Timer (+7 days)" style="color:#27ae60; background:none; padding:0 5px; cursor:pointer;">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>
            </td>
            <td>${(p.practiceLinks || []).map(l => `<a href="${l}" target="_blank">${getWebsiteName(l)}</a>`).join(", ")}</td>
            <td class="star-cell"><button class="${p.starred ? "starred" : ""}" onclick="toggleStar('${p.id}', ${p.starred})">${p.starred ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>'}</button></td>
            <td class="action-cell">
                <button class="edit-btn" onclick="editProblem('${p.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="delete-btn" onclick="deleteProblem('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

window.renewRevision = async (id) => { 
    if(!currentUser) return; 
    const problem = allProblems.find(p => p.id === id); 
    if(!problem) return; 
    
    const intervalDays = 7; 
    const nextDate = new Date(); 
    nextDate.setDate(nextDate.getDate() + intervalDays); 
    const currentCount = problem.revisionCount || 0;
    
    await updateDoc(doc(db, "users", currentUser.uid, "problems", id), { 
        revisionDue: nextDate.toISOString(), 
        revisionCount: currentCount + 1,
        updatedAt: new Date()
    }); 
};

/* =========================================
   WIKI LOGIC (NEW: MODAL HANDLING)
   ========================================= */
function loadWikiNotes() {
    if (!currentUser) return;

    const settingsRef = doc(db, "users", currentUser.uid, "settings", "wikiPref");
    getDoc(settingsRef).then((docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            wikiTopicOrder = data.topicOrder || data.order || []; 
            wikiSubtopicOrder = data.subtopicOrder || {};
        }

        onSnapshot(collection(db, "users", currentUser.uid, "wiki"), (snap) => {
            allWikiNotes = [];
            snap.forEach(d => allWikiNotes.push({ id: d.id, ...d.data() }));
            window.filterWikiList();
        });
    });
}

window.viewWikiNote = (note) => {
    currentNoteId = note.id;
    
    document.getElementById("popupWikiTopic").textContent = note.topic || "Uncategorized";
    document.getElementById("popupWikiTitle").textContent = note.subtopic || "Untitled Note";
    
    let noteContent = note.textNotes || "<p style='color:#666; font-style:italic;'>No notes added.</p>";
    noteContent = noteContent.replace(/<a /g, '<a target="_blank" ');
    document.getElementById("popupWikiNotes").innerHTML = noteContent;

    if (wikiPopupEditor) {
        const code = note.code ?? note.content ?? "// No code saved.";
        wikiPopupEditor.setValue(code);
        setTimeout(() => wikiPopupEditor.layout(), 50);
    }
    document.getElementById("wikiModal").style.display = "flex";
};

window.closeWikiModal = () => { document.getElementById("wikiModal").style.display = "none"; };

window.editWikiFromPopup = () => { window.closeWikiModal(); window.editCurrentWiki(); };
window.deleteWikiFromPopup = async () => { window.closeWikiModal(); window.deleteWikiNote(); };

// UPDATED: Open Edit Modal instead of splitting screen
window.editCurrentWiki = () => {
    if (!currentNoteId) return;
    const note = allWikiNotes.find(n => n.id === currentNoteId);
    if (!note) return;

    document.getElementById("wikiEditModal").style.display = "flex";

    document.getElementById('wikiTopic').value = note.topic || "";
    document.getElementById('wikiSubtopic').value = note.subtopic || "";
    document.getElementById('wikiTextNotes').innerHTML = note.textNotes || "";
    
    if(wikiEditor) {
        const code = note.code ?? note.content ?? "";
        wikiEditor.setValue(code);
        setTimeout(() => wikiEditor.layout(), 50);
    }
};

window.closeWikiEditModal = () => {
    document.getElementById("wikiEditModal").style.display = "none";
    currentNoteId = null;
    document.querySelectorAll('.wiki-item').forEach(el => el.classList.remove('active'));
};

window.createNewNote = () => {
    currentNoteId = null;
    document.getElementById("wikiEditModal").style.display = "flex";
    
    document.getElementById('wikiTopic').value = "";
    document.getElementById('wikiSubtopic').value = "";
    document.getElementById('wikiTextNotes').innerHTML = "";
    
    // NEW: Load Draft for Wiki
    loadWikiDraft();

    if(wikiEditor) {
        // Only set default if draft didn't populate code
        if (!wikiEditor.getValue() || wikiEditor.getValue().trim() === "") {
             wikiEditor.setValue("// Code implementation goes here...");
        }
        setTimeout(() => wikiEditor.layout(), 50);
    }
    document.querySelectorAll('.wiki-item').forEach(el => el.classList.remove('active'));
};

window.saveWikiNote = async () => {
    if (!currentUser) return alert("Login required");
    const isTopicValid = validateField("wikiTopic", "Required");
    const isSubtopicValid = validateField("wikiSubtopic", "Required");
    if (!isTopicValid || !isSubtopicValid) return;

    const topic = document.getElementById('wikiTopic').value.trim();
    const subtopic = document.getElementById('wikiSubtopic').value.trim();
    const textNotes = document.getElementById('wikiTextNotes').innerHTML;
    const codeContent = wikiEditor ? wikiEditor.getValue() : "";

    const data = {
        topic: topic, subtopic: subtopic, title: subtopic, 
        textNotes: textNotes, code: codeContent, updatedAt: new Date().toISOString()
    };
    
    try {
        const ref = collection(db, "users", currentUser.uid, "wiki");
        let noteToView = { ...data };
        
        if (currentNoteId) {
            await updateDoc(doc(ref, currentNoteId), data);
            noteToView.id = currentNoteId;
        } else { 
            const docRef = await addDoc(ref, data); 
            currentNoteId = docRef.id;
            noteToView.id = docRef.id;
        }
        
        showSaveStatus("Saved successfully!");
        // CLEAR DRAFT ON SUCCESS
        localStorage.removeItem(DRAFT_KEY_WIKI);

        loadWikiNotes(); 
        window.closeWikiEditModal();
        window.viewWikiNote(noteToView);

    } catch (e) { showSaveStatus("Error", true); console.error(e); }
};

window.filterWikiList = () => {
    const query = document.getElementById("wikiSearch").value.toLowerCase();
    const filtered = allWikiNotes.filter(n => (n.topic||"").toLowerCase().includes(query) || (n.subtopic||"").toLowerCase().includes(query));
    renderWikiList(filtered);
};

// ... (Rest of Wiki Logic - Drag Drop etc. - remains same) ...
async function saveWikiPreferences() {
    if (!currentUser) return;
    try {
        const settingsRef = doc(db, "users", currentUser.uid, "settings", "wikiPref");
        await setDoc(settingsRef, { 
            topicOrder: wikiTopicOrder,
            subtopicOrder: wikiSubtopicOrder
        }, { merge: true });
    } catch (e) { console.error("Error saving prefs:", e); }
}

function addDragHandlers(el, type, id, parentId = null) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, parentId }));
        el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => { el.classList.remove('drag-over'); });
    el.addEventListener('drop', (e) => {
        e.stopPropagation(); e.preventDefault();
        el.classList.remove('drag-over');
        const dataStr = e.dataTransfer.getData('text/plain');
        if (!dataStr) return;
        const srcData = JSON.parse(dataStr);
        if (srcData.type !== type) return; 
        if (type === 'topic') handleTopicDrop(srcData.id, id); 
        else if (type === 'subtopic') {
            if (srcData.parentId !== parentId) return; 
            handleSubtopicDrop(parentId, srcData.id, id);
        }
    });
}
function handleTopicDrop(srcKey, targetKey) {
    if (srcKey === targetKey) return;
    const srcIdx = wikiTopicOrder.indexOf(srcKey);
    const targetIdx = wikiTopicOrder.indexOf(targetKey);
    if (srcIdx === -1 || targetIdx === -1) return;
    wikiTopicOrder.splice(srcIdx, 1);
    wikiTopicOrder.splice(targetIdx, 0, srcKey);
    window.filterWikiList();
    saveWikiPreferences();
}
function handleSubtopicDrop(parentKey, srcId, targetId) {
    if (srcId === targetId) return;
    const order = wikiSubtopicOrder[parentKey] || [];
    const srcIdx = order.indexOf(srcId);
    const targetIdx = order.indexOf(targetId);
    if (srcIdx === -1 || targetIdx === -1) return;
    order.splice(srcIdx, 1);
    order.splice(targetIdx, 0, srcId);
    wikiSubtopicOrder[parentKey] = order;
    window.filterWikiList();
    saveWikiPreferences();
}

function renderWikiList(notes) {
    const list = document.getElementById('wikiList');
    list.innerHTML = "";
    const grouped = {};
    notes.forEach(note => {
        const topic = (note.topic || "UNCATEGORIZED").trim(); 
        const key = topic.toUpperCase();
        if (!grouped[key]) grouped[key] = { name: topic, notes: [] };
        grouped[key].notes.push(note);
    });
    let currentKeys = Object.keys(grouped);
    currentKeys.sort((a, b) => {
        let indexA = wikiTopicOrder.indexOf(a);
        let indexB = wikiTopicOrder.indexOf(b);
        if (indexA === -1) indexA = 9999;
        if (indexB === -1) indexB = 9999;
        return indexA === 9999 && indexB === 9999 ? a.localeCompare(b) : indexA - indexB;
    });
    wikiTopicOrder = currentKeys;
    currentKeys.forEach((key) => {
        const group = grouped[key];
        let subOrder = wikiSubtopicOrder[key] || [];
        group.notes.sort((a, b) => {
            let ia = subOrder.indexOf(a.id);
            let ib = subOrder.indexOf(b.id);
            if (ia === -1) ia = 9999;
            if (ib === -1) ib = 9999;
            return ia === 9999 && ib === 9999 ? a.subtopic.localeCompare(b.subtopic) : ia - ib;
        });
        wikiSubtopicOrder[key] = group.notes.map(n => n.id);
        const hasActiveNote = group.notes.some(n => n.id === currentNoteId);
        if (expandedTopics[key] === undefined) expandedTopics[key] = hasActiveNote;
        const isOpen = expandedTopics[key];
        const header = document.createElement('div');
        header.className = "wiki-topic-header";
        addDragHandlers(header, 'topic', key);
        header.onclick = () => {
            expandedTopics[key] = !expandedTopics[key];
            const container = document.getElementById(`wiki-group-${key}`);
            const icon = document.getElementById(`wiki-icon-${key}`);
            if (expandedTopics[key]) {
                container.style.display = "block";
                icon.style.transform = "rotate(90deg)";
            } else {
                container.style.display = "none";
                icon.style.transform = "rotate(0deg)";
            }
        };
        const titleDiv = document.createElement('div');
        titleDiv.style.display = "flex"; titleDiv.style.alignItems = "center";
        const caret = document.createElement('span');
        caret.id = `wiki-icon-${key}`;
        caret.className = "header-toggle-icon";
        caret.innerHTML = '<i class="fa-solid fa-caret-right"></i>';
        if (isOpen) caret.style.transform = "rotate(90deg)";
        const textSpan = document.createElement('span');
        textSpan.innerHTML = `<i class="fa-regular fa-folder"></i> ${group.name}`;
        titleDiv.appendChild(caret);
        titleDiv.appendChild(textSpan);
        header.appendChild(titleDiv);
        list.appendChild(header);
        const subContainer = document.createElement('div');
        subContainer.id = `wiki-group-${key}`;
        subContainer.className = "wiki-subtopic-container";
        if (isOpen) subContainer.style.display = "block";
        group.notes.forEach((note) => {
            const div = document.createElement('div');
            div.className = `wiki-item ${currentNoteId === note.id ? 'active' : ''}`;
            addDragHandlers(div, 'subtopic', note.id, key);
            div.onclick = (e) => { e.stopPropagation(); window.viewWikiNote(note); };
            const itemTitle = document.createElement('div');
            itemTitle.className = "wiki-item-title";
            itemTitle.innerHTML = `• ${note.subtopic}`;
            div.appendChild(itemTitle);
            subContainer.appendChild(div);
        });
        list.appendChild(subContainer);
    });
}

// CUSTOM CONFIRMATION MODAL LOGIC
let pendingDeleteAction = null;
window.showConfirm = (message, actionCallback) => {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const btn = document.getElementById('confirmBtn');
    if (modal && msgEl && btn) {
        msgEl.textContent = message;
        pendingDeleteAction = actionCallback;
        modal.style.display = 'flex';
        btn.onclick = async () => {
            if (pendingDeleteAction) await pendingDeleteAction();
            window.closeConfirmModal();
        };
    }
};
window.closeConfirmModal = () => {
    document.getElementById('confirmModal').style.display = 'none';
    pendingDeleteAction = null;
};
window.deleteProblem = (id) => { 
    window.showConfirm("Are you sure you want to delete this problem? This cannot be undone.", async () => {
        await deleteDoc(doc(db, "users", currentUser.uid, "problems", id));
    });
};
window.deleteWikiNote = async () => { 
    if (!currentNoteId) return;
    window.showConfirm("Are you sure you want to delete this note? It will be lost forever.", async () => {
        await deleteDoc(doc(db, "users", currentUser.uid, "wiki", currentNoteId)); 
        window.createNewNote(); 
    });
};
window.toggleStar = async (id, current) => { await updateDoc(doc(db, "users", currentUser.uid, "problems", id), { starred: !current }); };
window.viewNote = (id) => {
    const p = allProblems.find(x => x.id === id);
    if (!p) return;
    const splitWrapper = document.getElementById('modalSplit');
    if(splitWrapper) splitWrapper.classList.remove('layout-stacked');
    const notePanel = document.getElementById('modalNotesPanel');
    const codePanel = document.getElementById('modalCodePanel');
    if(notePanel) notePanel.classList.remove('collapsed');
    if(codePanel) codePanel.classList.remove('collapsed');
    let noteContent = p.conceptNotes || "<p style='color:#666; font-style:italic;'>No concept notes added.</p>";
    noteContent = noteContent.replace(/<a /g, '<a target="_blank" ');
    document.getElementById("modalTextDisplay").innerHTML = noteContent;
    if (monacoModalEditor) {
        const codeContent = p.code ?? p.notes ?? "// No implementation code saved.";
        monacoModalEditor.setValue(codeContent);
        setTimeout(() => monacoModalEditor.layout(), 100);
    }
    document.getElementById("noteModal").style.display = "flex";
};
window.closeNoteModal = () => document.getElementById("noteModal").style.display = "none";

window.editProblem = (id) => {
    const p = allProblems.find(x => x.id === id);
    if (!p) return;
    editId = id;
    
    // Set Values
    document.getElementById("problem").value = p.problem;
    document.getElementById("difficulty").value = p.difficulty;
    document.getElementById("tags").value = (p.tags || []).join(", ");
    document.getElementById("problemTextNotes").innerHTML = p.conceptNotes || ""; 
    
    currentPracticeLinks = p.practiceLinks || [];
    renderPracticeLinksPreview();

    // Open Modal
    toggleAddMode(true);
    
    // Set Monaco Value *after* opening modal
    const codeToLoad = p.code ?? p.notes ?? ""; 
    if(monacoEditor) { 
        monacoEditor.setValue(codeToLoad); 
        setTimeout(() => monacoEditor.layout(), 100); 
    }
};

if (localStorage.getItem("darkMode") === "on") document.body.classList.add("dark");
