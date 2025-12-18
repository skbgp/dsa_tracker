import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc
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

/* =========================================
   MONACO EDITORS SETUP
   ========================================= */
let monacoEditor = null;      
let monacoModalEditor = null; 
let wikiEditor = null;        

require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    const editorEl = document.getElementById('monacoEditor');
    if (editorEl) {
        monacoEditor = monaco.editor.create(editorEl, {
            value: '// Write your code implementation here...', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });
        monacoEditor.onDidFocusEditorText(() => {
            if (monacoEditor.getValue().includes('// Write your code')) monacoEditor.setValue('');
        });
    }

    const modalEl = document.getElementById('monacoModalEditor');
    if (modalEl) {
        monacoModalEditor = monaco.editor.create(modalEl, {
            value: '', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: true }, readOnly: true, fontSize: 13
        });
    }

    const wikiEl = document.getElementById('wikiMonaco');
    if (wikiEl) {
        wikiEditor = monaco.editor.create(wikiEl, {
            value: '// Code implementation goes here...',
            language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });
        wikiEditor.onDidFocusEditorText(() => {
            if (wikiEditor.getValue().includes('// Code implementation')) wikiEditor.setValue('');
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
    if (context === 'wikiView') { container = document.getElementById('wiki-view'); editorToRefresh = wikiEditor; }
    else if (context === 'problemForm') { container = document.getElementById('problemForm'); editorToRefresh = monacoEditor; }
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
    }, 300);
};

function enableAutoLinking(editorId) {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    editor.addEventListener('keydown', (e) => { // Using keydown to catch before newline triggers
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
let currentNoteId = null;
let allWikiNotes = [];

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
    
    // Global Link Handler
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.closest('.editor-content')) {
            link.target = '_blank';
        }
    });
});

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
    if (tab === 'wiki' && wikiEditor) setTimeout(() => wikiEditor.layout(), 100);
    if (tab === 'tracker' && monacoEditor) setTimeout(() => monacoEditor.layout(), 100);
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
window.removePracticeLink = (index) => { currentPracticeLinks.splice(index, 1); renderPracticeLinksPreview(); };
const addLinkBtn = document.getElementById("addPracticeLinkBtn");
if (addLinkBtn) {
    addLinkBtn.onclick = () => {
        const input = document.getElementById("practiceLinkInput");
        const link = input.value.trim();
        if (!link) { alert("Please paste a link first"); return; }
        currentPracticeLinks.push(link);
        input.value = "";
        renderPracticeLinksPreview();
    };
}

/* =========================================
   AUTOCOMPLETE (KEYBOARD SUPPORT ADDED)
   ========================================= */
const filterTag = document.getElementById("filterTag");
const filterTagBox = document.getElementById("tagSuggestionsBox");
const tagsInput = document.getElementById("tags");
const formTagBox = document.getElementById("tagInputSuggestionsBox");
const wikiTopicInput = document.getElementById("wikiTopic");
const wikiTopicBox = document.getElementById("wikiTopicSuggestionsBox");

let filterFocusIndex = -1;
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

// 1. Filter Search with Keyboard
if (filterTag && filterTagBox) {
    filterTag.addEventListener("input", () => {
        const query = filterTag.value.trim().toLowerCase();
        filterFocusIndex = -1; 
        if (!query) { filterTagBox.style.display = "none"; return; }
        const matches = allTags.filter((tag) => tag.toLowerCase().includes(query));
        renderSuggestions(matches, filterTagBox, (selectedTag) => {
            filterTag.value = selectedTag;
            filterTagBox.style.display = "none";
            currentPage = 1;
            renderTable();
        }, filterFocusIndex);
    });
    filterTag.addEventListener("keydown", (e) => {
        const items = filterTagBox.getElementsByClassName("suggestion-item");
        if (filterTagBox.style.display === "none") return;
        if (e.key === "ArrowDown") { e.preventDefault(); filterFocusIndex = (filterFocusIndex + 1) % items.length; updateActiveItem(items, filterFocusIndex); }
        else if (e.key === "ArrowUp") { e.preventDefault(); filterFocusIndex = (filterFocusIndex - 1 + items.length) % items.length; updateActiveItem(items, filterFocusIndex); }
        else if (e.key === "Enter") { e.preventDefault(); if (items[filterFocusIndex]) items[filterFocusIndex].click(); }
        else if (e.key === "Escape") filterTagBox.style.display = "none";
    });
}

