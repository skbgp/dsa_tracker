import { db, auth, app, state } from './globals.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
        const globalCheck = document.getElementById("adminGlobalCheck");
        if (globalCheck) {
            globalCheck.style.display = (state.isAdmin && !state.editId) ? "flex" : "none";
        }
        
        // Reset inputs disabled state
        document.getElementById("problem").disabled = false;
        document.getElementById("tags").disabled = false;
        document.getElementById("difficulty").disabled = false;
        document.getElementById("practiceLinkInput").disabled = false;
        document.getElementById("addPracticeLinkBtn").disabled = false;
        
        if (!state.editId) {
            // 1. Clear fields FIRST
            document.getElementById("problem").value = "";
            document.getElementById("tags").value = "";
            document.getElementById("problemTextNotes").innerHTML = "";
            state.currentPracticeLinks = [];
            renderPracticeLinksPreview();

            // 2. Load Draft IMMEDIATELY (Before checking monaco)
            loadProblemDraft(); 
            
            // 3. Set Code Default (only if no draft code exists)
            if(state.monacoEditor) {
                 const saved = localStorage.getItem(DRAFT_KEY_PROBLEM);
                 if(!saved || !JSON.parse(saved).code) {
                      state.monacoEditor.setValue('// Write your code implementation here...');
                 } else {
                      state.monacoEditor.setValue(JSON.parse(saved).code);
                 }
            }
        }
        
        // Layout Monaco if it is ready
        if (state.monacoEditor) {
            setTimeout(() => state.monacoEditor.layout(), 100);
        }
    } else {
        closeProblemModal();
    }
}
window.closeProblemModal = () => {
    // 1. HIDE MODAL FIRST to stop Draft Saving
    problemModal.style.display = "none";
    
    // 2. Cleanup vars
    state.editId = null;
    state.currentPracticeLinks = [];
    renderPracticeLinksPreview();
    
    // 3. Clear Inputs (Draft logic ignores this because display is none)
    document.getElementById("problem").value = "";
    document.getElementById("tags").value = "";
    document.getElementById("problemTextNotes").innerHTML = ""; 
    document.querySelectorAll('.error-text').forEach(e => e.remove());
    document.querySelectorAll('.input-error').forEach(e => e.classList.remove('input-error'));
    
    // 4. Reset Editor
    if(state.monacoEditor) state.monacoEditor.setValue('');
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

function processAndRenderProblems() {
    state.allProblems = [];
    state.allTags = [];

    state.globalProblemsList.forEach(g => {
        const u = state.userProblemsMap[g.id] || {};
        const p = {
            id: g.id, isGlobal: true,
            problem: g.problem, difficulty: g.difficulty,
            tags: g.tags || [], practiceLinks: g.practiceLinks || [],
            createdAt: g.createdAt,
            starred: u.starred || false,
            conceptNotes: u.conceptNotes || "", code: u.code || "",
            revisionDue: u.revisionDue || g.createdAt,
            revisionCount: u.revisionCount || 0
        };
        state.allProblems.push(p);
        p.tags.forEach(t => state.allTags.push(t));
    });

    Object.values(state.userProblemsMap).forEach(u => {
        if (!u.isGlobalRef) {
            const p = {
                id: u.id, isGlobal: false,
                problem: u.problem, difficulty: u.difficulty,
                tags: u.tags || [], practiceLinks: u.practiceLinks || [],
                createdAt: u.createdAt,
                starred: u.starred || false,
                conceptNotes: u.conceptNotes || "", code: u.code || "",
                revisionDue: u.revisionDue || u.createdAt,
                revisionCount: u.revisionCount || 0
            };
            state.allProblems.push(p);
            p.tags.forEach(t => state.allTags.push(t));
        }
    });

    state.allProblems.sort((a, b) => getSafeTime(a.createdAt) - getSafeTime(b.createdAt));
    state.allProblems.forEach((p, idx) => p.serialNo = idx + 1);
    state.allTags = [...new Set(state.allTags)];
    renderTable();
}

let globalUnsub = null;
let userUnsub = null;

function loadProblems() {
    if(!state.currentUser) return;
    
    // Global problems
    const globalRef = collection(db, "global_problems");
    if(globalUnsub) globalUnsub();
    globalUnsub = onSnapshot(globalRef, (snap) => {
        state.globalProblemsList = [];
        snap.forEach(d => {
            const data = d.data();
            state.globalProblemsList.push({ id: d.id, ...data });
        });
        processAndRenderProblems();
    });

    // User problems
    const userRef = collection(db, "users", state.currentUser.uid, "problems");
    if(userUnsub) userUnsub();
    userUnsub = onSnapshot(userRef, (snap) => {
        state.userProblemsMap = {};
        snap.forEach(d => {
            const data = d.data();
            state.userProblemsMap[d.id] = { id: d.id, ...data };
        });
        processAndRenderProblems();
    });
}

const saveBtn = document.getElementById("saveProblemBtn");
if (saveBtn) {
    saveBtn.onclick = async () => {
        if (!state.currentUser) return alert("Please login first.");
        const isProblemValid = validateField("problem", "Required");
        const isTagsValid = validateField("tags", "Required");
        if (!isProblemValid || !isTagsValid) return;

        const problemInput = document.getElementById("problem");
        const tagsInput = document.getElementById("tags");
        const difficultySelect = document.getElementById("difficulty");
        const notesInput = document.getElementById("problemTextNotes");
        const cleanTags = tagsInput.value.split(",").map((t) => t.trim()).filter(Boolean);
        const isGlobalCheck = document.getElementById("isGlobalProblem");
        
        const baseData = {
            problem: problemInput.value.trim(),
            difficulty: difficultySelect.value,
            practiceLinks: state.currentPracticeLinks, 
            tags: cleanTags,
            updatedAt: new Date().toISOString()
        };

        const userData = {
            conceptNotes: notesInput.innerHTML, 
            code: getMonacoValue(),
            updatedAt: new Date().toISOString()
        };

        try {
            const userRef = collection(db, "users", state.currentUser.uid, "problems");
            const globalRef = collection(db, "global_problems");

            if (state.editId) {
                const p = state.allProblems.find(x => x.id === state.editId);
                // UPDATE
                if (p.isGlobal) {
                    if (state.isAdmin) await updateDoc(doc(globalRef, state.editId), baseData);
                    userData.isGlobalRef = true;
                    // Fix: SetDoc with merge in case user doc doesn't exist yet
                    await setDoc(doc(userRef, state.editId), userData, { merge: true });
                } else {
                    // Custom user problem
                    await updateDoc(doc(userRef, state.editId), { ...baseData, ...userData });
                }
            } else {
                // ADD
                const revisionDate = new Date();
                revisionDate.setDate(revisionDate.getDate() + 7);
                
                const addGlobal = state.isAdmin && isGlobalCheck && isGlobalCheck.checked;
                
                if (addGlobal) {
                    const docRef = await addDoc(globalRef, { ...baseData, createdAt: new Date().toISOString() });
                    userData.isGlobalRef = true;
                    userData.starred = false;
                    userData.revisionCount = 0;
                    userData.revisionDue = revisionDate.toISOString();
                    await setDoc(doc(userRef, docRef.id), userData);
                } else {
                    await addDoc(userRef, { 
                        ...baseData, 
                        ...userData,
                        isGlobalRef: false,
                        createdAt: new Date().toISOString(), 
                        starred: false, 
                        revisionCount: 0, 
                        revisionDue: revisionDate.toISOString() 
                    });
                }
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
// 1. Filter
let filtered = state.allProblems.filter(p => {
    // FIX: Safely handle if 'problem' text is missing or null
    const probName = (p.problem || "").toLowerCase(); 
    return !searchVal || probName.includes(searchVal);
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
    // FIX: Handle invalid dates safely
    const dateA = p.revisionDue ? new Date(a.revisionDue).getTime() : 0;
    const dateB = p.revisionDue ? new Date(b.revisionDue).getTime() : 0;
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
    const totalPages = Math.max(1, Math.ceil(totalItems / state.PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    document.getElementById("pageInfo").textContent = `Page ${state.currentPage} of ${totalPages} (${totalItems})`;
    
    document.getElementById("prevPageBtn").disabled = state.currentPage === 1;
    document.getElementById("nextPageBtn").disabled = state.currentPage === totalPages;
    document.getElementById("fastPrevBtn").disabled = state.currentPage === 1;
    document.getElementById("fastNextBtn").disabled = state.currentPage === totalPages;

    const pageItems = filtered.slice((state.currentPage - 1) * state.PAGE_SIZE, state.currentPage * state.PAGE_SIZE);

    let lastTag = null;

    pageItems.forEach((p) => {
        if (sortBy === 'tag') {
            const currentTag = (p.tags && p.tags[0]) ? p.tags[0].toUpperCase() : "UNTAGGED";
            if (currentTag !== lastTag) {
                const headerTr = document.createElement("tr");
                headerTr.innerHTML = `<td colspan="9" style="background-color: var(--secondary-bg, #f8f9fa); font-weight: bold; padding: 10px 15px; color: var(--text-main, #333); text-align: left; border-bottom: 2px solid var(--border-color, #eee);">
                    <i class="fa-regular fa-folder-open" style="margin-right:8px; color:#3498db;"></i> ${currentTag}
                </td>`;
                tableBody.appendChild(headerTr);
                lastTag = currentTag;
            }
        }

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
    if(!state.currentUser) return; 
    const problem = state.allProblems.find(p => p.id === id); 
    if(!problem) return; 
    
    const intervalDays = 7; 
    const nextDate = new Date(); 
    nextDate.setDate(nextDate.getDate() + intervalDays); 
    const currentCount = problem.revisionCount || 0;
    
    await updateDoc(doc(db, "users", state.currentUser.uid, "problems", id), { 
        revisionDue: nextDate.toISOString(), 
        revisionCount: currentCount + 1,
        updatedAt: new Date()
    }); 
};

/* =========================================

// --- Global Exports ---
window.loadProblems = loadProblems;
window.toggleAddMode = toggleAddMode;
window.renderTable = renderTable;
window.getSafeTime = getSafeTime;
window.processAndRenderProblems = processAndRenderProblems;
