# nextgen-core/backend/main.py
import os
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, Query, Depends, status, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
from datetime import datetime

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import sentry_sdk

sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )
    print("INFO: Sentry SDK initialized for error and performance tracking.")


from database import (
    init_db,
    save_message,
    get_active_context_messages,
    clear_session_history,
    get_all_session_nodes,
    get_path_to_node,
    get_user_by_email,
    create_user,
    Message
)
from memory import (
    upsert_message_vector,
    search_similar_message_ids,
    delete_session_vectors,
    qdrant_client,
    COLLECTION_NAME
)
from condenser import condense_session_if_needed, update_user_profile_if_needed
from providers import call_model_stream
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_id
)
from google_oauth import exchange_google_code

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="NeuraStitch AI (NextGen Core)")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Enable CORS for the Next.js React frontend
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_str == "*":
    allowed_origins = ["*"]
    allow_credentials = False
else:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
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


class UserRegisterRequest(BaseModel):
    email: str
    password: str


class UserLoginRequest(BaseModel):
    email: str
    password: str


class GoogleCallbackRequest(BaseModel):
    code: str


@app.post("/api/auth/register")
def register(req: UserRegisterRequest):
    """Manual email/password registration endpoint (disabled in Beta)."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manual email/password registration is disabled for the Beta testing phase. Please sign in with Google OAuth."
    )


@app.post("/api/auth/login")
def login(req: UserLoginRequest):
    """Manual email/password credentials validation endpoint (disabled in Beta)."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manual email/password login is disabled for the Beta testing phase. Please sign in with Google OAuth."
    )


@app.post("/api/auth/google/callback")
async def google_callback(req: GoogleCallbackRequest):
    """Google OAuth 2.0 authorization code exchange and user verification gateway."""
    google_user = await exchange_google_code(req.code)
    if not google_user or not google_user.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to authenticate with Google."
        )
        
    email = google_user["email"]
    
    # Check if user exists, otherwise auto-create
    user = get_user_by_email(email)
    if not user:
        user = create_user(email=email)
        print(f"INFO: Auto-created new user via Google OAuth: {email} (ID: {user.id})")
        
    token = create_access_token(data={"user_id": user.id, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "is_premium": user.is_premium}
    }


class UserSettingsUpdateRequest(BaseModel):
    share_profile_memory: Optional[bool] = None
    about_user: Optional[str] = None
    response_style: Optional[str] = None


@app.get("/api/user/settings")
def get_user_settings(current_user_id: str = Depends(get_current_user_id)):
    """Fetches user personalization settings and toggles."""
    from database import SessionLocal, User
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return {
            "email": user.email,
            "share_profile_memory": user.share_profile_memory,
            "about_user": user.about_user or "",
            "response_style": user.response_style or "",
            "is_premium": user.is_premium
        }
    finally:
        db.close()


@app.post("/api/user/settings")
def update_user_settings(req: UserSettingsUpdateRequest, current_user_id: str = Depends(get_current_user_id)):
    """Updates user personalization settings and toggles."""
    from database import SessionLocal, User
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
            
        if req.share_profile_memory is not None:
            user.share_profile_memory = req.share_profile_memory
        if req.about_user is not None:
            user.about_user = req.about_user
        if req.response_style is not None:
            user.response_style = req.response_style
            
        db.commit()
        return {
            "status": "success",
            "settings": {
                "share_profile_memory": user.share_profile_memory,
                "about_user": user.about_user or "",
                "response_style": user.response_style or ""
            }
        }
    finally:
        db.close()


