import { db, auth, app, state } from './globals.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

      // Problem Edit
 // Problem View
        // Wiki Edit
   // Wiki View

require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    // 1. Problem Edit Editor
    const editorEl = document.getElementById('state.monacoEditor');
    if (editorEl) {
        state.monacoEditor = monaco.editor.create(editorEl, {
            value: '// Write your code implementation here...', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });
        
        // --- FIX: Clear default text on focus ---
        state.monacoEditor.onDidFocusEditorWidget(() => {
            const val = state.monacoEditor.getValue().trim();
            if (val === '// Write your code implementation here...') {
                state.monacoEditor.setValue('');
            }
        });

        // Auto-save on typing in code editor
        state.monacoEditor.onDidChangeModelContent(() => saveProblemDraft());
    }

    // 2. Problem View Editor
    const modalEl = document.getElementById('state.monacoModalEditor');
    if (modalEl) {
        state.monacoModalEditor = monaco.editor.create(modalEl, {
            value: '', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: true }, readOnly: true, fontSize: 13
        });
    }

    // 3. Wiki Edit Editor
    const wikiEl = document.getElementById('wikiMonaco');
    if (wikiEl) {
        state.wikiEditor = monaco.editor.create(wikiEl, {
            value: '// Code implementation goes here...',
            language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: false }, fontSize: 14
        });

        // --- FIX: Clear default text on focus (Wiki) ---
        state.wikiEditor.onDidFocusEditorWidget(() => {
            const val = state.wikiEditor.getValue().trim();
            if (val === '// Code implementation goes here...') {
                state.wikiEditor.setValue('');
            }
        });

        // Auto-save on typing in wiki code editor
        state.wikiEditor.onDidChangeModelContent(() => saveWikiDraft());
    }

    // 4. Wiki View Editor
    const wikiPopupEl = document.getElementById('monacoWikiModalEditor');
    if (wikiPopupEl) {
        state.wikiPopupEditor = monaco.editor.create(wikiPopupEl, {
            value: '', language: 'cpp', theme: 'vs-dark', automaticLayout: true,
            minimap: { enabled: true }, readOnly: true, fontSize: 13
        });
    }

    updateMonacoTheme();
});

function updateMonacoTheme() {
    const isDark = document.body.classList.contains('dark');
    const theme = isDark ? 'vs-dark' : 'vs';
    if (state.monacoEditor) monaco.editor.setTheme(theme);
    if (state.monacoModalEditor) monaco.editor.setTheme(theme);
    if (state.wikiEditor) monaco.editor.setTheme(theme);
    if (state.wikiPopupEditor) monaco.editor.setTheme(theme);
}

function getMonacoValue() { return state.monacoEditor ? state.monacoEditor.getValue() : ''; }

/* =========================================

// --- Global Exports ---
window.updateMonacoTheme = updateMonacoTheme;
window.getMonacoValue = getMonacoValue;
