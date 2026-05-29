# Phase 1: B2C SaaS Playground Execution Checklist

This checklist tracks our progress as we build the **Hosted B2C SaaS Playground** using our Local-First + Stateless Server Bridge architecture.

---

## 1. Relational Database Schema Updates (PostgreSQL)
* [x] Add `users` table schema in `backend/database.py` (Message self-referencing relationship `parent_node_id`)
* [x] Associate saved nodes to registered users (`user_id` foreign key)
* [x] Validate successful database migrations and relationships

## 2. JWT Authentication Framework (Deferred for Phase 1.5 Testing)
* [ ] Configure secure password hashing using `bcrypt` and `passlib`
* [ ] Implement JWT token generation (with secret key and expiration limits)
* [ ] Build a dependency function to decode JWTs and verify premium credentials in FastAPI
* [ ] Create API Endpoint: `POST /api/auth/register`
* [ ] Create API Endpoint: `POST /api/auth/login`

## 3. Backend Stateless Router & Sync Controls
* [x] Modify `POST /api/chat` to accept direct, stateless message histories for Free Tier users (skips DB writes)
* [x] Create Sync Endpoint: `POST /api/sync/push` (Inserts client browser nodes to Postgres & Qdrant)
* [x] Create Sync Endpoint: `GET /api/sync/pull` (Fetches entire user node tree from Postgres)
* [x] Create React Flow Endpoint: `GET /api/session/tree` (Formulates nodes and edges with server-side layout coordinates)

## 4. Frontend Local-First IndexedDB Engine
* [x] Install `dexie` and configure the IndexedDB browser schema in `frontend/lib/db.ts`
* [x] Set up local node creation and chat state saving triggers in browser storage
* [x] Verify IndexedDB schema successfully stores multi-branch conversation paths offline

## 5. React Flow Branching Tree Visuals
* [x] Install `@xyflow/react` (React Flow) package dependencies in Next.js
* [x] Embed the glassmorphic interactive node tree canvas in `/free` and `/paid` routes
* [x] Map parent-child database relationships to visual node edges in the React Flow viewport
* [x] Wire visual branching triggers ("Branch Here") and model hot-swapping buttons on tree nodes

## 6. Auth Modals & Cloud Sync Engine
* [x] Create sleek gateway portal landing page on the Home route `/`
* [x] Build the bi-directional Cloud Syncing hook (IndexedDB <-> Neon Postgres via Push/Pull buttons)
* [x] Verify automatic synchronization triggers and Topic Card manifestations on the canvas