@app.get("/api/user/facts")
def get_user_facts(current_user_id: str = Depends(get_current_user_id)):
    """Fetches the structured personalization profile for the current user."""
    from database import SessionLocal, User
    import json
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        try:
            profile = json.loads(user.personal_profile or "{}")
        except Exception:
            profile = {}
            
        # Ensure schema structure defaults
        schema_keys = ["biographical", "professional", "interests", "other_notes"]
        for sk in schema_keys:
            if sk not in profile:
                profile[sk] = {} if sk != "other_notes" else []
                
        if not isinstance(profile["biographical"], dict):
            profile["biographical"] = {}
        if not isinstance(profile["professional"], dict):
            profile["professional"] = {}
        if not isinstance(profile["interests"], dict):
            profile["interests"] = {}
        if not isinstance(profile["other_notes"], list):
            profile["other_notes"] = []
            
        if "likes" not in profile["interests"]:
            profile["interests"]["likes"] = []
        if "dislikes" not in profile["interests"]:
            profile["interests"]["dislikes"] = []
        if "topics" not in profile["interests"]:
            profile["interests"]["topics"] = []
        if "skills" not in profile["professional"]:
            profile["professional"]["skills"] = []
            
        return profile
    finally:
        db.close()


@app.delete("/api/user/facts/item")
def delete_profile_item(
    category: str,
    value: str,
    current_user_id: str = Depends(get_current_user_id)
):
    """Deletes a specific value from the user's structured JSON profile."""
    from database import SessionLocal, User
    import json
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
            
        try:
            profile = json.loads(user.personal_profile or "{}")
        except Exception:
            profile = {}
            
        parts = category.split(".")
        if len(parts) == 1:
            key = parts[0]
            if key in profile and isinstance(profile[key], list):
                if value in profile[key]:
                    profile[key].remove(value)
        elif len(parts) == 2:
            parent, child = parts[0], parts[1]
            if parent in profile and isinstance(profile[parent], dict):
                if child in profile[parent]:
                    if isinstance(profile[parent][child], list):
                        if value in profile[parent][child]:
                            profile[parent][child].remove(value)
                    else:
                        profile[parent][child] = ""
                        
        user.personal_profile = json.dumps(profile)
        db.commit()
        return {"status": "success", "profile": profile}
    finally:
        db.close()


@app.post("/api/message/{message_id}/pin")
def pin_message(message_id: str, current_user_id: str = Depends(get_current_user_id)):
    """Pins a message node to the active context lineage. Enforces max 3 pins limit."""
    from database import SessionLocal, Message, get_path_to_node
    db = SessionLocal()
    try:
        msg = db.query(Message).filter(Message.id == message_id, Message.user_id == current_user_id).first()
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found.")
            
        if msg.is_pinned:
            return {"status": "success", "detail": "Message is already pinned.", "message_id": message_id}
            
        # Get path to root
        path = get_path_to_node(message_id)
        # Count currently pinned messages in the path
        pinned_on_path = db.query(Message).filter(
            Message.id.in_([n.id for n in path]),
            Message.is_pinned == True
        ).count()
        
        if pinned_on_path >= 3:
            raise HTTPException(
                status_code=400,
                detail="Lineage limit reached: You can pin a maximum of 3 messages along any single branch path. Please unpin another message first."
            )
            
        msg.is_pinned = True
        db.commit()
        return {"status": "success", "detail": "Message pinned successfully.", "message_id": message_id}
    finally:
        db.close()


@app.post("/api/message/{message_id}/unpin")
def unpin_message(message_id: str, current_user_id: str = Depends(get_current_user_id)):
    """Unpins a message node."""
    from database import SessionLocal, Message
    db = SessionLocal()
    try:
        msg = db.query(Message).filter(Message.id == message_id, Message.user_id == current_user_id).first()
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found.")
            
        msg.is_pinned = False
        db.commit()
        return {"status": "success", "detail": "Message unpinned successfully.", "message_id": message_id}
    finally:
        db.close()


@app.get("/api/message/{message_id}/export-json")
def export_branch_json(message_id: str, current_user_id: str = Depends(get_current_user_id)):
    """
    Traverses the branch path upstream and returns a clean, standard
    Chat Completion JSON array of past turns, suitable for copying/pasting.
    """
    from database import SessionLocal, Message, get_path_to_node
    db = SessionLocal()
    try:
        # Check if target message exists and belongs to this user
        msg = db.query(Message).filter(Message.id == message_id, Message.user_id == current_user_id).first()
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found.")
            
        path = get_path_to_node(message_id)
        
        chat_completion_payload = []
        for node in path:
            if node.role in ("user", "assistant"):
                chat_completion_payload.append({
                    "role": node.role,
                    "content": node.content
                })
        return chat_completion_payload
    finally:
        db.close()


