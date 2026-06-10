# nextgen-core/backend/memory.py
import os
from typing import List
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue, MatchAny
import uuid

load_dotenv()

# --- Configurations ---
QDRANT_HOST = os.getenv("QDRANT_HOST")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
COLLECTION_NAME = "nextgen_memory"

# Initialize Qdrant Client (Cloud or local fallback)
if QDRANT_HOST and QDRANT_API_KEY:
    qdrant_client = QdrantClient(url=QDRANT_HOST, api_key=QDRANT_API_KEY)
    print("DEBUG: Initialized Qdrant Cloud Client.")
else:
    # Safe local-file fallback for developers who haven't populated keys yet
    qdrant_client = QdrantClient(path="./data/qdrant_db")
    print("DEBUG: Qdrant keys missing. Initialized local-file Qdrant database fallback.")


def get_embedding(text: str, api_key: str = None, keys: dict = None) -> List[float]:
    """
    Generates high-quality 768-dimensional embeddings exclusively through OpenRouter
    using the 'openai/text-embedding-3-small' model (truncated to 768 dimensions).
    All other embedding models and fallback layers have been completely removed.
    """
    import os
    from openai import OpenAI

    # Ensure keys is a dictionary
    if keys is None:
        keys = {}

    # Merge/Auto-detect single api_key parameter if provided (assuming it represents OpenRouter key)
    openrouter_key = keys.get("openrouter") or api_key or os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        raise ValueError("OpenRouter API Key is missing from headers/env. Cloud embeddings unavailable.")

    try:
        print("DEBUG [Embeddings]: Generating embedding exclusively via OpenRouter API...")
        client = OpenAI(api_key=openrouter_key, base_url="https://openrouter.ai/api/v1")
        response = client.embeddings.create(
            input=text,
            model="openai/text-embedding-3-small"
        )
        vector = response.data[0].embedding
        print("DEBUG [Embeddings]: OpenRouter embedding generated successfully.")
        return vector[:768]
    except Exception as e:
        print(f"ERROR [Embeddings]: OpenRouter embedding generation failed: {e}")
        raise RuntimeError(f"OpenRouter embedding failed: {str(e)}")


def ensure_collection():
    """Dynamically creates the Qdrant collection and indexes fields for high-speed cloud queries."""
    from qdrant_client.models import PayloadSchemaType
    try:
        # Check if collection exists
        if not qdrant_client.collection_exists(collection_name=COLLECTION_NAME):
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=768, distance=Distance.COSINE),
            )
            print(f"DEBUG: Created collection '{COLLECTION_NAME}' successfully.")
            
        # Dynamically create index for session_id to resolve Qdrant Cloud mandatory index filtering
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="session_id",
            field_schema=PayloadSchemaType.KEYWORD
        )
        
        # Dynamically create index for user_id to allow high-speed filtering
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="user_id",
            field_schema=PayloadSchemaType.KEYWORD
        )
        
        # Dynamically create index for message_id to allow deletes
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="message_id",
            field_schema=PayloadSchemaType.KEYWORD
        )
    except Exception as e:
        print(f"WARNING: Qdrant check/creation or index creation failed: {e}")


def upsert_message_vector(session_id: str, message_id: str, content: str, user_id: str = None, api_key: str = None, keys: dict = None):
    """
    Computes text embedding and registers a new vector in Qdrant Cloud
    associated with the relational message ID and owner user ID.
    """
    ensure_collection()
    
    vector = get_embedding(content, api_key=api_key, keys=keys)
    point_id = str(uuid.uuid4())
    
    qdrant_client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "session_id": session_id,
                    "message_id": message_id,
                    "content": content,
                    "user_id": user_id
                }
            )
        ]
    )


def search_similar_message_ids(session_id: str, query: str, user_id: str = None, top_k: int = 4, api_key: str = None, keys: dict = None) -> List[str]:
    """
    Vectorizes the query and retrieves matched historical message UUIDs
    scoped strictly to the user's session and tenant isolation.
    """
    if not query.strip():
        return []
        
    ensure_collection()
    
    query_vector = get_embedding(query, api_key=api_key, keys=keys)
    
    must_conditions = [
        FieldCondition(
            key="session_id",
            match=MatchValue(value=session_id)
        )
    ]
    if user_id:
        must_conditions.append(
            FieldCondition(
                key="user_id",
                match=MatchValue(value=user_id)
            )
        )
        
    query_filter = Filter(must=must_conditions)
    
    results = []
    try:
        if hasattr(qdrant_client, "query_points"):
            results_obj = qdrant_client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=query_filter,
                limit=top_k
            )
            # Scored points reside inside the .points attribute of QueryResponse
            results = results_obj.points if hasattr(results_obj, "points") else []
            
        elif hasattr(qdrant_client, "search"):
            results = qdrant_client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=top_k
            )
        elif hasattr(qdrant_client, "search_points"):
            results = qdrant_client.search_points(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=top_k
            )
        else:
            print(f"WARNING: Qdrant client has neither 'query_points', 'search', nor 'search_points'. Methods: {dir(qdrant_client)}")
    except Exception as e:
        print(f"WARNING: Qdrant search execution failed: {e}")
        
    # Extract PostgreSQL message UUIDs, applying a strict 0.82 similarity threshold
    # to prevent irrelevant or stale history turns from bloating the active prompt context.
    return [
        hit.payload.get("message_id") 
        for hit in results 
        if hit.payload and getattr(hit, "score", 0.0) >= 0.82
    ]


def delete_message_vectors(message_ids: List[str]):
    """Purges list of indexed message vectors in Qdrant Cloud (used during context condensation)."""
    if not message_ids:
        return
        
    ensure_collection()
    
    qdrant_client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="message_id",
                    match=MatchAny(any=message_ids)
                )
            ]
        )
    )


def delete_session_vectors(session_id: str):
    """Purges all message vectors for a given session ID in Qdrant Cloud."""
    ensure_collection()
    
    try:
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="session_id",
                        match=MatchValue(value=session_id)
                    )
                ]
            )
        )
    except Exception as e:
        print(f"WARNING: Qdrant session vector deletion failed: {e}")

