import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore, collection, addDoc,
  onSnapshot, doc, deleteDoc, updateDoc
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

/* ===== STATE ===== */
let currentUser = null;
let editId = null;
let allProblems = [];
let allTags = [];
let currentPracticeLinks = [];

// Pagination state
let currentPage = 1;
const PAGE_SIZE = 10;

/* ===== UI ===== */
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const authMessage = document.getElementById("auth-message");
const darkModeToggle = document.getElementById("darkModeToggle");
const googleBtn = document.getElementById("googleBtn");

const logoutBtn = document.getElementById("logoutBtn");

const openAddFormBtn = document.getElementById("openAddFormBtn");
const problemForm = document.getElementById("problemForm");

const problemInput = document.getElementById("problem");
const difficultySelect = document.getElementById("difficulty");
const notesInput = document.getElementById("notes");
const tagsInput = document.getElementById("tags");

const practiceLinkInput = document.getElementById("practiceLinkInput");
const addPracticeLinkBtn = document.getElementById("addPracticeLinkBtn");
const practiceLinksPreview = document.getElementById("practiceLinksPreview");

const saveProblemBtn = document.getElementById("saveProblemBtn");
const tableBody = document.getElementById("tableBody");

const toggleSortBtn = document.getElementById("toggleSortBtn");
const sortPanel = document.getElementById("sortPanel");
const filterTag = document.getElementById("filterTag");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const tagSuggestionsBox = document.getElementById("tagSuggestionsBox");
const tagInputSuggestionsBox = document.getElementById("tagInputSuggestionsBox");

const starFilterToggle = document.getElementById("starFilterToggle");

// Pagination controls
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");

/* ===== AUTH ===== */

googleBtn.onclick = async () => {
  authMessage.textContent = "";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    console.error("Google sign-in error:", err);
    authMessage.textContent = err.message;
  }
};


logoutBtn.onclick = async () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authSection.style.display = "none";
    appSection.style.display = "block";
    currentPage = 1; // reset page when user logs in
    loadProblems();
  } else {
    currentUser = null;
    authSection.style.display = "block";
    appSection.style.display = "none";
  }
});

/* ===== FORM ===== */
openAddFormBtn.onclick = () => {
  problemForm.style.display = "block";
  problemForm.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.closeProblemForm = () => {
  problemForm.style.display = "none";
  editId = null;
  currentPracticeLinks = [];
  practiceLinksPreview.innerHTML = "";
  problemInput.value = "";
  notesInput.value = "";
  difficultySelect.value = "Easy";
  tagsInput.value = "";
};

/* ===== PRACTICE LINKS ===== */
addPracticeLinkBtn.onclick = () => {
  const link = practiceLinkInput.value.trim();
  if (!link) {
    alert("Paste a link first");
    return;
  }

  currentPracticeLinks.push(link);
  practiceLinkInput.value = "";
  renderPracticeLinks();
};

function renderPracticeLinks() {
  practiceLinksPreview.innerHTML = "";
  currentPracticeLinks.forEach((link, index) => {
    const div = document.createElement("div");
    div.innerHTML = `
      ${getWebsiteName(link)}
      <button type="button" onclick="removePracticeLink(${index})">❌</button>
    `;
    practiceLinksPreview.appendChild(div);
  });
}

window.removePracticeLink = (index) => {
  currentPracticeLinks.splice(index, 1);
  renderPracticeLinks();
};

/* ===== SAVE ===== */
saveProblemBtn.onclick = async () => {
  if (!currentUser) return;

  const ref = collection(db, "users", currentUser.uid, "problems");

  const cleanTags = tagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const revisionDate = new Date();
  revisionDate.setDate(revisionDate.getDate() + 7);

  const baseData = {
    problem: problemInput.value.trim(),
    difficulty: difficultySelect.value,
    notes: notesInput.value.trim(),
    practiceLinks: currentPracticeLinks,
    tags: cleanTags,
    revisionDue: revisionDate.toISOString(),
    updatedAt: new Date()
  };

  // For new document: add starred: false
  // For edit: don't touch the starred field
  const data = editId ? baseData : { ...baseData, starred: false };

  if (editId) {
    await updateDoc(doc(ref, editId), data);
  } else {
    await addDoc(ref, data);
  }

  closeProblemForm();
  currentPage = 1; // show first page after adding/editing
  renderTable();
};

/* ===== LOAD ===== */
function loadProblems() {
  const ref = collection(db, "users", currentUser.uid, "problems");

  onSnapshot(ref, (snap) => {
    allProblems = [];
    allTags = [];

    snap.forEach((d) => {
      const p = { id: d.id, ...d.data() };
      allProblems.push(p);
      (p.tags || []).forEach((tag) => allTags.push(tag));
    });

    allTags = [...new Set(allTags)];
    renderTable();
  });
}

/* ===== WEBSITE NAME ===== */
function getWebsiteName(url) {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    if (domain.includes("leetcode")) return "LeetCode";
    if (domain.includes("geeksforgeeks")) return "GeeksForGeeks";
    if (domain.includes("codeforces")) return "Codeforces";
    return domain;
  } catch {
    return "Link";
  }
}

