# NeuraStitch AI (Phase 1 Core)

Welcome to **NeuraStitch AI (Phase 1)**. This is a fully rebuilt, enterprise-ready, production-grade conversational AI platform with persistent hybrid memory and background factual condensation. 

This new version is designed to scale securely to thousands of concurrent users at **$0 operational API/Vector costs for the server** by utilizing a **Bring Your Own Key (BYOK)** model, **Neon Serverless PostgreSQL**, **Qdrant Cloud Free Tier**, and **Google Cloud TPU Embeddings**.

---

## 🚀 Key Features

* **Bring Your Own Key (BYOK) Security Enclave**: Users enter their private Gemini or OpenAI keys. Next.js caches these purely inside the browser (`localStorage`) and transmits them ephemerally in custom request headers (`X-OpenAI-Key`, `X-Gemini-Key`). Keys never touch the database.
* **Neon Serverless PostgreSQL Integration**: A solid relational database representing the transactional source of truth, storing structured chat turns, user sessions, and condensed memory cards.
* **Qdrant Cloud Free Tier Indexing**: Vector embeddings are indexed in Qdrant Cloud for free. Uses the exact same Python SDK as production container nodes, facilitating instant cloud scalability.
* **Decoupled Cloud TPU Embeddings**: Offloads local CPU vectorization by querying Google's high-speed, stable `text-embedding-004` model. Supported by a generous, cost-free tier of **1,500 requests per minute**.
* **Auto-Summarization "Context Condenser"**: Background async task that monitors session depth. Once unconsolidated turns exceed 8, the backend extracts the oldest 4 turns, prompts the active LLM to generate a high-density summary card, saves it to PostgreSQL, and purges the raw vectors from Qdrant Cloud.

---

## 🛠️ Tech Stack & Service Providers

| Component | Tech / Provider | Cloud Free Tier Scale |
| :--- | :--- | :--- |
| **Frontend** | React / Next.js + Tailwind CSS | Perpetual Free Tier (Vercel / Netlify) |
| **Backend** | Python / FastAPI + Uvicorn | Perpetual Free Tier (Render / Google Cloud Run) |
| **Relational DB** | Neon Serverless PostgreSQL | **0.5 GiB free storage** + auto scale-to-zero |
| **Vector DB** | Qdrant Cloud | **1 cluster, 1GB RAM, 4GB disk** (Millions of vectors free) |
| **Embeddings** | Gemini `text-embedding-004` | **1,500 requests per minute** 100% free |

---

## ⚙️ Quickstart Setup Guide

Follow these steps to configure your environment and run NextGen Core locally in under 3 minutes:

### 1. Retrieve Cloud Database and API Keys

1. **Neon PostgreSQL Connection String**:
   * Sign up at [neon.tech](https://neon.tech) and create a new project.
   * Copy the pooled SQL connection string (e.g., `postgresql://[user]:[password]@[host]/[dbname]?sslmode=require`).
2. **Qdrant Cloud Cluster URL & API Key**:
   * Sign up at [qdrant.to/cloud](https://qdrant.to/cloud) and launch a Free Tier cluster.
   * Copy your **Cluster URL** (e.g., `https://xxxxxx-xxxx.gcp.qdrant.io:6333`) and generate a cluster **API Key**.
3. **Master Gemini API Key**:
   * Sign up at [aistudio.google.com](https://aistudio.google.com) and click **Get API Key** to secure your free vectorization tokens.

---

### 2. Configure Environment Variables

1. Navigate to `/nextgen-core/backend/`.
2. Rename the template `.env.example` file to `.env`:
   ```bash
   mv .env.example .env
   ```
3. Open `.env` and paste your retrieved credentials:
   ```env
   DATABASE_URL=postgresql://your_neon_details_here
   QDRANT_HOST=https://your_qdrant_url_here:6333
   QDRANT_API_KEY=your_qdrant_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

---

### 3. Launch the Stack (Single-Click Startup)

To run the Next.js frontend and the FastAPI backend concurrently in separate development log terminals, run the custom batch script from your root `/nextgen-core/` directory:

```bash
.\start_nextgen.bat
```

The script will automatically check your Python/Node installations, install package dependencies via `pip` and `npm`, and spawn the development environments:
* **Next.js Web Interface**: [http://localhost:3000](http://localhost:3000)
* **FastAPI Backend Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🔒 Security Architecture: Header-Based Key Delivery

To maximize user trust and eliminate developer data liabilities:
* Keys are kept client-side using browser-native context.
* During API requests, Next.js passes dynamic keys via headers:
  * `X-OpenAI-Key`
  * `X-Gemini-Key`
* FastAPI reads these values per-request to instantiate ephemeral client instances on the fly:
  ```python
  client = genai.Client(api_key=x_gemini_key)
  ```
* No user keys are ever saved to disk, logged to console, or written to PostgreSQL.