@app.post("/chat")
@limiter.limit("15/minute")
async def chat(
    request: Request,
    req: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
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
        "openai": x_openai_key or os.getenv("OPENAI_API_KEY"),
        "gemini": x_gemini_key or os.getenv("GEMINI_API_KEY"),
        "groq": x_groq_key or os.getenv("GROQ_API_KEY"),
        "openrouter": x_openrouter_key or os.getenv("OPENROUTER_API_KEY")
    }
    
    # 1. Relational Save: Save user query with parent links
    user_msg_db = save_message(
        session_id=req.session_id,
        role="user",
        content=req.user_message,
        parent_node_id=req.parent_node_id,
        branch_id=req.branch_id or "main",
        model_used=req.active_model,
        user_id=current_user_id
    )
    
    # 2. Vector Index: Embed and save vector to Qdrant Cloud
    try:
        upsert_message_vector(session_id=req.session_id, message_id=user_msg_db.id, content=req.user_message, user_id=current_user_id, keys=keys)
    except Exception as e:
        print(f"WARNING: Qdrant vector indexing failed: {e}")
        
    # 3. RAG: Similarity search in Qdrant Cloud
    semantic_msg_ids = []
    try:
        semantic_msg_ids = search_similar_message_ids(session_id=req.session_id, query=req.user_message, user_id=current_user_id, top_k=req.k, keys=keys)
    except Exception as e:
        print(f"WARNING: Semantic retrieval query failed: {e}")
        
    # 4. DB Retrieval: Fetch active path context (summaries and recent turns)
    # If parent_node_id is provided, get context messages on that specific active path!
    summaries, recent_turns = get_active_context_messages(
        session_id=req.session_id,
        active_node_id=req.parent_node_id,
        last_n=req.last_n
    )
    
    # Fetch pinned messages along the branch path
    pinned_messages = []
    if req.parent_node_id:
        path = get_path_to_node(req.parent_node_id)
        pinned_messages = [msg for msg in path if getattr(msg, "is_pinned", False)]
        
    recent_ids = {msg.id for msg in recent_turns}
    pinned_ids = {msg.id for msg in pinned_messages}
    
    # Filter pinned messages out of recent_turns to prevent duplication
    recent_turns = [msg for msg in recent_turns if msg.id not in pinned_ids]
    
    # Load semantic matching turns from PostgreSQL, filtering out duplicates in active window or pinned turns
    semantic_turns = []
    if semantic_msg_ids:
        from database import SessionLocal
        db = SessionLocal()
        try:
            db_turns = db.query(Message).filter(Message.id.in_(semantic_msg_ids)).all()
            for turn in db_turns:
                if turn.id not in recent_ids and turn.id not in pinned_ids and turn.role != "system_summary":
                    semantic_turns.append(turn)
        finally:
            db.close()
            
    # 5. Retrieve custom user instructions and memory vault facts from database
    from database import SessionLocal, User
    db = SessionLocal()
    about_user = ""
    response_style = ""
    share_profile_memory = True
    user_facts = ""
    try:
        user = db.query(User).filter(User.id == current_user_id).first()
        if user:
            about_user = user.about_user or ""
            response_style = user.response_style or ""
            share_profile_memory = user.share_profile_memory
            
            if share_profile_memory and user.personal_profile:
                try:
                    profile_data = json.loads(user.personal_profile)
                    if isinstance(profile_data, dict):
                        lines = []
                        # Biographical
                        bio = profile_data.get("biographical", {})
                        if bio:
                            lines.append("Biographical:")
                            for k, v in bio.items():
                                if v: lines.append(f"  - {k.capitalize()}: {v}")
                        # Professional
                        prof = profile_data.get("professional", {})
                        if prof:
                            lines.append("Professional:")
                            for k, v in prof.items():
                                if isinstance(v, list) and v:
                                    lines.append(f"  - {k.replace('_', ' ').capitalize()}: {', '.join(v)}")
                                elif v:
                                    lines.append(f"  - {k.replace('_', ' ').capitalize()}: {v}")
                        # Interests
                        interests = profile_data.get("interests", {})
                        if interests:
                            lines.append("Interests:")
                            for k, v in interests.items():
                                if isinstance(v, list) and v:
                                    lines.append(f"  - {k.capitalize()}: {', '.join(v)}")
                        # Other notes
                        other = profile_data.get("other_notes", [])
                        if other:
                            lines.append("Other Notes:")
                            for n in other:
                                lines.append(f"  - {n}")
                        if lines:
                            user_facts = "\n".join(lines)
                except Exception as err:
                    print(f"WARNING: Failed to parse user profile: {err}")
    finally:
        db.close()

    system_content = (
        "You are an enterprise-grade AI Assistant operating with long-term context memory.\n"
        "Review the long-term context cards and recent conversation history carefully. "
        "Synthesize your response using these memories whenever relevant. Stay factual, clear, and concise."
    )
    if about_user:
        system_content += f"\n\n[USER PROFILE INFORMATION]:\n{about_user}"
    if response_style:
        system_content += f"\n\n[RESPONSE STYLE GUIDELINES]:\n{response_style}"
    if user_facts:
        system_content += f"\n\n[MEMORIES OF USER (PERSONALIZATION FACTS)]:\n{user_facts}"

    compiled_messages = [
        {
            "role": "system",
            "content": system_content
        }
    ]
    
    # Prepend Pinned summaries
    for summary in summaries:
        compiled_messages.append({"role": "system", "content": f"[Topic Card Summary]: {summary.content}"})
        
    # Inject Pinned Context Anchors
    for msg in pinned_messages:
        compiled_messages.append({
            "role": "system",
            "content": f"[Pinned Context Anchor ({msg.role})]: {msg.content}"
        })
        
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
                model_used=req.active_model,
                user_id=current_user_id
            )
            
            # Embed and index vector to Qdrant Cloud
            try:
                upsert_message_vector(session_id=req.session_id, message_id=assist_msg_db.id, content=assistant_content, user_id=current_user_id, keys=keys)
            except Exception as e:
                print(f"WARNING: Qdrant assistant indexing failed: {e}")
                
            # Queue context condensation task in the background
            background_tasks.add_task(
                condense_session_if_needed,
                session_id=req.session_id,
                active_model=req.active_model,
                keys=keys,
                active_node_id=user_msg_db.id,
                user_id=current_user_id
            )
            
            # Queue fact extraction in the background
            background_tasks.add_task(
                update_user_profile_if_needed,
                user_id=current_user_id,
                user_message=req.user_message,
                assistant_message=assistant_content,
                active_model=req.active_model,
                keys=keys
            )
            
    return StreamingResponse(streaming_generator(), media_type="text/event-stream")


