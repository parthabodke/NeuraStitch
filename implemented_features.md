# NeuraStitch AI: Implemented Features Log
*A living record of all features built and deployed in the NeuraStitch AI codebase.*

---

## 1. Decoupled Visual Conversation Branching
* **Visual Node Canvas (React Flow)**
  * *Description*: Conversational user and assistant turns are rendered as custom nodes in a branching tree diagram, replacing traditional linear chat sheets.
  * *Branching ("Branch Here")*: Users can click any past node bubble in their chat tree, select "Branch Here", and start a new parallel conversation stream from that point.
  * *Active Path Highlighting*: The currently selected leaf node is marked with an active glowing green label on the graph, clearly displaying where the next prompt will append.
  * *Provider Hot-Swapping*: Users can swap the AI model mid-branch in the navbar dropdown (e.g. from Claude to Gemini). The visual tree automatically preserves the lineage and maps future nodes to the new brain.
  * *Files*:
    * [frontend/app/free/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/free/page.tsx) (offline browser-based IndexedDB trees)
    * [frontend/app/paid/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/paid/page.tsx) (cloud-synced Neon Postgres & Qdrant trees)

---

## 2. Decoupled Memory Vault & Personalization Layer
* **Structured JSON Profile (Path 2: Categorized Schema)**
  * *Description*: Refactored user personalization memory from flat relational tables to a structured JSON document stored on the `User` table.
  * *Categories*: biographical details (e.g., location), professional context (role, operating system, and skills), interests (likes, dislikes, topics), and general notes.
  * *Incremental Profile Sync*: A background worker (`update_user_profile_if_needed`) processes new chat turns, compares them with the existing profile JSON, merges new facts, reconciles contradictions, and commits the resolved profile.
  * *RESTful Tag Deletion*: Supports deleting nested facts directly from specific lists (e.g., skills or likes) via endpoints.
  * *Files*:
    * [backend/database.py](file:///d:/Final Projects/LLM State Manager/NeuraStitch/backend/database.py) (relational models and alter-table startup migrations)
    * [backend/condenser.py](file:///d:/Final Projects/LLM State Manager/NeuraStitch/backend/condenser.py) (LLM fact extraction and reconciliation logic)
    * [backend/main.py](file:///d:/Final Projects/LLM State Manager/NeuraStitch/backend/main.py) (`GET /api/user/facts` and `DELETE /api/user/facts/item` endpoints)

---

## 3. Premium Personalization Settings UI
* **Categorized Tag Pills**:
  * *Description*: Displays the user's auto-extracted profile inside the Settings Modal using a structured tab layout.
  * *Tags*: Renders specific skills, likes, and dislikes as color-coded tag pills (emerald for likes, rose for dislikes, indigo for skills).
  * *Instant Discard*: Users can click `✕` next to any tag to delete it. The UI performs a REST call and removes it from the screen and the backend database instantly without blocking browser popups.
  * *Files*:
    * [frontend/app/paid/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/paid/page.tsx)

---

## 4. Left Sidebar Control Panel & Pinning
* **Left Navigation Sidebar**:
  * *Description*: Features a collapsible layout for clean screen space. Includes a session selector and parameter configurations (model selection, active session ID).
  * *Pinned Nodes Explorer*: Displays pinned context anchors and topic summaries along the active path. Clicking a pinned node immediately jumps the focus of the canvas to that node, making it easy to unpin or view details.
  * *Files*:
    * [frontend/app/free/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/free/page.tsx)
    * [frontend/app/paid/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/paid/page.tsx)

---

## 5. API Key Fallbacks (BYOK and Server-Side)
* **Robust Key Fallback Routing**:
  * *Description*: The backend `/chat` and `/chat/stateless` endpoints are configured to fall back to server-side `.env` variables (`GROQ_API_KEY`, `GEMINI_API_KEY`, etc.) if headers from the frontend key wallet are empty. This ensures background sync tasks always have credentials.
  * *Files*:
    * [backend/main.py](file:///d:/Final Projects/LLM State Manager/NeuraStitch/backend/main.py)
    * [backend/providers.py](file:///d:/Final Projects/LLM State Manager/NeuraStitch/backend/providers.py)

---

## 6. Custom Toast Notification System
* **Obsidian-Glass Notifications**:
  * *Description*: Replaced all native browser-blocking `alert()` popups with a beautiful, modern custom notification overlay at the bottom-right of the screen.
  * *Types*: Supports success (emerald), error (crimson/red), and info (obsidian dark) notifications, automatically dismissing after 4 seconds.
  * *Files*:
    * [frontend/app/free/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/free/page.tsx)
    * [frontend/app/paid/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/paid/page.tsx)

---

## 7. Default Landing View & Button Sequence
* **Visual Canvas Focus**:
  * *Description*: Changed the default view mode state so that landing on the playground displays the Graph Explorer (React Flow node canvas) by default rather than the linear chat view.
  * *Navbar Ordering*: Reordered the Premium Cloud header buttons to the requested layout sequence: **Wallet**, **Wipe Cloud**, then **Settings**.
  * *Files*:
    * [frontend/app/free/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/free/page.tsx)
    * [frontend/app/paid/page.tsx](file:///d:/Final Projects/LLM State Manager/NeuraStitch/frontend/app/paid/page.tsx)

---

## 8. Timezone-Aware Timestamp Serialization
* **ISO 8601 UTC Z-Suffix Serialization**:
  * *Description*: Backend serializes all database message timestamps with a trailing `"Z"` UTC timezone indicator. This ensures the browser parses them correctly as UTC time and automatically translates them to the user's correct local timezone.
  * *Files*:
    * [backend/main.py](file:///d:/Final Projects/LLM State Manager/NeuraStitch/backend/main.py)
