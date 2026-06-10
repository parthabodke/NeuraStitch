# NeuraStitch AI: Complete Platform Features and Execution Architecture

This document provides a comprehensive log of all implemented features in the NeuraStitch AI platform and outlines the precise sequence of execution and data flow. It is designed to give developers, architects, and stakeholders a complete understanding of how the system operates from start to finish without needing prior context.

---

## 1. Complete Feature List

The NeuraStitch AI platform is divided into two distinct sandboxes (Free Offline Playground and Paid Cloud Platform) to offer a local-first browser experience alongside a robust, cloud-synchronized environment.

### 1.1 Visual Conversation Canvas (React Flow)
* **Node Graph Representation**: Every chat message is rendered as a distinct visual node on an interactive canvas. User nodes are linked to their corresponding assistant response nodes, forming a parent-child connection tree.
* **Context Branching ("Branch Here")**: Users can select any historical message node on the canvas and click "Branch Here." This resets the active path and spawns a new parallel line of conversation, allowing users to test different prompts or model models from any point in the history.
* **Active Node Marker**: A glowing green visual label is applied directly to the active node in the graph. This shows the user exactly which node acts as the parent context for the next prompt.
* **Provider Hot-Swapping**: Users can change the active model (e.g. swapping from Llama to Gemini) mid-branch via a dropdown. Future responses append to the active parent node using the newly selected model, carrying over the entire ancestral context.
* **Default Canvas Landing**: When a user navigates to either playground, the visual Node Graph canvas is loaded as the default view mode instead of the linear chat thread view.

### 1.2 Dual Sandbox Architecture
* **B2C Free Tier Playground (/free)**
  * **Local IndexedDB Storage**: Conversational sessions, trees, and node structures are saved entirely in the user's browser using IndexedDB (wrapped via Dexie.js). No database writes are made to the cloud servers.
  * **Stateless Streaming**: Calls are routed to a stateless endpoint (`/chat/stateless`) that streams responses directly from the LLM back to the browser without persisting session state in PostgreSQL or Qdrant.
* **B2C Paid Cloud Platform (/paid)**
  * **Neon Serverless PostgreSQL Database Sync**: Saves sessions, branches, and nodes into a persistent cloud relational database for multi-device access.
  * **Qdrant Cloud Vector Search**: Embeds and indexes message text in Qdrant Cloud. Enables semantic memory recall across the conversation tree using cosine similarity.

### 1.3 Synchronization Engine (Push/Pull)
* **Cloud Push Sync**: Reads local browser IndexedDB records for the current session and pushes the entire branching tree to the Neon PostgreSQL database. In parallel, it embeds all message contents and uploads them to the Qdrant Cloud vector index.
* **Cloud Pull Sync**: Clears the browser's local IndexedDB nodes for the current session and downloads the complete conversational history tree from Neon PostgreSQL, reconstructing the canvas layout locally.
* **Cloud Reset/Wipe**: Completely wipes all message logs, branching relations, and vector entries from Neon Postgres and Qdrant Cloud for the active session, returning the canvas to an empty state.

### 1.4 Structured Personalization Vault (Memory Vault)
* **Categorized JSON Schema**: Replaces flat database records with a structured user profile document stored directly on the `User` table. The profile contains:
  * **Biographical**: General attributes (e.g. name).
  * **Professional Context**: Role, operating system, and skills arrays.
  * **Interests**: Lists of likes, dislikes, and topics.
  * **Other Notes**: General observations and preferences.
* **Reconciliation Worker**: An asynchronous background parser (`update_user_profile_if_needed`) processes chat turns. It feeds the current profile JSON and the latest chat turn to the LLM, directing it to insert new facts, resolve contradictions, and remove duplicate entries before committing the updated JSON back to the user record.
* **Granular Deletion Endpoint**: A RESTful API (`DELETE /api/user/facts/item`) that removes targeted items from nested arrays or keys in the user's JSON profile.

