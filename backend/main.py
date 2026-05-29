# nextgen-core/backend/main.py
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
from datetime import datetime

from database import (
    init_db,
    save_message,
    get_active_context_messages,
    clear_session_history,
    get_all_session_nodes,
    get_path_to_node,
    Message
)
from memory import (
    upsert_message_vector,
    search_similar_message_ids,
    delete_session_vectors,
    qdrant_client,
    COLLECTION_NAME
)
from condenser import condense_session_if_needed
from providers import call_model_stream

app = FastAPI(title="NeuraStitch AI (NextGen Core)")

# Enable CORS for the Next.js React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Next.js frontend domain
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str
    user_message: str
    active_model: str
    parent_node_id: Optional[str] = None
    branch_id: Optional[str] = "main"
    k: int = 4
    last_n: int = 4


class SyncPushRequest(BaseModel):
    session_id: str
    nodes: List[Dict]  # List of serialized message nodes


@app.on_event("startup")
def startup_event():
    """Trigger DB and Vector Collection initializations on startup."""
    print("DEBUG: Launching database tables and Qdrant Cloud connections...")
    init_db()
    print("DEBUG: NextGen Core backend is live and ready.")


@app.post("/chat")
async def chat(
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    x_groq_key: Optional[str] = Header(None, alias="X-Groq-Key"),
    x_openrouter_key: Optional[str] = Header(None, alias="X-Openrouter-Key")
):
    """
    Main state-managed streaming chat loop.
    Supports Git-like context branching by traversing active node parent chains.
    """
    keys = {
        "openai": x_openai_key,
        "gemini": x_gemini_key,
        "groq": x_groq_key,
        "openrouter": x_openrouter_key
    }
    
    # 1. Relational Save: Save user query with parent links
    user_msg_db = save_message(
        session_id=req.session_id,
        role="user",
        content=req.user_message,
        parent_node_id=req.parent_node_id,
        branch_id=req.branch_id or "main",
        model_used=req.active_model
    )
    
    # 2. Vector Index: Embed and save vector to Qdrant Cloud
    try:
        upsert_message_vector(session_id=req.session_id, message_id=user_msg_db.id, content=req.user_message, keys=keys)
    except Exception as e:
        print(f"WARNING: Qdrant vector indexing failed: {e}")
        
    # 3. RAG: Similarity search in Qdrant Cloud
    semantic_msg_ids = []
    try:
        semantic_msg_ids = search_similar_message_ids(session_id=req.session_id, query=req.user_message, top_k=req.k, keys=keys)
    except Exception as e:
        print(f"WARNING: Semantic retrieval query failed: {e}")
        
    # 4. DB Retrieval: Fetch active path context (summaries and recent turns)
    # If parent_node_id is provided, get context messages on that specific active path!
    summaries, recent_turns = get_active_context_messages(
        session_id=req.session_id,
        active_node_id=req.parent_node_id,
        last_n=req.last_n
    )
    
    # Load semantic matching turns from PostgreSQL, filtering out duplicates in active window
    recent_ids = {msg.id for msg in recent_turns}
    semantic_turns = []
    if semantic_msg_ids:
        from database import SessionLocal
        db = SessionLocal()
        try:
            db_turns = db.query(Message).filter(Message.id.in_(semantic_msg_ids)).all()
            for turn in db_turns:
                if turn.id not in recent_ids and turn.role != "system_summary":
                    semantic_turns.append(turn)
        finally:
            db.close()
            
    # 5. Stitch Context Prompt
    compiled_messages = [
        {
            "role": "system",
            "content": (
                "You are an enterprise-grade AI Assistant operating with long-term context memory.\n"
                "Review the long-term context cards and recent conversation history carefully. "
                "Synthesize your response using these memories whenever relevant. Stay factual, clear, and concise."
            )
        }
    ]
    
    # Prepend Pinned summaries
    for summary in summaries:
        compiled_messages.append({"role": "system", "content": f"[Topic Card Summary]: {summary.content}"})
        
    # Inject semantic memories
    for turn in semantic_turns:
        compiled_messages.append({
            "role": "system",
            "content": f"[Historical semantic memory ({turn.role})]: {turn.content}"
        })
        
    # Append recent conversation turns on the branch
    for turn in recent_turns:
        compiled_messages.append({"role": turn.role, "content": turn.content})
        
    # Append the current user prompt
    compiled_messages.append({"role": "user", "content": req.user_message})

    # 6. SSE Streaming Token Generator
    def streaming_generator():
        full_text = []
        try:
            stream_source = call_model_stream(req.active_model, compiled_messages, keys)
            for chunk in stream_source:
                full_text.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return
            
        # 7. Post-Stream Tasks: Save generated reply as child of the user node
        assistant_content = "".join(full_text).strip()
        if assistant_content:
            assist_msg_db = save_message(
                session_id=req.session_id,
                role="assistant",
                content=assistant_content,
                parent_node_id=user_msg_db.id,  # Child of the user node
                branch_id=req.branch_id or "main",
                model_used=req.active_model
            )
            
            # Embed and index vector to Qdrant Cloud
            try:
                upsert_message_vector(session_id=req.session_id, message_id=assist_msg_db.id, content=assistant_content, keys=keys)
            except Exception as e:
                print(f"WARNING: Qdrant assistant indexing failed: {e}")
                
            # Queue context condensation task in the background
            background_tasks.add_task(
                condense_session_if_needed,
                session_id=req.session_id,
                active_model=req.active_model,
                keys=keys,
                active_node_id=user_msg_db.id
            )
            
    return StreamingResponse(streaming_generator(), media_type="text/event-stream")


