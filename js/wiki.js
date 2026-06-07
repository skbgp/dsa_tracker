import { db, auth, app, state } from './globals.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

   WIKI LOGIC (NEW: MODAL HANDLING)
   ========================================= */
function loadWikiNotes() {
    if (!state.currentUser) return;

    const settingsRef = doc(db, "users", state.currentUser.uid, "settings", "wikiPref");
    getDoc(settingsRef).then((docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            state.wikiTopicOrder = data.topicOrder || data.order || []; 
            state.wikiSubtopicOrder = data.subtopicOrder || {};
        }

        onSnapshot(collection(db, "users", state.currentUser.uid, "wiki"), (snap) => {
            state.allWikiNotes = [];
            snap.forEach(d => state.allWikiNotes.push({ id: d.id, ...d.data() }));
            window.filterWikiList();
        });
    });
}

window.viewWikiNote = (note) => {
    state.currentNoteId = note.id;
    
    document.getElementById("popupWikiTopic").textContent = note.topic || "Uncategorized";
    document.getElementById("popupWikiTitle").textContent = note.subtopic || "Untitled Note";
    
    let noteContent = note.textNotes || "<p style='color:#666; font-style:italic;'>No notes added.</p>";
    noteContent = noteContent.replace(/<a /g, '<a target="_blank" ');
    document.getElementById("popupWikiNotes").innerHTML = noteContent;

    if (state.wikiPopupEditor) {
        const code = note.code ?? note.content ?? "// No code saved.";
        state.wikiPopupEditor.setValue(code);
        setTimeout(() => state.wikiPopupEditor.layout(), 50);
    }
    document.getElementById("wikiModal").style.display = "flex";
};

window.closeWikiModal = () => { document.getElementById("wikiModal").style.display = "none"; };

window.editWikiFromPopup = () => { window.closeWikiModal(); window.editCurrentWiki(); };
window.deleteWikiFromPopup = async () => { window.closeWikiModal(); window.deleteWikiNote(); };

// UPDATED: Open Edit Modal instead of splitting screen
window.editCurrentWiki = () => {
    if (!state.currentNoteId) return;
    const note = state.allWikiNotes.find(n => n.id === state.currentNoteId);
    if (!note) return;

    document.getElementById("wikiEditModal").style.display = "flex";

    document.getElementById('wikiTopic').value = note.topic || "";
    document.getElementById('wikiSubtopic').value = note.subtopic || "";
    document.getElementById('wikiTextNotes').innerHTML = note.textNotes || "";
    
    if(state.wikiEditor) {
        const code = note.code ?? note.content ?? "";
        state.wikiEditor.setValue(code);
        setTimeout(() => state.wikiEditor.layout(), 50);
    }
};

window.closeWikiEditModal = () => {
    document.getElementById("wikiEditModal").style.display = "none";
    state.currentNoteId = null;
    document.querySelectorAll('.wiki-item').forEach(el => el.classList.remove('active'));
};

window.createNewNote = () => {
    state.currentNoteId = null;
    document.getElementById("wikiEditModal").style.display = "flex";
    
    document.getElementById('wikiTopic').value = "";
    document.getElementById('wikiSubtopic').value = "";
    document.getElementById('wikiTextNotes').innerHTML = "";
    
    // NEW: Load Draft for Wiki
    loadWikiDraft();

    if(state.wikiEditor) {
        // Only set default if draft didn't populate code
        if (!state.wikiEditor.getValue() || state.wikiEditor.getValue().trim() === "") {
             state.wikiEditor.setValue("// Code implementation goes here...");
        }
        setTimeout(() => state.wikiEditor.layout(), 50);
    }
    document.querySelectorAll('.wiki-item').forEach(el => el.classList.remove('active'));
};

