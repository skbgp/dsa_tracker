Here is a professional README designed for your project. It highlights the features found in your code (Spaced Repetition, Wiki, Monaco Editor) and provides clear setup instructions.

---

# 📚 DSA Tracker & Personal Wiki

A comprehensive, full-stack application designed to help developers master Data Structures and Algorithms. This tool combines a **Spaced Repetition** problem tracker with a hierarchical **Personal Wiki**, allowing you to store concept notes and code implementations in one secure place.

## ✨ Key Features

### 🚀 Problem Tracker

* **CRUD Functionality:** Add, edit, delete, and view DSA problems.
* **Spaced Repetition System:** Automated "Revision Due" logic (7-day intervals) to ensure long-term retention.
* **Rich Coding Environment:** Integrated **Monaco Editor** (VS Code engine) for writing implementation code with syntax highlighting.
* **Smart Filtering:** Sort by tags, difficulty (Easy/Medium/Hard), starred status, or revision urgency.
* **Practice Links:** Store external links (LeetCode, GFG) directly with the problem.

### 📖 Personal Wiki

* **Hierarchical Organization:** Organize knowledge by **Topics** (e.g., Graphs) and **Subtopics** (e.g., BFS, DFS).
* **Drag & Drop:** Reorder topics and subtopics easily using drag-and-drop functionality.
* **Dual Editor:** Rich Text editor for concept notes + Monaco Editor for code snippets.
* **Search:** Real-time filtering of wiki topics.

### 🛠️ General Utilities

* **Authentication:** Secure Google Sign-In via Firebase Auth.
* **Dark Mode:** Fully responsive dark/light theme toggle.
* **Auto-Save Drafts:** LocalStorage integration ensures you never lose unsaved work while typing.
* **Responsive Design:** Optimized for both desktop and mobile viewing.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES Modules).
* **Backend:** Firebase (Firestore Database, Authentication).
* **Editor Engine:** [Monaco Editor](https://microsoft.github.io/monaco-editor/).
* **Icons:** Font Awesome.

---

## 📂 Project Structure

```text
/
├── index.html      # Main application entry point and DOM structure
├── style.css       # Global styles, dark mode, and responsive layout
└── script.js       # Firebase logic, UI interactions, and Monaco configuration

```

---

## 🚀 Getting Started

### Prerequisites

* A Google Account (for Firebase).
* A code editor (VS Code recommended).
* A local server (e.g., Live Server extension for VS Code) or Python simple server.

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/dsa-tracker.git
cd dsa-tracker

```

### 2. Configure Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Enable **Authentication** and turn on the **Google** provider.
4. Enable **Cloud Firestore** and start in **Test Mode** (or configure security rules for production).
5. In project settings, copy your web app configuration.

### 3. Update `script.js`

Open `script.js` and replace the `firebaseConfig` object with your own credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

```

### 4. Run the Application

Since the project uses ES Modules (`type="module"`), you cannot open `index.html` directly from the file system. You must serve it.

* **VS Code:** Right-click `index.html` and select "Open with Live Server".
* **Python:** Run `python -m http.server 8000` in the terminal and visit `http://localhost:8000`.

---

## 💾 Database Schema

The application automatically creates the user structure in Firestore upon first login:

* **`users/{uid}/problems`**: Stores DSA problems, code, and revision dates.
* **`users/{uid}/wiki`**: Stores wiki notes, topics, and subtopics.
* **`users/{uid}/settings`**: Stores user preferences (like Wiki sort order).

---

## 🤝 Contributing

Contributions are welcome! If you have suggestions for features (e.g., exporting data, adding Python support to the editor), feel free to open an issue or pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
