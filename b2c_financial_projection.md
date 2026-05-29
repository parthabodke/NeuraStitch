# NeuraStitch B2C SaaS: Infrastructure & Cost Projection Model
### *Hosted BYOK (Bring Your Own Key) Platform Economics*

Because NeuraStitch operates as a **BYOK (Bring Your Own Key) SaaS**, we do not bear the astronomical LLM reasoning costs of generating chat responses (GPT-4o, Claude 3.5). The user pays the model provider directly via their own API key. 

However, since we are hosting their relational context tree and vector indexes, we must pay for the database storage, hosting, and our background memory compaction worker.

This document outlines the exact infrastructure stack, monthly costs, and unit economics across three scaling tiers.

---

## 1. The Core Infrastructure Stack (Hosted B2C)

To deploy the hosted platform with enterprise-grade stability, we leverage serverless, auto-scaling developer tools that scale from $0 to enterprise sizes seamlessly:

| Layer | Provider | Role | Free Tier Capabilities |
| :--- | :--- | :--- | :--- |
| **Frontend App** | **Vercel** or **Railway** | Next.js dark-obsidian web app. | Unlimited bandwidth, fast global CDN edge. |
| **Backend API** | **Railway** or **Render** | FastAPI token streamer & agent router. | $5.00/month credit (generous compute). |
| **Relational DB** | **Neon PostgreSQL** | Multi-tenant Tree DB (`conversation_nodes`). | 3GB storage, auto-scaling compute, serverless. |
| **Vector Index** | **Qdrant Cloud** | Semantic memory embedding vectors. | 1GB RAM cluster (fits ~20K-25K vectors of 768-dim). |
| **Background AI** | **OpenRouter** | Background Topic Condensation & Embeddings. | N/A (Pay-as-you-go, extremely low costs). |

---

## 2. Running Cost Breakdown: The 3 Startup Phases

### Phase 1: Bootstrapping / Launch Phase (0 to 1,000 Active Users)
* **Goal**: Launch the B2C playground immediately, generate traction on Twitter/Reddit, and gather product-led feedback.
* **Architecture**: Free-tiers with lightweight hobbyist upgrades.

* **App Hosting**: **$5.00 / month** (Railway Developer Tier)
* **PostgreSQL (Neon)**: **$0.00 / month** (Free Tier - 3GB storage is massive for pure text trees; handles ~1.5 million message nodes).
* **Vector DB (Qdrant)**: **$0.00 / month** (Free Tier - 1GB RAM holds ~25,000 vector records).
* **Background AI (Condenser & Embeddings)**:
  * For 1,000 users, say 500 are highly active (averaging 200 messages/month).
  * We run the background condenser (using `meta-llama/llama-3-8b-instruct` or `openai/gpt-4o-mini` via our master OpenRouter key) and embeddings (`openai/text-embedding-3-small`).
  * Total background AI cost: **$10.00 / month** (at an average of $0.02 per active user per month).
* **Total Projected Cost (Phase 1)**: **~$15.00 / month**
* **Unit Economics**: Direct profit margins are **virtually 100%**.

---

### Phase 2: Traction & Scaling Phase (1,000 to 10,000 Active Users)
* **Goal**: Scale out to support growing developer and writer traffic.
* **Architecture**: Upgraded professional serverless tiers to handle concurrent WebSocket/SSE connections.

* **App Hosting**: **$30.00 / month** (Railway Pro Tier - 2x dynamic auto-scaling nodes).
* **PostgreSQL (Neon)**: **$19.00 / month** (Neon Scale Tier - 10GB storage, auto-scaling compute).
* **Vector DB (Qdrant Cloud)**: **$19.00 / month** (Developer Tier - 4GB RAM cluster, fits ~100k vectors).
* **Background AI (OpenRouter)**:
  * Running our background worker for 10,000 users (~3,000 highly active).
  * Direct compaction/embedding cost: **$60.00 / month**.
* **Database Backups & Logging**: **$15.00 / month** (Axiom + AWS S3 backups).
* **Total Projected Cost (Phase 2)**: **~$143.00 / month**
* **Cost Per User**: **$0.014 / month** (1.4 cents per user!).

---

### Phase 3: Rapid Growth Phase (10,000 to 100,000 Active Users)
* **Goal**: High-volume consumer SaaS operations.
* **Architecture**: High-availability cloud clustering.

* **App Hosting**: **$150.00 / month** (Railway Team Tier or AWS ECS Fargate).
* **PostgreSQL (Neon)**: **$80.00 / month** (Scales dynamically based on storage & read/write computed hours).
* **Vector DB (Qdrant Cloud)**: **$90.00 / month** (Qdrant production node cluster).
* **Background AI (OpenRouter)**:
  * For 100,000 users (~30,000 active, conducting massive daily memory compactions).
  * Direct OpenRouter compaction cost: **$600.00 / month**.
* **Monitoring, Security & Logging**: **$100.00 / month** (Datadog + Cloudflare Enterprise Shield).
* **Total Projected Cost (Phase 3)**: **~$1,020.00 / month**
* **Cost Per User**: **$0.010 / month** (1.0 cent per user!).

---

## 3. Financial Unit Economics: Why This is a Goldmine

Because our background AI costs are so minor, the business enjoys **unprecedented SaaS gross margins**. 

Let's model the **Monthly Recurring Revenue (MRR)** under a conservative pricing structure:
* **Free Tier**: Up to 3 active branches, 50 messages per session, standard hot-swapping.
* **Premium Tier ($10 / month)**: Unlimited branches, persistent session history, collaborative session cloning, auto-compaction Topic Condenser (subsidized by us).

### Financial Projection Table:

| Phase | Active Users | Premium Subscriptions (3% CR) | Monthly Revenue (MRR) | Infrastructure Cost | Monthly Net Profit | Gross Margin |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | 1,000 | 30 users | **$300.00** | $15.00 | **$285.00** | **95.0%** |
| **Phase 2** | 10,000 | 300 users | **$3,000.00** | $143.00 | **$2,857.00** | **95.2%** |
| **Phase 3** | 100,000 | 3,000 users | **$30,000.00** | $1,020.00 | **$28,980.00** | **96.6%** |

---

## 4. Key Strategies to Maximize Margins

1. **Leverage User-Key Compaction (Optional Setting)**:
   * We can add a simple toggle in the user credentials settings: *"Use my personal API key for background memory compression (saves token limits)."*
   * If a user turns this on, **our direct background AI costs drop to exactly $0.00**, shifting 100% of the computation cost directly to their own keys.
2. **Neon Serverless Autoscaling**:
   * Neon PostgreSQL automatically sleeps (scales compute to 0) when no database calls are active. During low-traffic hours (nighttime), our database costs drop to zero, preventing cash drain during bootstrapping.
3. **Embeddings Token Compression**:
   * In `memory.py`, we already truncate embeddings text or slice vector dimensions, saving Qdrant index space and lowering embedding token costs.