@app.post("/chat/stateless")
@limiter.limit("15/minute")
async def chat_stateless(
    request: Request,
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
        "openai": x_openai_key or os.getenv("OPENAI_API_KEY"),
        "gemini": x_gemini_key or os.getenv("GEMINI_API_KEY"),
        "groq": x_groq_key or os.getenv("GROQ_API_KEY"),
        "openrouter": x_openrouter_key or os.getenv("OPENROUTER_API_KEY")
    }
    
    def streaming_generator():
        try:
            stream_source = call_model_stream(active_model, messages, keys)
            for chunk in stream_source:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(streaming_generator(), media_type="text/event-stream")
@app.get("/api/session/list")
def get_user_sessions(current_user_id: str = Depends(get_current_user_id)):
    """Fetches all unique session IDs and their last active timestamps for the current user."""
    from database import SessionLocal, Message
    from sqlalchemy import func
    db = SessionLocal()
    try:
        # Query unique session IDs with their latest message timestamp
        results = (
            db.query(
                Message.session_id,
                func.max(Message.timestamp).label("last_active")
            )
            .filter(Message.user_id == current_user_id)
            .group_by(Message.session_id)
            .order_by(func.max(Message.timestamp).desc())
            .all()
        )
        return [
            {
                "id": r[0],
                "title": f"Session {r[0][:8]}" if len(r[0]) > 8 else f"Session {r[0]}",
                "last_active": (r[1].isoformat() + "Z") if r[1] else None
            }
            for r in results
        ]
    finally:
        db.close()