### 1.5 Personalization Settings UI
* **Color-Coded Tag Pills**: Renders user facts inside the Settings Modal as categorized tag pills (emerald for likes, rose for dislikes, indigo for professional context).
* **Instant Tag Dismissal**: Clicking the `✕` on any tag deletes the item from the profile. The delete request is sent immediately to the REST endpoint, updating the database and the UI state without browser confirmation popups.

### 1.6 Custom Toast Notification System
* **Obsidian-Glass Interface**: Replaces standard browser-blocking `alert()` popups with a custom toast notification overlay in the bottom right corner of the screen.
* **Visual Context Feedback**: Employs colored backdrops with border highlights (emerald for success, crimson/red for errors, slate for informational notices) and automatically dismisses notifications after 4 seconds.

### 1.7 Dynamic API Key Fallbacks
* **Header-Based Wallet (BYOK)**: Transmits dynamic keys from the browser's local storage in custom headers (`X-OpenAI-Key`, `X-Gemini-Key`, `X-Groq-Key`, `X-Openrouter-Key`) on a per-request basis.
* **Environment Fallback**: If header values are empty or omitted, the backend endpoints (`/chat` and `/chat/stateless`) fall back to the server's `.env` configuration (e.g., `GROQ_API_KEY`, `GEMINI_API_KEY`). This prevents background sync and extraction tasks from failing when users rely on server-provided keys.

### 1.8 Context Condenser & Compaction
* **Automatic Summary Compaction**: When an active branch path exceeds 8 raw messages, a background task (`condense_session_if_needed`) takes the oldest 4 messages, summarizes them using the LLM into a "Topic Card" (`system_summary` node), and rewrites the parent-child pointers.
* **Vector Vector Cleaning**: The condenser deletes the raw message vectors of the summarized turns from Qdrant Cloud. This prevents obsolete or duplicate message matches from polluting future semantic retrieval runs.

---

## 2. Detailed Execution Workflow (Storyflow)

Below is the step-by-step sequence of events detailing how the frontend UI, FastAPI backend, relational database, vector database, and LLM providers execute a complete chat cycle.

```
 [User UI]                 [FastAPI Backend]            [PostgreSQL]        [Qdrant Cloud]        [LLM API]
     │                             │                         │                     │                  │
     ├─ 1. Send Prompt ───────────>│                         │                     │                  │
     │                             ├─ 2. Save User Message ─>│                     │                  │
     │                             │                         │                     │                  │
     │                             ├─ 3. Embed & Index ───────────────────────────>│                  │
     │                             │                                               │                  │
     │                             ├─ 4. RAG Vector Search ───────────────────────>│                  │
     │                             │<─ [Semantic Message IDs] ─────────────────────┤                  │
     │                             │                                               │                  │
     │                             ├─ 5. Fetch Active Context Path ────────────────┼─────────────────>│
     │                             │     (RAG + Ancestors + Pinned Context)        │                  │
     │                             │                                               │                  │
     │                             ├─ 6. Call Model (Stream) ──────────────────────┼─────────────────>│
     │<─ 7. Stream SSE Tokens ─────┼───────────────────────────────────────────────┼──────────────────┤
     │                             │                                               │                  │
     │                             ├─ 8. Save Assistant Response ──────────────────┼─────────────────>│
     │                             │                                               │                  │
     │                             ├─ 9. Queue Async Tasks ────────────────────────┼─────────────────>│
     │                             │    (Context Condensation & Fact Extraction)   │                  │
     │                             │                                               │                  │
     │                             ├─ 10. Run Condenser (If turns > 8) ────────────┼─────────────────>│
     │                             │     ├─ Summarize old turns ───────────────────┼─────────────────>│
     │                             │     ├─ Save Topic Card Node ──────────────────┼─────────────────>│
     │                             │     └─ Delete old vectors ───────────────────>│                  │
     │                             │                                               │                  │
     │                             └─ 11. Run Profile Sync ────────────────────────┼─────────────────>│
     │                                   ├─ Analyze User + Assistant turn ─────────┼─────────────────>│
     │                                   └─ Commit updated JSON profile ──────────>│                  │
```