/* ===== FILTER PANEL BEHAVIOR ===== */
toggleSortBtn.onclick = () => {
  sortPanel.style.display = sortPanel.style.display === "none" ? "block" : "none";
};

applyFilterBtn.onclick = () => {
  currentPage = 1;
  renderTable();
};

resetFilterBtn.onclick = () => {
  filterTag.value = "";
  starFilterToggle.checked = false;
  currentPage = 1;
  renderTable();
};

starFilterToggle.onchange = () => {
  currentPage = 1;
  renderTable();
};

/* ===== TAG AUTOCOMPLETE: FILTER BOX ===== */
filterTag.addEventListener("input", () => {
  const query = filterTag.value.trim().toLowerCase();
  tagSuggestionsBox.innerHTML = "";

  if (!query) {
    tagSuggestionsBox.style.display = "none";
    return;
  }

  const matches = allTags.filter((tag) =>
    tag.toLowerCase().includes(query)
  );

  if (!matches.length) {
    tagSuggestionsBox.style.display = "none";
    return;
  }

  matches.forEach((tag) => {
    const div = document.createElement("div");
    div.textContent = tag;
    div.onclick = () => {
      filterTag.value = tag;
      tagSuggestionsBox.style.display = "none";
      currentPage = 1;
      renderTable();
    };
    tagSuggestionsBox.appendChild(div);
  });

  tagSuggestionsBox.style.display = "block";
});

/* ===== TAG AUTOCOMPLETE: ADD/EDIT TAGS INPUT ===== */
tagsInput.addEventListener("input", () => {
  const raw = tagsInput.value;
  const parts = raw.split(",");
  const lastPart = parts[parts.length - 1].trim().toLowerCase();

  tagInputSuggestionsBox.innerHTML = "";

  if (!lastPart) {
    tagInputSuggestionsBox.style.display = "none";
    return;
  }

  const matches = allTags.filter((tag) =>
    tag.toLowerCase().includes(lastPart)
  );

  if (!matches.length) {
    tagInputSuggestionsBox.style.display = "none";
    return;
  }

  matches.forEach((tag) => {
    const div = document.createElement("div");
    div.textContent = tag;
    div.onclick = () => {
      parts[parts.length - 1] = " " + tag;
      tagsInput.value = parts.join(",").replace(/^,/, "").trimStart();
      tagInputSuggestionsBox.style.display = "none";
    };
    tagInputSuggestionsBox.appendChild(div);
  });

  tagInputSuggestionsBox.style.display = "block";
});

/* ===== CLICK OUTSIDE TO HIDE SUGGESTIONS ===== */
document.addEventListener("click", (e) => {
  if (!tagSuggestionsBox.contains(e.target) && e.target !== filterTag) {
    tagSuggestionsBox.style.display = "none";
  }
  if (!tagInputSuggestionsBox.contains(e.target) && e.target !== tagsInput) {
    tagInputSuggestionsBox.style.display = "none";
  }
});

/* ===== PAGINATION BUTTON HANDLERS ===== */
prevPageBtn.onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
};

nextPageBtn.onclick = () => {
  currentPage++;
  renderTable();
};