@app.get("/api/session/tree")
def get_session_tree(session_id: str, current_user_id: str = Depends(get_current_user_id)):
    """
    Constructs and returns visual nodes and edges formatted perfectly for React Flow.
    Pairs user queries and assistant responses into single, unified Interaction Nodes.
    Applies a post-order tree layout algorithm to center parents exactly above
    their child branches, preventing any overlapping nodes.
    """
    from database import SessionLocal
    db = SessionLocal()
    try:
        db_nodes = (
            db.query(Message)
            .filter(Message.session_id == session_id, Message.user_id == current_user_id)
            .order_by(Message.timestamp.asc())
            .all()
        )
        for n in db_nodes:
            db.expunge(n)
    finally:
        db.close()

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
                    "user_timestamp": n.timestamp.isoformat() + "Z",
                    "assistant_content": assistant_child.content,
                    "assistant_model": assistant_child.model_used or "Unknown",
                    "assistant_timestamp": assistant_child.timestamp.isoformat() + "Z",
                    "parent_node_id": n.parent_node_id,
                    "timestamp": assistant_child.timestamp.isoformat() + "Z",
                    "is_condensed": assistant_child.is_condensed,
                    "is_pinned": n.is_pinned or assistant_child.is_pinned,
                    "user_is_pinned": n.is_pinned,
                    "assistant_is_pinned": assistant_child.is_pinned,
                    "branch_id": assistant_child.branch_id
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
                    "user_timestamp": n.timestamp.isoformat() + "Z",
                    "assistant_content": None,
                    "assistant_model": None,
                    "assistant_timestamp": None,
                    "parent_node_id": n.parent_node_id,
                    "timestamp": n.timestamp.isoformat() + "Z",
                    "is_condensed": n.is_condensed,
                    "is_pinned": n.is_pinned,
                    "user_is_pinned": n.is_pinned,
                    "assistant_is_pinned": False,
                    "branch_id": n.branch_id
                })
        elif n.role == "system_summary":
            paired_ids.add(n.id)
            # Skip appending to visual_items to keep everything in a single contiguous tree
            continue
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
                "user_timestamp": n.timestamp.isoformat() + "Z",
                "assistant_content": n.content,
                "assistant_model": n.model_used or "Unknown",
                "assistant_timestamp": n.timestamp.isoformat() + "Z",
                "parent_node_id": n.parent_node_id,
                "timestamp": n.timestamp.isoformat() + "Z",
                "is_condensed": n.is_condensed,
                "is_pinned": n.is_pinned,
                "user_is_pinned": False,
                "assistant_is_pinned": n.is_pinned,
                "branch_id": n.branch_id
            })
            
    # Pre-calculate mapping from system_summary ID to the leaf of its condensed chain
    summary_to_leaf = {}
    system_summaries = [n for n in db_nodes if n.role == "system_summary"]
    condensed_nodes = [n for n in db_nodes if n.is_condensed and n.role != "system_summary"]
    condensed_parents = {n.parent_node_id for n in condensed_nodes}
    condensed_leaves = [n for n in condensed_nodes if n.id not in condensed_parents]

    for S in system_summaries:
        anchor = S.parent_node_id
        leaf_id = None
        # Walk upstream from each condensed leaf to see if it hooks to S's parent anchor
        for leaf in condensed_leaves:
            curr = leaf
            visited = set()
            while curr and curr.id not in visited:
                visited.add(curr.id)
                if curr.parent_node_id == anchor:
                    leaf_id = leaf.id
                    break
                parent_node = next((x for x in db_nodes if x.id == curr.parent_node_id), None)
                if parent_node and parent_node.is_condensed and parent_node.role != "system_summary":
                    curr = parent_node
                else:
                    break
            if leaf_id:
                break
        
        if not leaf_id:
            # Fallback to latest condensed node before S
            before_s = [n for n in condensed_nodes if n.timestamp < S.timestamp]
            if before_s:
                leaf_id = max(before_s, key=lambda x: x.timestamp).id
            else:
                leaf_id = anchor
                
        summary_to_leaf[S.id] = leaf_id

    # 2. Map Database parent ID to Visual Parent Card ID
    db_to_visual_id = {}
    for item in visual_items:
        if item.get("db_user_id"):
            db_to_visual_id[item["db_user_id"]] = item["id"]
        if item.get("db_assistant_id"):
            db_to_visual_id[item["db_assistant_id"]] = item["id"]
            
    visual_parent_map = {}
    for item in visual_items:
        p_id = item.get("parent_node_id")
        # If the parent is a system_summary node, resolve it to the leaf of the condensed chain
        if p_id in summary_to_leaf:
            p_id = summary_to_leaf[p_id]
            
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
@limiter.limit("10/minute")
def sync_push(
    request: Request,
    req: SyncPushRequest,
    current_user_id: str = Depends(get_current_user_id),
    x_openrouter_key: Optional[str] = Header(None, alias="X-Openrouter-Key")
):
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
                    is_condensed=node_data.get("is_condensed", False),
                    user_id=current_user_id
                )
                db.add(msg)
                db.commit()
                
                # Index in Qdrant Vector Cloud in parallel
                try:
                    upsert_message_vector(session_id=req.session_id, message_id=msg.id, content=msg.content, user_id=current_user_id, keys=keys)
                except Exception as e:
                    print(f"WARNING [Sync]: Qdrant vector indexing failed for node '{msg.id}': {e}")
                    
                synced_count += 1
                
        return {"status": "success", "detail": f"Synced {synced_count} nodes to Cloud Database successfully."}
    finally:
        db.close()


