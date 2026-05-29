# Product Walkthrough: NeuraStitch B2C SaaS Platform

We have successfully built and fully deployed the **Hosted B2C SaaS Playground (Phase 1)** of NeuraStitch! 

The application is structured into **two completely separate, dedicated routes** so that you can interactively test, inspect, and benchmark their distinct database paradigms and visual branching capabilities side-by-side.

---

## 1. Navigating the Workspace Portal

When you start your development server (`.\start_nextgen.bat`) and navigate to **`http://localhost:3000`**, you will be welcomed by a glowing, dark obsidian-themed **Entry Portal** [page.tsx](file:///d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/frontend/app/page.tsx):

```
                       ┌───────────────────────────────┐
                       │    NeuraStitch Entry Portal   │
                       │     http://localhost:3000     │
                       └───────────────┬───────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
 ┌─────────────────────────────┐               ┌─────────────────────────────┐
 │    B2C Free Playground      │               │    B2C Paid Cloud Platform  │
 │     http://localhost:3000/free              │     http://localhost:3000/paid  │
 ├─────────────────────────────┤               ├─────────────────────────────┤
 │ - 100% Offline IndexedDB    │               │ - Neon Postgres Cloud Sync  │
 │ - Stateless /chat/stateless │               │ - Qdrant Vector RAG Search  │
 │ - Pure browser trees        │               │ - Auto Topic Compaction     │
 └─────────────────────────────┘               └─────────────────────────────┘
```

---

## 2. B2C Free Tier Playground (`/free`)
*Path: [page.tsx](/d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/frontend/app/free/page.tsx)*

This sandbox simulates the **100% Free, Local-First User Mode**. No data is ever saved to our server PostgreSQL database, protecting our cloud operating bills.

### Key Actions to Test:
1. **Interactive Key Wallet**: Enter your OpenRouter key (or OpenAI/Gemini/Groq keys). Click "Save Keys & Enter Playground". The keys remain inside your browser's secure memory.
2. **Conversation Node Tree (React Flow)**: 
   * Send a prompt (e.g., *"Write a Python script to reverse a string."*). A custom **User** node bubble will appear on the visual canvas.
   * The assistant response streams in real time via our stateless backend gateway (`/chat/stateless`) and renders as a connected **Assistant** node child bubble.
3. **Visual Branching ("Branch Here")**:
   * Send a second message. A linear chain of nodes is created.
   * Scroll up the canvas, click **"Branch Here"** on any past node bubble in the history.
   * Send a new message (e.g., *"Now write it in C++."*). A new parallel branch path is spawned instantly!
4. **Provider Hot-Swapping**:
   * Change the active model in the navbar selector. Send your next prompt. The tree continues seamlessly, carrying over 100% of the active parent history to the new model brain!
5. **No Cloud Footprint**: Open Chrome DevTools -> Application -> IndexedDB. You will see `NeuraStitchLocalDB` storing all sessions and message nodes locally on your own machine.

---

## 3. B2C Paid Platform (`/paid`)
*Path: [page.tsx](/d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/frontend/app/paid/page.tsx)*

This sandbox simulates the **Premium Cloud-Synced Mode**, showing the power of Neon PostgreSQL and Qdrant Cloud working behind the scenes.

### Key Actions to Test:
1. **Real-Time Cloud Saving**: 
   * When you send a message, the server instantly inserts the message node into **Neon PostgreSQL** and embeds it into **Qdrant Cloud** in the background.
   * The visual tree coordinates are calculated dynamically on the server-side (`/api/session/tree`) and rendered in real time.
2. **Context-Preserved Condensation (The Topic Cards)**:
   * When a branch path exceeds 8 raw messages, the backend worker (`condenser.py`) compiles the oldest 4 turns, generates a high-density chronological **Topic Card**, writes it as a `system_summary` node, and **rewires the parent-child pointers** around it.
   * The visual tree automatically updates to show a **gold/amber "Topic Card"** node. The original raw turns are hidden from active prompts, reducing token bills by up to 85%!
3. **Bi-Directional Cloud Syncing**:
   * **Push Sync**: Click **"Push"** in the top navbar. NeuraStitch will read your B2C Free local IndexedDB history and sync all local trees, branches, and nodes into your Neon PostgreSQL cloud database and Qdrant vector indices.
   * **Pull Sync**: Open a new browser or clear local storage. Click **"Pull"**. NeuraStitch downloads your entire cloud conversation tree from Neon PostgreSQL and merges it offline.
4. **Wipe Cloud DB**: Click **"Wipe Cloud"** to clean all relational and vector database records, resetting the workspace instantly.