### Step 1: Request Initialization and Header Routing
1. The user enters a prompt in the frontend chat pane and presses Send.
2. The frontend reads the local credentials wallet (`NS_OPENAI_KEY`, `NS_GEMINI_KEY`, etc.) and attaches them as custom headers (`X-OpenAI-Key`, `X-Gemini-Key`, etc.).
3. The request is sent to `/chat` on the FastAPI backend as a JSON payload containing `session_id`, `user_message`, `active_model`, and `parent_node_id`.

### Step 2: Relational Ingestion & Vector Indexing
1. The backend opens a transaction with Neon PostgreSQL.
2. It saves the user's prompt as a new `Message` node, pointing `parent_node_id` to the active leaf node of the current branch.
3. The backend makes an embedding call via Google Gemini (`text-embedding-004`). It takes the user's message, generates a vector representation, and indexes it securely in Qdrant Cloud under the user's namespace.

### Step 3: Context Retrieval and Prompt Assembly
To build the system instructions, the backend queries the database for:
1. **Ancestral Context Path**: Crawls up the tree from `parent_node_id` to the root node to reconstruct the active conversation history.
2. **Pinned Context Anchors**: Pulls any messages along the active path that the user manually pinned.
3. **Topic Card Summaries**: Loads any golden summary cards generated during prior compactions on this branch.
4. **Semantic Memories (RAG)**: Queries Qdrant Cloud for historically relevant nodes based on cosine similarity, filtering out nodes that are already in the active conversational window or summary cards.
5. **Personalization Vault**: Loads the user's `personal_profile` JSON, formatting biographical details, professional role, skills, and interests into a structured text block.
6. **System Prompt Compilation**: Compiles these pieces into a system instruction set and appends the recent conversation history turns, ending with the user's active prompt.

### Step 4: SSE Token Streaming
1. The backend makes a streaming call to the LLM provider using the credentials parsed in the headers (or falling back to the server's `.env` keys if headers are blank).
2. The endpoint returns a `StreamingResponse` using Server-Sent Events (SSE). The browser receives chunks of text in real time, drawing the assistant's node contents dynamically.
3. Once the stream finishes, the backend saves the complete assistant response node to Neon PostgreSQL, setting its parent pointer to the user node created in Step 2.

### Step 5: Post-Stream Background Task Execution
FastAPI hands off execution to background threads so the client connection can close. Two tasks run concurrently:

1. **Context Condensation (`condense_session_if_needed`)**:
   * Evaluates the path length of the current branch.
   * If the number of un-summarized message turns exceeds 8, it gathers the oldest 4 turns.
   * Prompts the LLM to write a chronological summary of these turns.
   * Inserts a new `system_summary` node (Topic Card) into Neon PostgreSQL, adjusts parent pointers to route around the summarized nodes, and wipes the original raw message vectors from Qdrant Cloud.
2. **Memory Vault Reconciliation (`update_user_profile_if_needed`)**:
   * Fetches the user's current `personal_profile` JSON document.
   * Feeds the JSON document and the latest user-assistant message pair to the LLM.
   * The LLM extracts new biographical facts, likes, dislikes, or skills, removes outdated entries, resolves contradictions, and outputs the updated full JSON document.
   * The backend parses this JSON and commits it to the user's row in PostgreSQL.

### Step 6: Settings Interaction and Tag Management
1. When the user opens the Settings Modal, the frontend calls `GET /api/user/facts` using their authorization token.
2. The UI renders the returned profile JSON into categorized visual tag pills.
3. If the user clicks `✕` on a tag, the frontend issues a `DELETE` request to `/api/user/facts/item?category=[category]&value=[value]`.
4. The backend opens the user's record, removes the matching string from the target array, saves the updated JSON profile, and returns a `200 OK`.
5. The frontend updates its local state, displays a custom toast notification in the bottom right corner confirming the removal, and rerenders the settings panel immediately without any blocking browser dialogs.
