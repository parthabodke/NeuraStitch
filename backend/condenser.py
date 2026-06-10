# nextgen-core/backend/condenser.py
from typing import Dict
from database import (
    get_uncondensed_count,
    get_oldest_uncondensed,
    save_message,
    mark_messages_condensed,
    SessionLocal,
    Message
)
from memory import delete_message_vectors
from providers import call_model_sync


def condense_session_if_needed(
    session_id: str,
    active_model: str,
    keys: Dict[str, str],
    active_node_id: str = None,
    max_raw_turns: int = 8,
    condense_size: int = 4,
    user_id: str = None
) -> bool:
    """
    Automated Branch-Aware Context Condensation.
    Analyzes active turns along the active branch path. If they exceed max_raw_turns,
    compiles the oldest N turns, requests a high-density summary card from the LLM,
    creates a system_summary node inserted logically in the tree hierarchy,
    and purges vectors to clean up RAG retrieval space.
    """
    # 1. Check raw active turn counts along path
    uncondensed_count = get_uncondensed_count(session_id, active_node_id)
    if uncondensed_count < max_raw_turns:
        return False
        
    print(f"DEBUG [Condenser]: Session '{session_id}' has {uncondensed_count} uncondensed turns on path. Exceeds limit {max_raw_turns}. Condensing oldest {condense_size} turns...")
    
    # 2. Retrieve oldest N raw turns along active path
    oldest_turns = get_oldest_uncondensed(session_id, active_node_id, count=condense_size)
    if len(oldest_turns) < 2:
        return False
        
    # 3. Format into a clean transcript block
    transcript_lines = []
    message_ids = []
    for msg in oldest_turns:
        transcript_lines.append(f"{msg.role}: {msg.content}")
        message_ids.append(msg.id)
        
    transcript = "\n".join(transcript_lines)
    
    # 4. Prompt construction for the compression agent
    compress_messages = [
        {
            "role": "system",
            "content": (
                "You are an expert Context Compression Engine. Your task is to analyze the "
                "following historical chat segment and extract all critical facts, preferences, "
                "decisions, and timeline metrics.\n"
                "Output ONLY a clean, high-density list of bulleted facts.\n"
                "Do NOT include pleasantries, conversational filler, or introductions. Keep it compact."
            )
        },
        {
            "role": "user",
            "content": f"CHAT HISTORY TO CONSOLIDATE:\n{transcript}"
        }
    ]
    
    try:
        # 5. Generate high-density summary card using active credentials
        summary_card = call_model_sync(active_model, compress_messages, keys)
        
        # 6. Retrieve hierarchical tree anchor links
        db = SessionLocal()
        first_node = db.query(Message).filter(Message.id == message_ids[0]).first()
        parent_anchor_id = first_node.parent_node_id if first_node else None
        branch_id = first_node.branch_id if first_node else "main"
        
        # 7. Save the system_summary node inserted at the parent_anchor position
        summary_msg_db = save_message(
            session_id=session_id,
            role="system_summary",
            content=f"Summary of archived chat turns:\n{summary_card}",
            parent_node_id=parent_anchor_id,
            branch_id=branch_id,
            model_used=active_model,
            user_id=user_id
        )
        
        # 8. Re-wire the first uncondensed node AFTER the condensed block to point to the summary card
        # This keeps the tree hierarchy contiguous: Parent -> Summary -> Next Active Node
        if active_node_id:
            # Re-traverse and find the first active node that succeeds our condensed block
            from database import get_path_to_node
            full_path = get_path_to_node(active_node_id)
            next_active_node = None
            for node in full_path:
                if node.id not in message_ids and node.role != "system_summary":
                    next_active_node = node
                    break
                    
            if next_active_node:
                db_node = db.query(Message).filter(Message.id == next_active_node.id).first()
                if db_node:
                    db_node.parent_node_id = summary_msg_db.id
                    db.commit()
                    print(f"DEBUG [Condenser]: Re-wired child node '{db_node.id}' to point to summary card '{summary_msg_db.id}'.")
        
        db.close()
        
        # 9. Flag raw turns as condensed (hiding them from active prompts)
        mark_messages_condensed(message_ids)
        
        # 10. Keep raw vectors in Qdrant Cloud to allow high-threshold semantic recall
        # delete_message_vectors(message_ids)
        
        print(f"DEBUG [Condenser]: Condensation completed successfully. Archived {condense_size} turns into Summary node '{summary_msg_db.id}'.")
        return True
    except Exception as e:
        print(f"ERROR [Condenser]: Condensation process failed. Error: {e}")
        return False