/* ===== TABLE (STAR SORT + FILTER + PAGINATION) ===== */
function renderTable() {
  const tag = filterTag.value.toLowerCase();
  const onlyStarred = starFilterToggle.checked;

  tableBody.innerHTML = "";

  // 1) FILTER
  let filtered = allProblems.filter(
    (p) => !tag || (p.tags || []).some((t) => t.toLowerCase().includes(tag))
  );

  if (onlyStarred) {
    filtered = filtered.filter((p) => p.starred);
  }

  // 2) SORT (starred on top)
  filtered.sort((a, b) => (b.starred === true) - (a.starred === true));

  // 3) PAGINATION CALC
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // clamp currentPage
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, endIndex);

  // 4) UPDATE PAGE INFO + BUTTON STATES
  if (totalItems === 0) {
    pageInfo.textContent = "No problems to show";
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
  } else {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalItems} problems)`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  // 5) RENDER ONLY CURRENT PAGE ROWS
  pageItems.forEach((p, index) => {
    const diff = new Date(p.revisionDue) - new Date();
    const daysLeft = Math.ceil(diff / 86400000);

    let revisionColor = "#27ae60";
    let revisionBtn = daysLeft >= 7 ? "🔒" : "↻ +7";

    if (daysLeft <= 1) revisionColor = "#e74c3c";
    else if (daysLeft <= 4) revisionColor = "#f39c12";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${startIndex + index + 1}</td>
      <td>${p.problem}</td>
      <td>${p.difficulty}</td>
      <td>${p.notes ? `<button onclick="viewNote('${p.id}')">View</button>` : "-"}</td>

      <td>${(p.tags || []).join(", ")}</td>

      <td style="color:${revisionColor}">
        ${daysLeft} days
        <button ${revisionBtn === "🔒" ? "disabled" : ""} onclick="renewRevision('${p.id}')">
          ${revisionBtn}
        </button>
      </td>

      <td>
        ${
          p.practiceLinks && p.practiceLinks.length
            ? p.practiceLinks
                .map(
                  (link) =>
                    `<a href="${link}" target="_blank">${getWebsiteName(link)}</a>`
                )
                .join(", ")
            : "-"
        }
      </td>

      <td class="star-cell">
        <button
          class="${p.starred ? "starred" : ""}"
          onclick="toggleStar('${p.id}', ${p.starred})"
          title="Mark as important"
        >
          ${p.starred ? "★" : "☆"}
        </button>
      </td>

      <td>
        <button onclick="editProblem('${p.id}', ${JSON.stringify(p).replace(/"/g, "&quot;")})">
          Edit
        </button>
        <button onclick="deleteProblem('${p.id}')">
          Delete
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

/* ===== STAR ===== */
window.toggleStar = async (id, currentState) => {
  if (!currentUser) return;
  await updateDoc(doc(db, "users", currentUser.uid, "problems", id), {
    starred: !currentState
  });
};

/* ===== ACTIONS ===== */
window.deleteProblem = async (id) => {
  if (!currentUser) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "problems", id));
};

window.editProblem = (id, data) => {
  editId = id;
  problemInput.value = data.problem || "";
  difficultySelect.value = data.difficulty || "Easy";
  notesInput.value = data.notes || "";
  tagsInput.value = (data.tags || []).join(", ");
  currentPracticeLinks = data.practiceLinks || [];
  renderPracticeLinks();

  problemForm.style.display = "block";
  problemForm.scrollIntoView({ behavior: "smooth", block: "start" });
};


window.renewRevision = async (id) => {
  if (!currentUser) return;

  const next = new Date();
  next.setDate(next.getDate() + 7);

  await updateDoc(doc(db, "users", currentUser.uid, "problems", id), {
    revisionDue: next.toISOString()
  });
};

/* ===== DARK MODE TOGGLE (SAFE) ===== */

// Apply saved theme immediately
if (localStorage.getItem("darkMode") === "on") {
  document.body.classList.add("dark");
}

// Attach click only AFTER login (when button exists)
onAuthStateChanged(auth, (user) => {
  if (user) {
    setTimeout(() => {
      const darkBtn = document.getElementById("darkModeToggle");

      if (!darkBtn) return;

      darkBtn.textContent = document.body.classList.contains("dark")
        ? "☀️ Light"
        : "🌙 Dark";

      darkBtn.onclick = () => {
        document.body.classList.toggle("dark");

        const isDark = document.body.classList.contains("dark");
        darkBtn.textContent = isDark ? "☀️ Light" : "🌙 Dark";

        localStorage.setItem("darkMode", isDark ? "on" : "off");
      };
    }, 0);
  }
});
window.viewNote = (id) => {
  const p = allProblems.find(x => x.id === id);
  if (!p) return;

  document.getElementById("noteModalText").textContent = p.notes || "No note available";
  document.getElementById("noteModal").style.display = "flex";
};

window.closeNoteModal = () => {
  document.getElementById("noteModal").style.display = "none";
};