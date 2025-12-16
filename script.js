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
            value: '', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });
    }

    const modalEl = document.getElementById('monacoModalEditor');
    if (modalEl) {
        monacoModalEditor = monaco.editor.create(modalEl, {
            value: '', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: true }, readOnly: true, fontSize: 14
        });
    }

    const wikiEl = document.getElementById('wikiMonaco');
    if (wikiEl) {
        wikiEditor = monaco.editor.create(wikiEl, {
            value: '// Select a note to view or create new...',
            language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });

        // === FIX: Auto-delete placeholder on focus ===
        wikiEditor.onDidFocusEditorText(() => {
            const val = wikiEditor.getValue().trim();
            // Check if current text is one of the default placeholders
            if (val === '// Select a note to view or create new...') {
                wikiEditor.setValue(''); // Clear it automatically
            }
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

function getMonacoValue() {
    return monacoEditor ? monacoEditor.getValue() : '';
}

/* =========================================
   GLOBAL STATE
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

/* =========================================
   INITIALIZATION & AUTH
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById("googleBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (googleBtn) {
        googleBtn.onclick = async () => {
            try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
            catch (err) { console.error("Login Failed:", err); }
        };
    }
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
        if(authSection) authSection.style.display = "block";
        if(appSection) appSection.style.display = "none";
    }
});

/* =========================================
   TABS
   ========================================= */
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
    if (tab === 'wiki' && wikiEditor) setTimeout(() => wikiEditor.layout(), 50);
};

/* =========================================
   TRACKER HELPER
   ========================================= */
function getWebsiteName(url) {
    try {
        const domain = new URL(url).hostname.replace("www.", "");
        if (domain.includes("leetcode")) return "LeetCode";
        if (domain.includes("geeksforgeeks")) return "GFG";
        if (domain.includes("codeforces")) return "Codeforces";
        if (domain.includes("hackerrank")) return "HackerRank";
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
   AUTOCOMPLETE
   ========================================= */
let filterFocusIndex = -1;
let addFormFocusIndex = -1;
let wikiTopicFocusIndex = -1;

const filterTag = document.getElementById("filterTag");
const filterTagBox = document.getElementById("tagSuggestionsBox");
const tagsInput = document.getElementById("tags");
const formTagBox = document.getElementById("tagInputSuggestionsBox");
const wikiTopicInput = document.getElementById("wikiTopic");
const wikiTopicBox = document.getElementById("wikiTopicSuggestionsBox");

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
        else if (e.key === "Enter") { e.preventDefault(); if (items[filterFocusIndex]) items[filterFocusIndex].click(); else if (items.length) items[0].click(); }
        else if (e.key === "Escape") filterTagBox.style.display = "none";
    });
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
        }, addFormFocusIndex);
    });
    tagsInput.addEventListener("keydown", (e) => {
        const items = formTagBox.getElementsByClassName("suggestion-item");
        if (formTagBox.style.display === "none") return;
        if (e.key === "ArrowDown") { e.preventDefault(); addFormFocusIndex = (addFormFocusIndex + 1) % items.length; updateActiveItem(items, addFormFocusIndex); }
        else if (e.key === "ArrowUp") { e.preventDefault(); addFormFocusIndex = (addFormFocusIndex - 1 + items.length) % items.length; updateActiveItem(items, addFormFocusIndex); }
        else if (e.key === "Enter") { e.preventDefault(); if (items[addFormFocusIndex]) items[addFormFocusIndex].click(); else if (items.length) items[0].click(); }
        else if (e.key === "Escape") formTagBox.style.display = "none";
    });
}

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
        else if (e.key === "Enter") { e.preventDefault(); if (items[wikiTopicFocusIndex]) items[wikiTopicFocusIndex].click(); else if (items.length) items[0].click(); }
        else if (e.key === "Escape") wikiTopicBox.style.display = "none";
    });
}

document.addEventListener("click", (e) => {
    if (filterTagBox && !filterTagBox.contains(e.target) && e.target !== filterTag) filterTagBox.style.display = "none";
    if (formTagBox && !formTagBox.contains(e.target) && e.target !== tagsInput) formTagBox.style.display = "none";
    if (wikiTopicBox && !wikiTopicBox.contains(e.target) && e.target !== wikiTopicInput) wikiTopicBox.style.display = "none";
});