window.saveWikiNote = async () => {
    if (!state.currentUser) return alert("Login required");
    const isTopicValid = validateField("wikiTopic", "Required");
    const isSubtopicValid = validateField("wikiSubtopic", "Required");
    if (!isTopicValid || !isSubtopicValid) return;

    const topic = document.getElementById('wikiTopic').value.trim();
    const subtopic = document.getElementById('wikiSubtopic').value.trim();
    const textNotes = document.getElementById('wikiTextNotes').innerHTML;
    const codeContent = state.wikiEditor ? state.wikiEditor.getValue() : "";

    const data = {
        topic: topic, subtopic: subtopic, title: subtopic, 
        textNotes: textNotes, code: codeContent, updatedAt: new Date().toISOString()
    };
    
    try {
        const ref = collection(db, "users", state.currentUser.uid, "wiki");
        let noteToView = { ...data };
        
        if (state.currentNoteId) {
            await updateDoc(doc(ref, state.currentNoteId), data);
            noteToView.id = state.currentNoteId;
        } else { 
            const docRef = await addDoc(ref, data); 
            state.currentNoteId = docRef.id;
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
    const filtered = state.allWikiNotes.filter(n => (n.topic||"").toLowerCase().includes(query) || (n.subtopic||"").toLowerCase().includes(query));
    renderWikiList(filtered);
};

// ... (Rest of Wiki Logic - Drag Drop etc. - remains same) ...
async function saveWikiPreferences() {
    if (!state.currentUser) return;
    try {
        const settingsRef = doc(db, "users", state.currentUser.uid, "settings", "wikiPref");
        await setDoc(settingsRef, { 
            topicOrder: state.wikiTopicOrder,
            subtopicOrder: state.wikiSubtopicOrder
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
    const srcIdx = state.wikiTopicOrder.indexOf(srcKey);
    const targetIdx = state.wikiTopicOrder.indexOf(targetKey);
    if (srcIdx === -1 || targetIdx === -1) return;
    state.wikiTopicOrder.splice(srcIdx, 1);
    state.wikiTopicOrder.splice(targetIdx, 0, srcKey);
    window.filterWikiList();
    saveWikiPreferences();
}
function handleSubtopicDrop(parentKey, srcId, targetId) {
    if (srcId === targetId) return;
    const order = state.wikiSubtopicOrder[parentKey] || [];
    const srcIdx = order.indexOf(srcId);
    const targetIdx = order.indexOf(targetId);
    if (srcIdx === -1 || targetIdx === -1) return;
    order.splice(srcIdx, 1);
    order.splice(targetIdx, 0, srcId);
    state.wikiSubtopicOrder[parentKey] = order;
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
        let indexA = state.wikiTopicOrder.indexOf(a);
        let indexB = state.wikiTopicOrder.indexOf(b);
        if (indexA === -1) indexA = 9999;
        if (indexB === -1) indexB = 9999;
        return indexA === 9999 && indexB === 9999 ? a.localeCompare(b) : indexA - indexB;
    });
    state.wikiTopicOrder = currentKeys;
    currentKeys.forEach((key) => {
        const group = grouped[key];
        let subOrder = state.wikiSubtopicOrder[key] || [];
        group.notes.sort((a, b) => {
            let ia = subOrder.indexOf(a.id);
            let ib = subOrder.indexOf(b.id);
            if (ia === -1) ia = 9999;
            if (ib === -1) ib = 9999;
            return ia === 9999 && ib === 9999 ? a.subtopic.localeCompare(b.subtopic) : ia - ib;
        });
        state.wikiSubtopicOrder[key] = group.notes.map(n => n.id);
        const hasActiveNote = group.notes.some(n => n.id === state.currentNoteId);
        if (state.expandedTopics[key] === undefined) state.expandedTopics[key] = hasActiveNote;
        const isOpen = state.expandedTopics[key];
        const header = document.createElement('div');
        header.className = "wiki-topic-header";
        addDragHandlers(header, 'topic', key);
        header.onclick = () => {
            state.expandedTopics[key] = !state.expandedTopics[key];
            const container = document.getElementById(`wiki-group-${key}`);
            const icon = document.getElementById(`wiki-icon-${key}`);
            if (state.expandedTopics[key]) {
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
            div.className = `wiki-item ${state.currentNoteId === note.id ? 'active' : ''}`;
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
    const p = state.allProblems.find(x => x.id === id);
    if(p && p.isGlobal && !state.isAdmin) {
        alert("You cannot delete a global problem.");
        return;
    }
    window.showConfirm("Are you sure you want to delete this problem? This cannot be undone.", async () => {
        if(p && p.isGlobal && state.isAdmin) {
            await deleteDoc(doc(db, "global_problems", id));
            // Optional: delete user references? Firebase keeps it orphaned, which is fine, processAndRender ignores orphans or we can handle it.
        }
        await deleteDoc(doc(db, "users", state.currentUser.uid, "problems", id));
    });
}
};
window.deleteWikiNote = async () => { 
    if (!state.currentNoteId) return;
    window.showConfirm("Are you sure you want to delete this note? It will be lost forever.", async () => {
        await deleteDoc(doc(db, "users", state.currentUser.uid, "wiki", state.currentNoteId)); 
        window.createNewNote(); 
    });
};
window.toggleStar = async (id, current) => { await updateDoc(doc(db, "users", state.currentUser.uid, "problems", id), { starred: !current }); };
window.viewNote = (id) => {
    const p = state.allProblems.find(x => x.id === id);
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
    if (state.monacoModalEditor) {
        const codeContent = p.code ?? p.notes ?? "// No implementation code saved.";
        state.monacoModalEditor.setValue(codeContent);
        setTimeout(() => state.monacoModalEditor.layout(), 100);
    }
    document.getElementById("noteModal").style.display = "flex";
};
window.closeNoteModal = () => document.getElementById("noteModal").style.display = "none";

window.editProblem = (id) => {
    const p = state.allProblems.find(x => x.id === id);
    if (!p) return;
    state.editId = id;
    
    // Set Values
    document.getElementById("problem").value = p.problem;
    document.getElementById("difficulty").value = p.difficulty;
    
    // Disable inputs if it's a global problem and user is NOT admin
    const isGlobalAndNotAdmin = (p.isGlobal && !state.isAdmin);
    document.getElementById("problem").disabled = isGlobalAndNotAdmin;
    document.getElementById("tags").disabled = isGlobalAndNotAdmin;
    document.getElementById("difficulty").disabled = isGlobalAndNotAdmin;
    document.getElementById("practiceLinkInput").disabled = isGlobalAndNotAdmin;
    document.getElementById("addPracticeLinkBtn").disabled = isGlobalAndNotAdmin;
    
    // Hide global checkbox when editing
    const globalCheck = document.getElementById("adminGlobalCheck");
    if(globalCheck) globalCheck.style.display = "none";
    document.getElementById("tags").value = (p.tags || []).join(", ");
    document.getElementById("problemTextNotes").innerHTML = p.conceptNotes || ""; 
    
    state.currentPracticeLinks = p.practiceLinks || [];
    renderPracticeLinksPreview();

    // Open Modal
    toggleAddMode(true);
    
    // Set Monaco Value *after* opening modal
    const codeToLoad = p.code ?? p.notes ?? ""; 
    if(state.monacoEditor) { 
        state.monacoEditor.setValue(codeToLoad); 
        setTimeout(() => state.monacoEditor.layout(), 100); 
    }
};

if (localStorage.getItem("darkMode") === "on") document.body.classList.add("dark");


// --- Global Exports ---
window.handleTopicDrop = handleTopicDrop;
window.loadWikiNotes = loadWikiNotes;
window.handleSubtopicDrop = handleSubtopicDrop;
window.saveWikiPreferences = saveWikiPreferences;
window.renderWikiList = renderWikiList;
window.addDragHandlers = addDragHandlers;