// 2. Add Form Tags with Keyboard
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

// 3. Wiki Topic with Keyboard
if (wikiTopicInput && wikiTopicBox) {
    wikiTopicInput.addEventListener("input", () => {
        const query = wikiTopicInput.value.trim().toLowerCase();
        wikiTopicFocusIndex = -1;
        if (!query) { wikiTopicBox.style.display = "none"; return; }
        const uniqueTopics = [...new Set(allWikiNotes.map(n => n.topic || "").filter(Boolean))];
        const matches = uniqueTopics.filter(t => t.toLowerCase().includes(query));
        renderSuggestions(matches, wikiTopicBox, (selectedTopic) => {
            wikiTopicInput.value = selectedTopic;
            wikiTopicBox.style.display = "none";
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
    if (filterTagBox && !filterTagBox.contains(e.target) && e.target !== filterTag) filterTagBox.style.display = "none";
    if (formTagBox && !formTagBox.contains(e.target) && e.target !== tagsInput) formTagBox.style.display = "none";
    if (wikiTopicBox && !wikiTopicBox.contains(e.target) && e.target !== wikiTopicInput) wikiTopicBox.style.display = "none";
});


/* =========================================
   TRACKER LOGIC
   ========================================= */
function loadProblems() {
    if(!currentUser) return;
    const ref = collection(db, "users", currentUser.uid, "problems");
    onSnapshot(ref, (snap) => {
        allProblems = []; allTags = [];
        snap.forEach((d) => {
            const p = { id: d.id, ...d.data() };
            allProblems.push(p);
            (p.tags || []).forEach((tag) => allTags.push(tag));
        });

        // ----------------------------------------------------
        // SORTING: Oldest FIRST (index 0) -> Newest LAST (end of list)
        // ----------------------------------------------------
        allProblems.sort((a, b) => {
            // Helper to handle Firestore Timestamp objects or JS Date strings
            const getTime = (p) => {
                if (!p.updatedAt) return 0;
                // If it's a Firestore Timestamp, it has .toDate()
                if (typeof p.updatedAt.toDate === 'function') return p.updatedAt.toDate().getTime();
                // Otherwise assume it's a date string or object
                return new Date(p.updatedAt).getTime();
            };
            
            return getTime(a) - getTime(b); // Ascending Order
        });

        allTags = [...new Set(allTags)];
        renderTable();
    });
}

document.getElementById("openAddFormBtn").onclick = () => {
    document.getElementById("problemForm").style.display = "block";
    if(monacoEditor) monacoEditor.setValue('// Write your code implementation here...');
    document.getElementById("problemTextNotes").innerHTML = ""; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

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
        const revisionDate = new Date();
        revisionDate.setDate(revisionDate.getDate() + 7);

        const baseData = {
            problem: problemInput.value.trim(),
            difficulty: difficultySelect.value,
            conceptNotes: notesInput.innerHTML, 
            code: getMonacoValue(),
            practiceLinks: currentPracticeLinks, 
            tags: cleanTags,
            updatedAt: new Date()
        };

        try {
            const ref = collection(db, "users", currentUser.uid, "problems");
            if (editId) await updateDoc(doc(ref, editId), baseData); 
            else await addDoc(ref, { ...baseData, starred: false, revisionCount: 0, revisionDue: revisionDate.toISOString() });
            closeProblemForm();
            renderTable();
        } catch (error) { console.error(error); alert("Error saving: " + error.message); }
    };
}

function renderTable() {
    const tableBody = document.getElementById("tableBody");
    const filterTagVal = document.getElementById("filterTag").value.toLowerCase();
    const onlyStarred = document.getElementById("starFilterToggle").checked;
    tableBody.innerHTML = "";
    let filtered = allProblems.filter(p => !filterTagVal || (p.tags || []).some(t => t.toLowerCase().includes(filterTagVal)));
    if (onlyStarred) filtered = filtered.filter(p => p.starred);

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages} (${totalItems})`;
    document.getElementById("prevPageBtn").disabled = currentPage === 1;
    document.getElementById("nextPageBtn").disabled = currentPage === totalPages;

    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    pageItems.forEach((p, index) => {
        const diff = new Date(p.revisionDue) - new Date();
        const daysLeft = Math.max(0, Math.ceil(diff / 86400000)); 
        const dayLabel = daysLeft === 1 ? "day" : "days";
        let difficultyColor = p.difficulty === "Medium" ? "#f39c12" : p.difficulty === "Hard" ? "#e74c3c" : "#27ae60"; 
        let revisionColor = "#27ae60"; 
        if (daysLeft <= 1) revisionColor = "#e74c3c"; 

        const hasNotes = p.conceptNotes || p.code || p.notes; 

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${(currentPage - 1) * PAGE_SIZE + index + 1}</td>
            <td>${p.problem}</td>
            <td style="color:${difficultyColor};">${p.difficulty}</td>
            <td>${hasNotes ? `<button onclick="viewNote('${p.id}')"><i class="fa-regular fa-eye"></i></button>` : "-"}</td>
            <td>${(p.tags || []).join(", ")}</td>
            <td style="color:${revisionColor};">${daysLeft} ${dayLabel}</td>
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

window.renewRevision = async (id) => { if(!currentUser) return; const problem = allProblems.find(p => p.id === id); if(!problem) return; const currentCount = problem.revisionCount || 0; const newCount = currentCount + 1; const intervalDays = 7 * (newCount + 1); const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + intervalDays); await updateDoc(doc(db, "users", currentUser.uid, "problems", id), { revisionDue: nextDate.toISOString(), revisionCount: newCount, updatedAt: new Date() }); };

/* =========================================
   WIKI LOGIC
   ========================================= */
function loadWikiNotes() {
    if (!currentUser) return;
    onSnapshot(collection(db, "users", currentUser.uid, "wiki"), (snap) => {
        allWikiNotes = [];
        snap.forEach(d => allWikiNotes.push({ id: d.id, ...d.data() }));
        window.filterWikiList();
    });
}

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
        if (currentNoteId) await updateDoc(doc(ref, currentNoteId), data);
        else { const docRef = await addDoc(ref, data); currentNoteId = docRef.id; }
        showSaveStatus("Saved successfully!");
        loadWikiNotes(); 
    } catch (e) { showSaveStatus("Error", true); }
};

window.createNewNote = () => {
    currentNoteId = null;
    document.getElementById('wikiTopic').value = "";
    document.getElementById('wikiSubtopic').value = "";
    document.getElementById('wikiTextNotes').innerHTML = "";
    if(wikiEditor) wikiEditor.setValue("// Code implementation goes here...");
    document.querySelectorAll('.wiki-item').forEach(el => el.classList.remove('active'));
};

window.filterWikiList = () => {
    const query = document.getElementById("wikiSearch").value.toLowerCase();
    const filtered = allWikiNotes.filter(n => (n.topic||"").toLowerCase().includes(query) || (n.subtopic||"").toLowerCase().includes(query));
    renderWikiList(filtered);
};

function renderWikiList(notes) {
    const list = document.getElementById('wikiList');
    list.innerHTML = "";
    const grouped = {};
    notes.forEach(note => {
        const topic = (note.topic || "UNCATEGORIZED").toUpperCase();
        if (!grouped[topic]) grouped[topic] = [];
        grouped[topic].push(note);
    });

    Object.keys(grouped).sort().forEach(topic => {
        const header = document.createElement('div');
        header.className = "wiki-topic-header";
        header.innerHTML = `<i class="fa-solid fa-folder"></i> ${topic}`;
        list.appendChild(header);
        grouped[topic].forEach(note => {
            const div = document.createElement('div');
            div.className = `wiki-item ${currentNoteId === note.id ? 'active' : ''}`;
            div.onclick = () => {
                currentNoteId = note.id;
                document.getElementById('wikiTopic').value = note.topic || "";
                document.getElementById('wikiSubtopic').value = note.subtopic || "";
                
                document.getElementById('wikiTextNotes').innerHTML = note.textNotes || "";
                const codeToLoad = note.code ?? note.content ?? "// No code saved";
                if(wikiEditor) { wikiEditor.setValue(codeToLoad); setTimeout(() => wikiEditor.layout(), 50); }
                window.filterWikiList();
            };
            div.innerHTML = `<div class="wiki-item-title">• ${note.subtopic}</div>`;
            list.appendChild(div);
        });
    });
}

window.deleteWikiNote = async () => { if(currentNoteId && confirm("Delete?")) { await deleteDoc(doc(db, "users", currentUser.uid, "wiki", currentNoteId)); window.createNewNote(); } };

/* =========================================
   HELPER FUNCTIONS & MODALS
   ========================================= */
if (localStorage.getItem("darkMode") === "on") document.body.classList.add("dark");
document.getElementById("prevPageBtn").onclick = () => { if(currentPage > 1) { currentPage--; renderTable(); } };
document.getElementById("nextPageBtn").onclick = () => { currentPage++; renderTable(); };

window.closeProblemForm = () => {
    document.getElementById("problemForm").style.display = "none";
    editId = null;
    currentPracticeLinks = [];
    renderPracticeLinksPreview();
    document.getElementById("problem").value = "";
    document.getElementById("tags").value = "";
    document.getElementById("problemTextNotes").innerHTML = ""; 
    document.querySelectorAll('.error-text').forEach(e => e.remove());
    document.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));
    if(monacoEditor) monacoEditor.setValue('');
};

window.editProblem = (id) => {
    const p = allProblems.find(x => x.id === id);
    if (!p) return;
    editId = id;
    document.getElementById("problem").value = p.problem;
    document.getElementById("difficulty").value = p.difficulty;
    document.getElementById("tags").value = (p.tags || []).join(", ");
    
    document.getElementById("problemTextNotes").innerHTML = p.conceptNotes || ""; 
    const codeToLoad = p.code ?? p.notes ?? ""; 
    if(monacoEditor) { monacoEditor.setValue(codeToLoad); setTimeout(() => monacoEditor.layout(), 50); }
    
    currentPracticeLinks = p.practiceLinks || [];
    renderPracticeLinksPreview();
    document.getElementById("problemForm").style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteProblem = async (id) => { if(confirm("Delete?")) await deleteDoc(doc(db, "users", currentUser.uid, "problems", id)); };
window.toggleStar = async (id, current) => { await updateDoc(doc(db, "users", currentUser.uid, "problems", id), { starred: !current }); };

// View Note Modal Logic
window.viewNote = (id) => {
    const p = allProblems.find(x => x.id === id);
    if (!p) return;

    // Reset Modal Layout
    const splitWrapper = document.getElementById('modalSplit');
    if(splitWrapper) splitWrapper.classList.remove('layout-stacked');
    const notePanel = document.getElementById('modalNotesPanel');
    const codePanel = document.getElementById('modalCodePanel');
    if(notePanel) notePanel.classList.remove('collapsed');
    if(codePanel) codePanel.classList.remove('collapsed');

    // Populate Data
    let noteContent = p.conceptNotes || "<p style='color:#666; font-style:italic;'>No concept notes added.</p>";
    // Ensure links open in new tab
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

document.getElementById("toggleSortBtn").onclick = () => { document.getElementById("sortPanel").style.display = document.getElementById("sortPanel").style.display === "none" ? "flex" : "none"; };
document.getElementById("applyFilterBtn").onclick = () => { currentPage = 1; renderTable(); };
document.getElementById("resetFilterBtn").onclick = () => { document.getElementById("filterTag").value = ""; renderTable(); };