@app.post("/chat/stateless")
async def chat_stateless(
    messages: List[Dict[str, str]],
    active_model: str = Query(...),
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    x_groq_key: Optional[str] = Header(None, alias="X-Groq-Key"),
    x_openrouter_key: Optional[str] = Header(None, alias="X-Openrouter-Key")
):
    """
    Stateless chat loop (Free Tier fallback).
    Accepts flat array of past messages and routes directly to LLM without database writes.
    """
    keys = {
        "openai": x_openai_key,
        "gemini": x_gemini_key,
        "groq": x_groq_key,
        "openrouter": x_openrouter_key
    }
    
    def streaming_generator():
        try:
            stream_source = call_model_stream(active_model, messages, keys)
            for chunk in stream_source:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(streaming_generator(), media_type="text/event-stream")
@app.get("/api/session/tree")
def get_session_tree(session_id: str):
    """
    Constructs and returns visual nodes and edges formatted perfectly for React Flow.
    Pairs user queries and assistant responses into single, unified Interaction Nodes.
    Applies a post-order tree layout algorithm to center parents exactly above
    their child branches, preventing any overlapping nodes.
    """
    db_nodes = get_all_session_nodes(session_id)
    if not db_nodes:
        return {"nodes": [], "edges": []}
        
    node_map = {n.id: n for n in db_nodes}
    
    # 1. Group nodes into Visual Interactions
    # Build a map of parent_id -> children_nodes
    db_children = {}
    for n in db_nodes:
        if n.parent_node_id:
            if n.parent_node_id not in db_children:
                db_children[n.parent_node_id] = []
            db_children[n.parent_node_id].append(n)
            
    paired_ids = set()
    visual_items = []
    
    for n in db_nodes:
        if n.id in paired_ids:
            continue
            
        if n.role == "user":
            children = db_children.get(n.id, [])
            assistant_child = None
            for child in children:
                if child.role == "assistant":
                    assistant_child = child
                    break
            
            if assistant_child:
                paired_ids.add(n.id)
                paired_ids.add(assistant_child.id)
                visual_items.append({
                    "id": assistant_child.id,  # Visual ID represents completed turn
                    "db_user_id": n.id,
                    "db_assistant_id": assistant_child.id,
                    "role": "interaction",
                    "user_content": n.content,
                    "user_model": n.model_used or "Unknown",
                    "user_timestamp": n.timestamp.isoformat(),
                    "assistant_content": assistant_child.content,
                    "assistant_model": assistant_child.model_used or "Unknown",
                    "assistant_timestamp": assistant_child.timestamp.isoformat(),
                    "parent_node_id": n.parent_node_id,
                    "timestamp": assistant_child.timestamp.isoformat(),
                    "is_condensed": assistant_child.is_condensed
                })
            else:
                # Unpaired user node (e.g. streaming or aborted)
                paired_ids.add(n.id)
                visual_items.append({
                    "id": n.id,
                    "db_user_id": n.id,
                    "db_assistant_id": None,
                    "role": "interaction",
                    "user_content": n.content,
                    "user_model": n.model_used or "Unknown",
                    "user_timestamp": n.timestamp.isoformat(),
                    "assistant_content": None,
                    "assistant_model": None,
                    "assistant_timestamp": None,
                    "parent_node_id": n.parent_node_id,
                    "timestamp": n.timestamp.isoformat(),
                    "is_condensed": n.is_condensed
                })
        elif n.role == "system_summary":
            paired_ids.add(n.id)
            visual_items.append({
                "id": n.id,
                "db_user_id": None,
                "db_assistant_id": None,
                "role": "system_summary",
                "content": n.content,
                "timestamp": n.timestamp.isoformat(),
                "parent_node_id": n.parent_node_id,
                "is_condensed": n.is_condensed
            })
        elif n.role == "assistant":
            # Orphaned assistant fallback
            paired_ids.add(n.id)
            visual_items.append({
                "id": n.id,
                "db_user_id": None,
                "db_assistant_id": n.id,
                "role": "interaction",
                "user_content": "[Orphaned Assistant Response]",
                "user_model": "System",
                "user_timestamp": n.timestamp.isoformat(),
                "assistant_content": n.content,
                "assistant_model": n.model_used or "Unknown",
                "assistant_timestamp": n.timestamp.isoformat(),
                "parent_node_id": n.parent_node_id,
                "timestamp": n.timestamp.isoformat(),
                "is_condensed": n.is_condensed
            })
            
    # 2. Map Database parent ID to Visual Parent Card ID
    db_to_visual_id = {}
    for item in visual_items:
        if item.get("db_user_id"):
            db_to_visual_id[item["db_user_id"]] = item["id"]
        if item.get("db_assistant_id"):
            db_to_visual_id[item["db_assistant_id"]] = item["id"]
        if item["role"] == "system_summary":
            db_to_visual_id[item["id"]] = item["id"]
            
    visual_parent_map = {}
    for item in visual_items:
        p_id = item.get("parent_node_id")
        if p_id and p_id in db_to_visual_id:
            visual_parent_map[item["id"]] = db_to_visual_id[p_id]
        else:
            visual_parent_map[item["id"]] = None
            
    # 3. Build adjacency lists and identify roots for paired items
    visual_adj = {}
    visual_roots = []
    visual_map = {item["id"]: item for item in visual_items}
    
    for item in visual_items:
        item_id = item["id"]
        p_id = visual_parent_map.get(item_id)
        if not p_id or p_id not in visual_map:
            visual_roots.append(item_id)
        else:
            if p_id not in visual_adj:
                visual_adj[p_id] = []
            visual_adj[p_id].append(item_id)
            
    # 4. Calculate depth (Y coordinate) for paired cards
    depth_map = {}
    def get_depth(item_id):
        if item_id in depth_map:
            return depth_map[item_id]
        p_id = visual_parent_map.get(item_id)
        if not p_id or p_id not in visual_map:
            depth_map[item_id] = 0
            return 0
        d = get_depth(p_id) + 1
        depth_map[item_id] = d
        return d
        
    for item in visual_items:
        get_depth(item["id"])
        
    # 5. Compute X coordinates post-order centering on visual items
    x_coords = {}
    leaf_counter = [0]
    
    def compute_x(item_id):
        children = visual_adj.get(item_id, [])
        if not children:
            x = leaf_counter[0] * 480
            leaf_counter[0] += 1
            x_coords[item_id] = x
            return x
            
        sum_x = 0
        for child_id in children:
            sum_x += compute_x(child_id)
            
        average_x = sum_x / len(children)
        x_coords[item_id] = average_x
        return average_x
        
    for r_id in visual_roots:
        compute_x(r_id)
        
    # 6. Format into React Flow nodes and edges
    react_nodes = []
    react_edges = []
    
    for item in visual_items:
        item_id = item["id"]
        d = depth_map.get(item_id, 0)
        x_pos = x_coords.get(item_id, 0)
        y_pos = d * 340  # Paired cards spaced vertically by 340px
        
        react_nodes.append({
            "id": item_id,
            "type": "customNode",
            "position": {"x": x_pos, "y": y_pos},
            "data": item
        })
        
        p_id = visual_parent_map.get(item_id)
        if p_id:
            react_edges.append({
                "id": f"edge-{p_id}-{item_id}",
                "source": p_id,
                "target": item_id,
                "animated": True,
                "style": {"stroke": "#a855f7" if item["role"] == "system_summary" else "#3b82f6", "strokeWidth": 2}
            })
            
    return {"nodes": react_nodes, "edges": react_edges}