@app.get("/api/sync/pull")
def sync_pull(session_id: str, current_user_id: str = Depends(get_current_user_id)):
    """
    Premium Cloud Sync Pull.
    Fetches the entire cloud conversation tree to let the browser download and merge it offline.
    """
    from database import SessionLocal
    db = SessionLocal()
    try:
        db_nodes = (
            db.query(Message)
            .filter(Message.session_id == session_id, Message.user_id == current_user_id)
            .order_by(Message.timestamp.asc())
            .all()
        )
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
                "timestamp": n.timestamp.isoformat() + "Z",
                "is_condensed": n.is_condensed
            })
        return {"nodes": serialized}
    finally:
        db.close()


@app.post("/reset")
def reset(session_id: str, current_user_id: str = Depends(get_current_user_id)):
    """
    Completely wipes a session's transactional data.
    Clears PostgreSQL rows and Qdrant Cloud vectors for the target session ID.
    """
    from database import SessionLocal
    db = SessionLocal()
    try:
        # Verify ownership: check if this user has any messages in the target session
        has_messages = db.query(Message).filter(
            Message.session_id == session_id,
            Message.user_id == current_user_id
        ).first()
        if not has_messages:
            return {"status": "success", "detail": f"Session '{session_id}' database and vector records cleared."}
    finally:
        db.close()

    clear_session_history(session_id)
    delete_session_vectors(session_id)
    return {"status": "success", "detail": f"Session '{session_id}' database and vector records cleared."}


@app.get("/active-context")
def active_context(session_id: str, last_n: int = Query(4, ge=1), current_user_id: str = Depends(get_current_user_id)):
    """
    Diagnoses active session state for the Next.js Memory Timeline Explorer.
    """
    from database import SessionLocal
    db = SessionLocal()
    try:
        # Verify ownership before diagnosing context
        has_messages = db.query(Message).filter(
            Message.session_id == session_id,
            Message.user_id == current_user_id
        ).first()
        if not has_messages:
            return {"summaries": [], "recent_turns": []}
    finally:
        db.close()

    summaries, recent = get_active_context_messages(session_id, last_n=last_n)
    return {
        "summaries": [
            {"id": m.id, "content": m.content, "timestamp": m.timestamp.isoformat() + "Z"}
            for m in summaries
        ],
        "recent_turns": [
            {"id": m.id, "role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat() + "Z", "is_condensed": m.is_condensed}
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