/* =========================================
   TRACKER DATA
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
        allTags = [...new Set(allTags)];
        renderTable();
    });
}

const saveBtn = document.getElementById("saveProblemBtn");
if (saveBtn) {
    saveBtn.onclick = async () => {
        if (!currentUser) return;
        const problemInput = document.getElementById("problem");
        const difficultySelect = document.getElementById("difficulty");
        const tagsInput = document.getElementById("tags");
        const cleanTags = tagsInput.value.split(",").map((t) => t.trim()).filter(Boolean);
        const revisionDate = new Date();
        revisionDate.setDate(revisionDate.getDate() + 7);

        const baseData = {
            problem: problemInput.value.trim(),
            difficulty: difficultySelect.value,
            notes: getMonacoValue(),
            practiceLinks: currentPracticeLinks, 
            tags: cleanTags,
            updatedAt: new Date()
        };

        try {
            const ref = collection(db, "users", currentUser.uid, "problems");
            if (editId) { await updateDoc(doc(ref, editId), baseData); } 
            else { await addDoc(ref, { ...baseData, starred: false, revisionCount: 0, revisionDue: revisionDate.toISOString() }); }
            closeProblemForm();
            renderTable();
        } catch (error) { alert("Error saving: " + error.message); }
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
        
        let difficultyColor = "#27ae60"; 
        if (p.difficulty === "Medium") difficultyColor = "#f39c12"; 
        if (p.difficulty === "Hard") difficultyColor = "#e74c3c";   

        let revisionColor = "#27ae60"; 
        let isDue = Math.ceil(diff / 86400000) <= 0;
        
        let revisionBtnHtml = isDue 
            ? `<button onclick="renewRevision('${p.id}')" style="margin-left:5px; font-size:12px;" title="Reset Revision"><i class="fa-solid fa-rotate-right"></i></button>`
            : `<button class="locked-btn" disabled><i class="fa-solid fa-lock"></i></button>`;
        
        if (daysLeft <= 1) revisionColor = "#e74c3c"; 
        else if (daysLeft <= 4) revisionColor = "#f39c12";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${(currentPage - 1) * PAGE_SIZE + index + 1}</td>
            <td>${p.problem}</td>
            <td style="color:${difficultyColor};">${p.difficulty}</td>
            <td>${p.notes ? `<button onclick="viewNote('${p.id}')"><i class="fa-regular fa-eye"></i></button>` : "-"}</td>
            <td>${(p.tags || []).join(", ")}</td>
            <td style="color:${revisionColor};">${daysLeft} days ${revisionBtnHtml}</td>
            <td>${(p.practiceLinks || []).map(l => `<a href="${l}" target="_blank">${getWebsiteName(l)}</a>`).join(", ")}</td>
            <td class="star-cell">
                <button class="${p.starred ? "starred" : ""}" onclick="toggleStar('${p.id}', ${p.starred})">
                    ${p.starred ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>'}
                </button>
            </td>
            <td>
                <button class="edit-btn" onclick="editProblem('${p.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="delete-btn" onclick="deleteProblem('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

window.renewRevision = async (id) => {
    if (!currentUser) return;
    const problem = allProblems.find(p => p.id === id);
    if (!problem) return;
    const currentCount = problem.revisionCount || 0;
    const newCount = currentCount + 1;
    const intervalDays = 7 * (newCount + 1); 
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);
    await updateDoc(doc(db, "users", currentUser.uid, "problems", id), { revisionDue: nextDate.toISOString(), revisionCount: newCount, updatedAt: new Date() });
};

/* =========================================
   WIKI LOGIC
   ========================================= */
function loadWikiNotes() {
    if (!currentUser) return;
    const ref = collection(db, "users", currentUser.uid, "wiki");
    onSnapshot(ref, (snap) => {
        allWikiNotes = [];
        snap.forEach(d => allWikiNotes.push({ id: d.id, ...d.data() }));
        window.filterWikiList();
    });
}

window.saveWikiNote = async () => {
    if (!currentUser) return alert("Login required");
    const topic = document.getElementById('wikiTopic').value.trim();
    const subtopic = document.getElementById('wikiSubtopic').value.trim();
    if (!topic || !subtopic) return alert("Topic and Subtopic are required");

    const data = {
        topic: topic,
        subtopic: subtopic,
        title: subtopic, 
        content: wikiEditor ? wikiEditor.getValue() : "",
        updatedAt: new Date().toISOString()
    };
    
    const ref = collection(db, "users", currentUser.uid, "wiki");
    try {
        if (currentNoteId) await updateDoc(doc(ref, currentNoteId), data);
        else { const docRef = await addDoc(ref, data); currentNoteId = docRef.id; }
        alert("Wiki Note Saved!");
    } catch (e) { console.error(e); alert("Error saving note"); }
};

window.deleteWikiNote = async () => {
    if (!currentNoteId || !confirm("Delete this note?")) return;
    await deleteDoc(doc(db, "users", currentUser.uid, "wiki", currentNoteId));
    window.createNewNote();
};

window.createNewNote = () => {
    currentNoteId = null;
    document.getElementById('wikiTopic').value = "";
    document.getElementById('wikiSubtopic').value = "";
    if(wikiEditor) wikiEditor.setValue("// Select a note to view or create new...");
    document.querySelectorAll('.wiki-item').forEach(el => el.classList.remove('active'));
};

