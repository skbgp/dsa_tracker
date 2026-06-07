import { db, auth, app, state } from './globals.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.formatDoc = (cmd, value = null) => {
    if (value) document.execCommand(cmd, false, value);
    else document.execCommand(cmd);
};

window.toggleLayout = (context) => {
    let container;
    let editorToRefresh;
    if (context === 'wikiEditModal') { container = document.getElementById('wikiEditSplit'); editorToRefresh = state.wikiEditor; }
    else if (context === 'wikiModal') { container = document.getElementById('wikiModalSplit'); editorToRefresh = state.wikiPopupEditor; }
    else if (context === 'problemModal') { container = document.getElementById('problemSplit'); editorToRefresh = state.monacoEditor; }
    else if (context === 'noteModal') { container = document.getElementById('modalSplit'); editorToRefresh = state.monacoModalEditor; }

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
        if (state.monacoEditor) state.monacoEditor.layout();
        if (state.wikiEditor) state.wikiEditor.layout();
        if (state.monacoModalEditor) state.monacoModalEditor.layout();
        if (state.wikiPopupEditor) state.wikiPopupEditor.layout();
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

// --- Global Exports ---
window.enableAutoLinking = enableAutoLinking;
