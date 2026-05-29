# Production Implementation Plan: NeuraStitch AI (Phase 1 B2C SaaS)

This implementation plan outlines the structural, database, and API work required to launch the **Hosted B2C SaaS Playground** of NeuraStitch. It enforces a high-performance **Local-First architecture for Free Tier users** (protecting our server cloud database costs) and a secure **Cloud-Synced architecture for Premium Tier users** using JWT authentication.

---

## 1. Architectural Overview (Local-First + Stateless Server Bridge)

To maintain **exactly $0.00 in cloud database costs for free users** while enabling seamless context-preserved provider hot-swapping:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User's Web Browser                              │
│                                                                        │
│   ┌─────────────────┐             ┌────────────────────────────────┐   │
│   │   React Flow    │◄───────────►│    IndexedDB (Dexie.js)        │   │
│   │   Canvas UI     │  Redraws    │  - Stores conversation trees   │   │
│   └─────────────────┘             │  - Stores active branch path   │   │
│                                   └────────────────────────────────┘   │
└────────────────────────┬───────────────────────────────────────────────┘
                         │
                         │ HTTPS POST /chat (Stateless Conversation Path)
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend Server                             │
│       - Acts as stateless routing proxy for Free Users                 │
│       - Verifies user JWT tokens and Premium Membership status          │
│       - Performs Neon PostgreSQL Cloud Syncing for Premium Users       │
└────────────────────────┬───────────────────────────────────────────────┘
                         │
                         │ Dynamic API Keys (BYOK via OpenRouter)
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     OpenRouter / OpenAI Cloud APIs                     │
└────────────────────────────────────────────────────────────────────────┐
```

---

## 2. Authentication & Membership Design (Free vs. Premium)

To manage user logins, track payment status, and unlock premium features, we implement a secure, lightweight **JWT Authentication Framework** inside our FastAPI backend and PostgreSQL database.

### 2.1 The PostgreSQL Schema Updates (Neon PostgreSQL)

We will introduce a `users` table to track auth credentials and premium subscription status:

```sql
-- Track user registrations and subscription tiers
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE, -- Upgraded via billing/Stripe hook
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Associate saved conversation trees to premium accounts
ALTER TABLE conversation_nodes ADD COLUMN user_id INT REFERENCES users(id);
```

### 2.2 JWT Token Issuance Lifecycle
1. **Signup/Login**: The user posts email & password to `/api/auth/login`. FastAPI validates credentials and generates a secure JSON Web Token (JWT) containing the user’s `user_id`, `email`, and `is_premium` status.
2. **Token Storage**: The frontend stores this JWT securely in LocalStorage or an HttpOnly cookie.
3. **Protected Requests**: For premium features (cloud syncing, auto-condensation), the frontend attaches the JWT in the header `Authorization: Bearer <token>`.
4. **Instant Verification**: FastAPI decodes the JWT using a secure master key `JWT_SECRET` to verify premium status in milliseconds without making repetitive database lookups on every chat request.

---

## 3. Proposed Changes

### Component 3.1: Frontend Local-First IndexedDB Engine

We will build a high-performance local database controller inside Next.js using `Dexie.js` (a robust wrapper for browser IndexedDB).

#### [NEW] [db.ts](file:///d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/frontend/lib/db.ts)
* Initialize the local IndexedDB database `neurastitch_local`.
* Declare the schema:
  * `nodes`: Primary Key `id`, indices `[session_id, parent_node_id, branch_id]`. Matches our relational schema exactly.
  * `sessions`: Primary Key `id`, indices `[title, last_active]`.

#### [MODIFY] [page.tsx](file:///d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/frontend/app/page.tsx)
* **Visual Node Canvas (React Flow)**: Integrate an interactive visual canvas showing conversation nodes as clean, glassmorphic bubbles connected by parent-child arrows.
* **Onboarding & Auth Modals**: Add a sleek login/signup credential card in the dashboard.
* **Stateless Chat Trigger**: Modify chat triggers so that on the Free Tier, the app reads the active branch path (from Root to Leaf) from IndexedDB, packages it as a flat message history list, and sends it directly to `/api/chat` along with the user's BYOK keys.
* **Cloud Sync Hook**: If JWT indicates `is_premium = true`, trigger automatic bi-directional syncing:
  * When a local change occurs, push nodes to `/api/sync/push`.
  * On app launch, pull nodes from `/api/sync/pull` and merge them into IndexedDB.

---

### Component 3.2: FastAPI Backend Stateless Router & Sync Controller

We will extend our backend to support user auth, JWT handling, and premium data syncing.

#### [MODIFY] [database.py](file:///d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/backend/database.py)
* Add SQLAlchemy models for `User` mapping to the `users` table.
* Add functions to register users, verify hash passwords (using `passlib` with `bcrypt`), and check premium flags.

#### [MODIFY] [main.py](file:///d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/backend/main.py)
* **Auth Endpoints**:
  * `POST /api/auth/register`: Hashes passwords, inserts into PostgreSQL, and issues a JWT.
  * `POST /api/auth/login`: Checks credentials, generates JWT.
* **Sync Endpoints (Premium Only)**:
  * `POST /api/sync/push`: Receives an array of conversation nodes from the browser, updates the Neon PostgreSQL cloud database, and indexes them in Qdrant Cloud.
  * `GET /api/sync/pull`: Fetches the entire conversation tree for the logged-in user from Neon PostgreSQL to download to their local IndexedDB.
* **Chat Route Integration**:
  * Update `/api/chat` to accept direct, stateless message arrays in the POST payload for Free Tier users, skipping cloud database writes.

#### [MODIFY] [condenser.py](file:///d:/Final%20Projects/LLM%20State%20Manager/NeuraStitch/backend/condenser.py)
* Restructure the Context Condenser to process by **Topic Similarity** in Qdrant:
  1. For a Premium user's active thread, fetch all raw nodes from Postgres.
  2. Embed nodes and query Qdrant to find semantic clusters (e.g. topic tags like "outage", "refactor").
  3. Compile each cluster into a high-density, chronological **Topic Card** mapping back to the target nodes.
  4. Write the Topic Cards to PostgreSQL and flag the target nodes as `is_condensed = true`.

---

## 4. Verification Plan

### Automated Tests
* Create unit tests verifying token generation, password hashing, and token parsing.
* Create unit tests verifying that `/api/chat` operates in 100% stateless mode when no `Authorization` header is passed.

### Manual Verification
1. Open the local B2C app on `http://localhost:3000`.
2. Clear browser databases, enter BYOK credentials, and converse. Validate that the React Flow tree branches dynamically, hot-swaps models, and saves records **only inside the browser IndexedDB**.
3. Register a new user, update `is_premium = true` manually in Neon Postgres.
4. Log in on the dashboard. Validate that cloud synchronization triggers immediately, saving all IndexedDB nodes into Neon PostgreSQL and vectorizing them in Qdrant Cloud.
