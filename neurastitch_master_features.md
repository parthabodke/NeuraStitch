# NeuraStitch AI: Definitive Master Feature List
### *Hosted B2C SaaS Playground & Enterprise B2B Memory Middleware*

This is the definitive, comprehensive feature list of the **NeuraStitch AI** platform. To maximize speed-to-market, viral traction, and intellectual property defense, the platform is divided into two distinct product lines:
1. **The Hosted B2C SaaS Playground** (Launched first to drive community traction, virality, and product-led growth).
2. **The Private Enterprise VPC Middleware** (Developed in parallel to capture high-ticket legal, healthcare, and consulting B2B accounts).

---

## PART 1: The Hosted B2C SaaS Playground
*A premium, hosted, dark-mode web application designed for individual developers, AI power-users, and prompt engineers to run complex conversation trees using their own API keys (BYOK).*

### 1.1 Core B2C Features (Available at Initial Launch)

* **BYOK Credentials Wallet (Non-Intrusive)**
  * *Description*: Securely accepts and manages user API keys for OpenRouter, Anthropic, OpenAI, and Groq.
  * *Security*: Keys are encrypted client-side in the browser session or state. They never touch our servers in plain text.
  * *Anti-Intrusion UI*: Uses styled, concealed input textboxes that bypass Chrome/Edge password managers, preventing annoying browser credential popups.
* **Visual Context Branching Tree UI (The Hero Feature)**
  * *Description*: A beautiful, glassmorphic interactive node canvas built on **React Flow** that replaces flat, linear chat windows.
  * *How it works*: Every chat message is rendered as a node in a visual tree. Users click on any past chat bubble in their history, select **"Branch Here,"** and instantly spawn a parallel conversation path with different models or prompt variations without losing the background context.
  * *Single-Parent Architecture*: Strictly branching-only (no merging) keeps the tree structure clean, intuitive, and lightning-fast.
* **Context-Preserving Provider Hot-Swapping**
  * *Description*: Change the active model mid-conversation on any branch (e.g. from Claude 3.5 Sonnet to Llama-3-70B on the next message) with one click. NeuraStitch automatically reformats the historical context tree and carries it over to the new provider seamlessly.
* **Deep-Linked Session Sharing & Forking (The Viral Traction Loop)**
  * *Description*: A single-button **"Share Branch"** that generates a unique, read-only, deep-linked public URL.
  * *Viral Loop*: Anyone with the link can explore the visual conversation tree. Readers can click **"Fork Tree"** to clone the entire context path directly into their own NeuraStitch account and continue chatting using their own keys.
* **Basic Vector Memory RAG**
  * *Description*: A fast semantic-search query box inside the active session. Queries are embedded using OpenRouter and matched against the user's active session vectors in Qdrant, retrieving exact historical nodes.

### 1.2 B2C Premium Tier Upgrades (Paid Subscriptions)
* **Persistent Session Library**: Standard free tier stores active sessions locally; Premium tier ($10/mo) syncs all conversation trees and histories securely to our hosted Neon PostgreSQL cloud database for multi-device access.
* **Hosted Context Condenser**: Background topic condensation (compresses inactive branches into timeline Topic Cards, slashing the active context window size by up to 85% and saving user token costs).
* **Advanced Cross-Session Search**: Search and retrieve relevant nodes across *all* of the user's historical trees, not just the active session.

---

## PART 2: The Private Enterprise B2B Middleware
*A highly secure, containerized, proprietary memory middleware deployed entirely inside the enterprise's private cloud (AWS/GCP VPC) or on-premise Kubernetes clusters.*

### 2.1 Enterprise B2B Features (Phase 2 & 3 Parallel Development)

* **Decoupled Private Cloud Deployment**
  * *Description*: The entire memory engine, PostgreSQL timeline database, and Qdrant vector index are installed directly inside the client's secure private cloud. No corporate logs or conversation histories ever leave their security perimeter.
* **Cryptographic Namespace Isolation (The Chinese Wall)**
  * *Description*: Essential for consulting and legal giants advising competing clients in the same industry. 
  * *How it works*: Every client dataset is encrypted with unique envelope keys managed via **AWS KMS** or **HashiCorp Vault**. Even under backend routing bugs, Agent A physically cannot decrypt or access Agent B's database records or vector indices.
* **Stateless BAA/ZDR Big-Tech Integrations**
  * *Description*: Native connectors with enterprise-grade Zero-Data-Retention (ZDR) and HIPAA-compliant Business Associate Agreements (BAA) from Microsoft Azure OpenAI, Google Vertex AI, and AWS Bedrock.
* **100% Offline Air-Gapped Local Model Support**
  * *Description*: Fully compatible with local open-source models (Llama-3, DeepSeek) hosted on private GPU clusters via `vLLM` or `Ollama` endpoints, creating a 100% secure, offline intelligence network.
* **Causal Context Condenser & Temporal Anchoring**
  * *Description*: Automatically groups historical agent conversations into semantic topic clusters, compiles them into high-density **Topic Cards** using local models, and preserves event sequences with deterministic `temporal_anchors` (timestamps).
* **Hybrid RRF Retrieval Engine**
  * *Description*: Combines Qdrant's semantic similarity matching with PostgreSQL's relational graph-distance/time-decay scores using Reciprocal Rank Fusion (RRF) for ultimate query precision.
* **The "Goldmaster" Playbook Injector**
  * *Description*: Allows senior partners to commit successful strategic memory branches as reusable templates. Junior consultants clone these templates, instantly inheriting corporate strategic guardrails.
* **Enterprise Admin Dashboard**
  * *Description*: Full role-based access control (RBAC), Single Sign-On (SSO / SAML), audit logs, and security policy management for IT administrators.
