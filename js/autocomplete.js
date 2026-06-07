import { db, auth, app, state } from './globals.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

   AUTOCOMPLETE (Only for Input Forms)
   ========================================= */
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

if (tagsInput && formTagBox) {
    tagsInput.addEventListener("input", () => {
        const raw = tagsInput.value;
        const parts = raw.split(",");
        const lastPart = parts[parts.length - 1].trim().toLowerCase();
        state.addFormFocusIndex = -1;
        if (!lastPart) { formTagBox.style.display = "none"; return; }
        const matches = state.allTags.filter((tag) => tag.toLowerCase().includes(lastPart));
        renderSuggestions(matches, formTagBox, (selectedTag) => {
            parts[parts.length - 1] = " " + selectedTag;
            tagsInput.value = parts.join(",").replace(/^,/, "").trimStart();
            formTagBox.style.display = "none";
            tagsInput.focus();
            saveProblemDraft(); // Trigger save on tag select
        }, state.addFormFocusIndex);
    });
    tagsInput.addEventListener("keydown", (e) => {
        const items = formTagBox.getElementsByClassName("suggestion-item");
        if (formTagBox.style.display === "none") return;
        if (e.key === "ArrowDown") { e.preventDefault(); state.addFormFocusIndex = (state.addFormFocusIndex + 1) % items.length; updateActiveItem(items, state.addFormFocusIndex); }
        else if (e.key === "ArrowUp") { e.preventDefault(); state.addFormFocusIndex = (state.addFormFocusIndex - 1 + items.length) % items.length; updateActiveItem(items, state.addFormFocusIndex); }
        else if (e.key === "Enter") { e.preventDefault(); if (items[state.addFormFocusIndex]) items[state.addFormFocusIndex].click(); }
        else if (e.key === "Escape") formTagBox.style.display = "none";
    });
}

if (wikiTopicInput && wikiTopicBox) {
    wikiTopicInput.addEventListener("input", () => {
        const query = wikiTopicInput.value.trim().toLowerCase();
        state.wikiTopicFocusIndex = -1;
        if (!query) { wikiTopicBox.style.display = "none"; return; }
        const uniqueTopics = [...new Set(state.allWikiNotes.map(n => (n.topic || "").trim()).filter(Boolean))];
        const matches = uniqueTopics.filter(t => t.toLowerCase().includes(query));
        
        renderSuggestions(matches, wikiTopicBox, (selectedTopic) => {
            wikiTopicInput.value = selectedTopic;
            wikiTopicBox.style.display = "none";
            saveWikiDraft(); // Trigger save on topic select
        }, state.wikiTopicFocusIndex);
    });

    wikiTopicInput.addEventListener("keydown", (e) => {
        const items = wikiTopicBox.getElementsByClassName("suggestion-item");
        if (wikiTopicBox.style.display === "none") return;
        if (e.key === "ArrowDown") { e.preventDefault(); state.wikiTopicFocusIndex = (state.wikiTopicFocusIndex + 1) % items.length; updateActiveItem(items, state.wikiTopicFocusIndex); }
        else if (e.key === "ArrowUp") { e.preventDefault(); state.wikiTopicFocusIndex = (state.wikiTopicFocusIndex - 1 + items.length) % items.length; updateActiveItem(items, state.wikiTopicFocusIndex); }
        else if (e.key === "Enter") { e.preventDefault(); if (items[state.wikiTopicFocusIndex]) items[state.wikiTopicFocusIndex].click(); }
        else if (e.key === "Escape") wikiTopicBox.style.display = "none";
    });
}

document.addEventListener("click", (e) => {
    if (formTagBox && !formTagBox.contains(e.target) && e.target !== tagsInput) formTagBox.style.display = "none";
    if (wikiTopicBox && !wikiTopicBox.contains(e.target) && e.target !== wikiTopicInput) wikiTopicBox.style.display = "none";
});

/* =========================================

// --- Global Exports ---
window.renderSuggestions = renderSuggestions;
window.updateActiveItem = updateActiveItem;