/* === WIKI SEARCH & LIST NAVIGATION === */
let wikiSearchIndex = -1;
const wikiSearchInput = document.getElementById("wikiSearch");

window.filterWikiList = () => {
    wikiSearchIndex = -1;
    const query = wikiSearchInput.value.toLowerCase();
    const filtered = allWikiNotes.filter(note => {
        const top = (note.topic || "").toLowerCase();
        const sub = (note.subtopic || "").toLowerCase();
        return top.includes(query) || sub.includes(query);
    });
    renderWikiList(filtered);
};

if (wikiSearchInput) {
    wikiSearchInput.addEventListener("keydown", (e) => {
        const list = document.getElementById('wikiList');
        const items = Array.from(list.querySelectorAll('.wiki-item'));
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            wikiSearchIndex++;
            if (wikiSearchIndex >= items.length) wikiSearchIndex = 0;
            updateActiveWikiItem(items, wikiSearchIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            wikiSearchIndex--;
            if (wikiSearchIndex < 0) wikiSearchIndex = items.length - 1;
            updateActiveWikiItem(items, wikiSearchIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (wikiSearchIndex > -1 && items[wikiSearchIndex]) {
                items[wikiSearchIndex].click();
            } else if (items.length > 0) items[0].click();
        }
    });
}

function updateActiveWikiItem(items, index) {
    items.forEach(item => item.classList.remove('keyboard-active'));
    if (items[index]) {
        items[index].classList.add('keyboard-active');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

function renderWikiList(notes) {
    const list = document.getElementById('wikiList');
    list.innerHTML = "";
    if (notes.length === 0) { list.innerHTML = '<div style="padding:20px; color:#888; font-size:14px;">No notes found.</div>'; return; }

    const grouped = {};
    notes.forEach(note => {
        const topic = (note.topic && note.topic.trim()) ? note.topic.trim().toUpperCase() : "UNCATEGORIZED";
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
                if(wikiEditor) wikiEditor.setValue(note.content || "");
                renderWikiList(allWikiNotes.filter(n => 
                    (n.topic||"").toLowerCase().includes(wikiSearchInput.value.toLowerCase()) || 
                    (n.subtopic||"").toLowerCase().includes(wikiSearchInput.value.toLowerCase())
                ));
            };
            div.innerHTML = `<div class="wiki-item-title">• ${note.subtopic}</div>`;
            list.appendChild(div);
        });
    });
}

/* =========================================
   HELPER FUNCTIONS
   ========================================= */
if (localStorage.getItem("darkMode") === "on") document.body.classList.add("dark");
document.getElementById("prevPageBtn").onclick = () => { if(currentPage > 1) { currentPage--; renderTable(); } };
document.getElementById("nextPageBtn").onclick = () => { currentPage++; renderTable(); };
document.getElementById("openAddFormBtn").onclick = () => {
    document.getElementById("problemForm").style.display = "block";
    if(monacoEditor) monacoEditor.setValue('');
    document.getElementById("problemForm").scrollIntoView();
};
window.closeProblemForm = () => {
    document.getElementById("problemForm").style.display = "none";
    editId = null;
    currentPracticeLinks = [];
    renderPracticeLinksPreview();
    document.getElementById("problem").value = "";
    document.getElementById("tags").value = "";
    if(monacoEditor) monacoEditor.setValue('');
};
window.editProblem = (id) => {
    const p = allProblems.find(x => x.id === id);
    if (!p) return;
    editId = id;
    document.getElementById("problem").value = p.problem;
    document.getElementById("difficulty").value = p.difficulty;
    document.getElementById("tags").value = (p.tags || []).join(", ");
    if(monacoEditor) monacoEditor.setValue(p.notes || "");
    currentPracticeLinks = p.practiceLinks || [];
    renderPracticeLinksPreview();
    document.getElementById("problemForm").style.display = "block";
    document.getElementById("problemForm").scrollIntoView();
};
window.deleteProblem = async (id) => { if(confirm("Delete problem?")) await deleteDoc(doc(db, "users", currentUser.uid, "problems", id)); };
window.toggleStar = async (id, current) => { await updateDoc(doc(db, "users", currentUser.uid, "problems", id), { starred: !current }); };
window.viewNote = (id) => {
    const p = allProblems.find(x => x.id === id);
    if (monacoModalEditor) monacoModalEditor.setValue(p?.notes || "// No notes");
    document.getElementById("noteModal").style.display = "flex";
};
window.closeNoteModal = () => document.getElementById("noteModal").style.display = "none";
document.getElementById("toggleSortBtn").onclick = () => {
    const panel = document.getElementById("sortPanel");
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
};
document.getElementById("applyFilterBtn").onclick = () => { currentPage = 1; renderTable(); };
document.getElementById("resetFilterBtn").onclick = () => {
    document.getElementById("filterTag").value = "";
    document.getElementById("starFilterToggle").checked = false;
    renderTable();
};