@app.post("/api/sync/push")
def sync_push(req: SyncPushRequest, x_openrouter_key: Optional[str] = Header(None, alias="X-Openrouter-Key")):
    """
    Premium Cloud Sync Endpoint.
    Receives an array of client IndexedDB conversation nodes and bulk upserts them
    into Neon PostgreSQL and vectorizes them in Qdrant Cloud.
    """
    keys = {"openrouter": x_openrouter_key}
    from database import SessionLocal
    db = SessionLocal()
    try:
        synced_count = 0
        for node_data in req.nodes:
            node_id = node_data.get("id")
            if not node_id:
                continue
                
            # Check if node already exists to prevent duplication
            existing = db.query(Message).filter(Message.id == node_id).first()
            if not existing:
                msg = Message(
                    id=node_id,
                    session_id=req.session_id,
                    branch_id=node_data.get("branch_id", "main"),
                    parent_node_id=node_data.get("parent_node_id"),
                    role=node_data.get("role", "user"),
                    content=node_data.get("content", ""),
                    model_used=node_data.get("model_used"),
                    timestamp=datetime.fromisoformat(node_data.get("timestamp").replace("Z", "+00:00")) if node_data.get("timestamp") else datetime.utcnow(),
                    is_condensed=node_data.get("is_condensed", False)
                )
                db.add(msg)
                db.commit()
                
                # Index in Qdrant Vector Cloud in parallel
                try:
                    upsert_message_vector(session_id=req.session_id, message_id=msg.id, content=msg.content, keys=keys)
                except Exception as e:
                    print(f"WARNING [Sync]: Qdrant vector indexing failed for node '{msg.id}': {e}")
                    
                synced_count += 1
                
        return {"status": "success", "detail": f"Synced {synced_count} nodes to Cloud Database successfully."}
    finally:
        db.close()