def update_user_profile_if_needed(
    user_id: str,
    user_message: str,
    assistant_message: str,
    active_model: str,
    keys: dict
):
    """
    Background worker that analyzes the latest chat turn to incrementally update
    a structured JSON profile of personalization facts for the user.
    """
    if not user_id:
        return
        
    import json
    import re
    from database import SessionLocal, User
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.share_profile_memory:
            return  # User disabled long-term memory sharing or not found
            
        current_profile_str = user.personal_profile or "{}"
        
        # Parse or default
        try:
            current_profile = json.loads(current_profile_str)
            if not isinstance(current_profile, dict):
                current_profile = {}
        except Exception:
            current_profile = {}
            
        # Ensure schema categories exist
        schema_keys = ["biographical", "professional", "interests", "other_notes"]
        for sk in schema_keys:
            if sk not in current_profile:
                current_profile[sk] = {} if sk != "other_notes" else []
        
        if not isinstance(current_profile["biographical"], dict):
            current_profile["biographical"] = {}
        if not isinstance(current_profile["professional"], dict):
            current_profile["professional"] = {}
        if not isinstance(current_profile["interests"], dict):
            current_profile["interests"] = {}
        if not isinstance(current_profile["other_notes"], list):
            current_profile["other_notes"] = []
            
        if "likes" not in current_profile["interests"]:
            current_profile["interests"]["likes"] = []
        if "dislikes" not in current_profile["interests"]:
            current_profile["interests"]["dislikes"] = []
        if "topics" not in current_profile["interests"]:
            current_profile["interests"]["topics"] = []
        if "skills" not in current_profile["professional"]:
            current_profile["professional"]["skills"] = []

        latest_turn_text = f"User: {user_message}\nAssistant: {assistant_message}"
        
        prompt_messages = [
            {
                "role": "system",
                "content": (
                    "You are a long-term Personal Profile Consolidation Agent.\n"
                    "Your task is to incrementally update the user's structured JSON profile based on the latest chat exchange.\n\n"
                    "You are given:\n"
                    "1. The CURRENT user profile JSON.\n"
                    "2. The LATEST interaction exchange.\n\n"
                    "Analyze the exchange and identify any persistent biographical facts, professional context (role, skills, OS), interests (likes, dislikes, topics), or general preferences.\n"
                    "You MUST:\n"
                    "- Add new facts to their respective category arrays or key-value fields. Keep facts concise and clear (e.g. \"React\", \"Python\").\n"
                    "- Correct/overwrite existing fields if the user explicitly contradicts or updates past facts (e.g., if location, job, or OS changes).\n"
                    "- Resolve duplicates: do NOT add semantically identical items (e.g. \"enjoys React\" and \"React\").\n"
                    "- Output the updated COMPLETE JSON profile. Do NOT output a diff. Return the full JSON.\n\n"
                    "Output format: You MUST return ONLY a valid JSON object matching the current schema structure. "
                    "Do NOT include any conversational text, markdown code blocks, or explanations. Just return the raw JSON object."
                )
            },
            {
                "role": "user",
                "content": f"CURRENT PROFILE:\n{json.dumps(current_profile, indent=2)}\n\nLATEST CHAT EXCHANGE:\n{latest_turn_text}"
            }
        ]
        
        response_text = call_model_sync(active_model, prompt_messages, keys).strip()
        print(f"DEBUG [ProfileSync]: Raw LLM response: {response_text}")
        
        # Clean up markdown JSON wrappers
        clean_json = response_text
        if clean_json.startswith("```"):
            lines = clean_json.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean_json = "\n".join(lines).strip()
            
        start_idx = clean_json.find("{")
        end_idx = clean_json.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            clean_json = clean_json[start_idx:end_idx+1]
            
        try:
            updated_profile = json.loads(clean_json)
            if isinstance(updated_profile, dict):
                # Save it back
                user.personal_profile = json.dumps(updated_profile)
                db.commit()
                print(f"DEBUG [ProfileSync]: Successfully synchronized personalization profile for user {user_id}.")
            else:
                print(f"WARNING [ProfileSync]: LLM output was not a dictionary: {response_text}")
        except Exception as err:
            print(f"ERROR [ProfileSync]: Failed to parse updated profile JSON: {err}")
    except Exception as e:
        print(f"ERROR [ProfileSync]: Profile sync failed: {e}")
    finally:
        db.close()

