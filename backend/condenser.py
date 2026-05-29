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
    condense_size: int = 4
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
            model_used=active_model
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
        
        # 10. Delete associated vector points in Qdrant Cloud to clean up RAG retrieval space
        delete_message_vectors(message_ids)
        
        print(f"DEBUG [Condenser]: Condensation completed successfully. Archived {condense_size} turns into Summary node '{summary_msg_db.id}'.")
        return True
    except Exception as e:
        print(f"ERROR [Condenser]: Condensation process failed. Error: {e}")
        return False
