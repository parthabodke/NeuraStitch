# NeuraStitch AI

NeuraStitch AI is a visual version-control canvas and memory middleware framework for conversational AI agents. The platform offers a decoupled context tree interface built on React Flow, letting developers branch conversation paths, hot-swap LLM providers mid-stream, and synchronize context structures with Neon PostgreSQL and Qdrant Cloud.

---

## Core Features

* **Visual Context Branching Tree**: Replaces linear chat streams with an interactive React Flow node graph. Users can branch conversation threads at any historic node, run multiple scenarios in parallel, and track active paths visually.
* **Bring Your Own Key (BYOK) Security**: Accepts user API keys (OpenRouter, OpenAI, Gemini, Groq) client-side in the browser. Keys are passed ephemerally in custom headers during requests and are never persisted on the server.
* **Structured JSON Memory Vault**: Tracks user facts, skills, preferences, and biographical details in a categorized JSON profile. A background worker parses conversations, updates the schema incrementally, and resolves conflicts or duplicate facts automatically.
* **Context Condenser & Compression**: Monitors branch depth. When unconsolidated turns exceed a configured threshold, the backend condenses the oldest turns into high-density topic summaries (Topic Cards) to minimize active token consumption.
* **Cloud Sync**: Allows bi-directional syncing between local browser storage (IndexedDB) and cloud databases (Neon PostgreSQL and Qdrant Cloud).

---

## Technical Stack

* **Frontend**: Next.js, React, React Flow, Dexie.js (IndexedDB wrapper)
* **Backend**: FastAPI, Python, Uvicorn, SQLAlchemy
* **Databases**: Neon Serverless PostgreSQL (relational transactions), Qdrant Cloud (vector search index)
* **LLM Integrations**: Google Gemini, OpenAI, Groq, OpenRouter

---

## Quickstart Setup Guide

### 1. Prerequisites and API Keys

To configure the application, retrieve credentials for the following services:

* **Neon PostgreSQL**: Sign up at [neon.tech](https://neon.tech), create a project, and copy the PostgreSQL connection string.
* **Qdrant Cloud**: Create a cluster at [qdrant.to/cloud](https://qdrant.to/cloud) and retrieve your Cluster URL and API Key.
* **Master API Keys**: Obtain fallback API keys for Groq, OpenRouter, or Gemini if you wish to support server-side model routing when client headers are not passed.

### 2. Configuration

1. Navigate to the `backend` directory.
2. Copy the template `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Populate the configuration parameters:
   ```env
   DATABASE_URL=postgresql://[user]:[password]@[host]/[dbname]?sslmode=require
   QDRANT_HOST=https://[your-cluster-url].gcp.qdrant.io:6333
   QDRANT_API_KEY=your_qdrant_api_key
   GEMINI_API_KEY=your_fallback_gemini_key
   GROQ_API_KEY=your_fallback_groq_key
   ```

### 3. Running the Stack

A single-click batch script handles dependency installation and concurrency:

```bash
.\start_nextgen.bat
```

The script verifies Node.js and Python dependencies, installs missing requirements, and boots the development servers:
* **Next.js Web Interface**: http://localhost:3000
* **FastAPI Backend Docs**: http://localhost:8000/docs

---

## Security Architecture

* **Client Isolation**: User API credentials reside inside the user's browser context (`localStorage`).
* **Ephemeral Delivery**: Keys are transmitted via HTTP headers (`X-OpenAI-Key`, `X-Gemini-Key`, `X-Groq-Key`, `X-Openrouter-Key`) on a per-request basis.
* **Zero Persistence**: The backend uses these headers to instantiate client connections on the fly. No dynamic keys are written to logging services or databases.
* **Server Fallback**: If dynamic headers are omitted, the backend falls back securely to backend `.env` variables to call active model completion pipelines.