@app.get("/api/sync/pull")
def sync_pull(session_id: str):
    """
    Premium Cloud Sync Pull.
    Fetches the entire cloud conversation tree to let the browser download and merge it offline.
    """
    db_nodes = get_all_session_nodes(session_id)
    serialized = []
    for n in db_nodes:
        serialized.append({
            "id": n.id,
            "session_id": n.session_id,
            "branch_id": n.branch_id,
            "parent_node_id": n.parent_node_id,
            "role": n.role,
            "content": n.content,
            "model_used": n.model_used,
            "timestamp": n.timestamp.isoformat(),
            "is_condensed": n.is_condensed
        })
    return {"nodes": serialized}


@app.post("/reset")
def reset(session_id: str):
    """
    Completely wipes a session's transactional data.
    Clears PostgreSQL rows and Qdrant Cloud vectors for the target session ID.
    """
    clear_session_history(session_id)
    delete_session_vectors(session_id)
    return {"status": "success", "detail": f"Session '{session_id}' database and vector records cleared."}


@app.get("/active-context")
def active_context(session_id: str, last_n: int = Query(4, ge=1)):
    """
    Diagnoses active session state for the Next.js Memory Timeline Explorer.
    """
    summaries, recent = get_active_context_messages(session_id, last_n=last_n)
    return {
        "summaries": [
            {"id": m.id, "content": m.content, "timestamp": m.timestamp.isoformat()}
            for m in summaries
        ],
        "recent_turns": [
            {"id": m.id, "role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat(), "is_condensed": m.is_condensed}
            for m in recent
        ]
    }


@app.get("/models")
async def get_models(
    x_openai_key: Optional[str] = Header(None, alias="X-OpenAI-Key"),
    x_gemini_key: Optional[str] = Header(None, alias="X-Gemini-Key"),
    x_groq_key: Optional[str] = Header(None, alias="X-Groq-Key"),
    x_openrouter_key: Optional[str] = Header(None, alias="X-Openrouter-Key")
):
    """
    Dynamic discovery gateway for dynamic keys.
    Collects applicable models based on the keys supplied by the user.
    """
    available_models = []
    
    if x_gemini_key:
        available_models.extend([
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-1.5-pro",
            "gemini-1.5-flash"
        ])
        
    if x_openai_key:
        available_models.extend([
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4"
        ])
        
    if x_groq_key:
        available_models.extend([
            "llama-3.1-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it"
        ])
        
    if x_openrouter_key:
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {x_openrouter_key}"}
                resp = await client.get("https://openrouter.ai/api/v1/models", headers=headers, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    model_list = [m.get("id") for m in data.get("data", []) if m.get("id")]
                    model_list.sort()
                    available_models.extend(model_list[:30])
        except Exception as e:
            print(f"WARNING: OpenRouter model query failed: {e}")
            available_models.extend([
                "google/gemini-2.5-flash",
                "meta-llama/llama-3.1-70b-instruct",
                "anthropic/claude-3.5-sonnet",
                "deepseek/deepseek-chat"
            ])
            
    if not available_models:
        available_models.extend([
            "gemini-2.5-flash",
            "gpt-4o-mini",
            "llama-3.1-8b-instant"
        ])
        
    unique_models = []
    for m in available_models:
        if m not in unique_models:
            unique_models.append(m)
            
    return {"models": unique_models}
