# nextgen-core/backend/database.py
import os
from datetime import datetime
import uuid
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

load_dotenv()

# Neon URLs sometimes start with 'postgres://', which SQLAlchemy 1.4+ rejects.
# We dynamically normalize it to 'postgresql://' for safety.
db_url = os.getenv("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if not db_url:
    # Fail gracefully if DB URL is not set (useful for initial CLI inspections)
    db_url = "sqlite:///./temp_fallback.db"
    print("WARNING: DATABASE_URL not found, using temporary SQLite fallback.")

engine = create_engine(db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """
    Relational User Store.
    Manages emails, authentication credentials, and premium tier flags.
    """
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=True)  # Nullable to support direct Google OAuth login
    is_premium = Column(Boolean, default=False, nullable=False)
    share_profile_memory = Column(Boolean, default=True, nullable=False)
    about_user = Column(Text, nullable=True)             # User biography/preferences
    response_style = Column(Text, nullable=True)         # Custom tone instructions
    personal_profile = Column(Text, default="{}", nullable=False)  # Auto-extracted categorized JSON profile
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserFact(Base):
    """
    User Memory Vault.
    Stores extracted facts, biographical notes, and details about the user
    extracted from their chat history for personalization.
    """
    __tablename__ = "user_facts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=False)
    fact = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    user = relationship("User", backref="facts")


class Message(Base):
    """
    Relational Chat Message Node Store.
    Supports Git-like single-parent context branching trees.
    """
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(100), index=True, nullable=False)
    branch_id = Column(String(100), default="main", nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    parent_node_id = Column(String(36), ForeignKey("messages.id"), index=True, nullable=True)
    role = Column(String(50), nullable=False)  # 'user', 'assistant', 'system_summary'
    content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_condensed = Column(Boolean, default=False, nullable=False)  # True if archived into summary card
    is_pinned = Column(Boolean, default=False, nullable=False)

    # Self-referential relationship for branching tree traversal
    parent = relationship("Message", remote_side=[id], backref="children")
    user = relationship("User", backref="messages")


def init_db():
    """Initializes tables on Neon PostgreSQL / SQLite."""
    Base.metadata.create_all(bind=engine)
    
    # Dynamic schema fallback: Add missing columns if they don't exist
    from sqlalchemy import text
    db = SessionLocal()
    try:
        # Check if messages table has user_id and is_pinned columns
        if engine.dialect.name == "postgresql":
            db.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id VARCHAR(36) REFERENCES users(id);"))
            db.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS about_user TEXT;"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS response_style TEXT;"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_profile TEXT DEFAULT '{}';"))
        else:
            # SQLite fallback: catch exceptions if columns already exist
            try:
                db.execute(text("ALTER TABLE messages ADD COLUMN user_id VARCHAR(36) REFERENCES users(id);"))
            except Exception:
                pass
            try:
                db.execute(text("ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;"))
            except Exception:
                pass
            try:
                db.execute(text("ALTER TABLE users ADD COLUMN about_user TEXT;"))
            except Exception:
                pass
            try:
                db.execute(text("ALTER TABLE users ADD COLUMN response_style TEXT;"))
            except Exception:
                pass
            try:
                db.execute(text("ALTER TABLE users ADD COLUMN personal_profile TEXT DEFAULT '{}';"))
            except Exception:
                pass
        db.commit()
    except Exception as e:
        print(f"WARNING: Schema migration failed: {e}")
    finally:
        db.close()


def save_message(
    session_id: str,
    role: str,
    content: str,
    parent_node_id: str = None,
    branch_id: str = "main",
    model_used: str = None,
    user_id: str = None
) -> Message:
    """Saves a fresh conversation node to PostgreSQL, supporting parent links."""
    db = SessionLocal()
    try:
        msg = Message(
            session_id=session_id,
            role=role,
            content=content,
            parent_node_id=parent_node_id,
            branch_id=branch_id,
            model_used=model_used,
            user_id=user_id
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg
    finally:
        db.close()


def get_path_to_node(node_id: str) -> list:
    """
    Traverses the tree upwards from the target node_id to the root node,
    and returns the chronologically ordered path of Message nodes.
    """
    db = SessionLocal()
    try:
        path = []
        current_id = node_id
        visited = set()  # Prevent infinite loop safety net
        
        while current_id:
            if current_id in visited:
                break
            visited.add(current_id)
            
            msg = db.query(Message).filter(Message.id == current_id).first()
            if not msg:
                break
            # Use db.expunge to safely disconnect the object from the session state
            db.expunge(msg)
            path.append(msg)
            current_id = msg.parent_node_id
            
        # The path was gathered from child to root; reverse it to get chronological order
        path.reverse()
        return path
    finally:
        db.close()


def get_active_context_messages(session_id: str, active_node_id: str = None, last_n: int = 4) -> tuple:
    """
    Retrieves history to feed into the active prompt:
    1. If active_node_id is provided, traverses the branch path from active_node_id to root.
    2. Otherwise, falls back to standard chronological linear session history.
    Splits records into active summaries and unconsolidated active turns.
    """
    if active_node_id:
        path = get_path_to_node(active_node_id)
        summaries = [msg for msg in path if msg.role == "system_summary"]
        recent_turns = [msg for msg in path if msg.role != "system_summary" and not msg.is_condensed]
        return summaries, recent_turns
        
    db = SessionLocal()
    try:
        # Fallback linear summaries (always active)
        summaries = (
            db.query(Message)
            .filter(Message.session_id == session_id, Message.role == "system_summary")
            .order_by(Message.timestamp.asc())
            .all()
        )
        
        # Fallback linear active (uncondensed) recent turns
        recent_turns = (
            db.query(Message)
            .filter(
                Message.session_id == session_id,
                Message.role != "system_summary",
                Message.is_condensed == False
            )
            .order_by(Message.timestamp.desc())
            .limit(last_n)
            .all()
        )
        # Reverse recent turns back to chronological order
        recent_turns.reverse()
        
        return list(summaries), list(recent_turns)
    finally:
        db.close()


def get_uncondensed_count(session_id: str, active_node_id: str = None) -> int:
    """Gets the count of raw, unconsolidated chat turns in the active branch path."""
    if active_node_id:
        path = get_path_to_node(active_node_id)
        return len([msg for msg in path if msg.role != "system_summary" and not msg.is_condensed])
        
    db = SessionLocal()
    try:
        return (
            db.query(Message)
            .filter(
                Message.session_id == session_id,
                Message.role != "system_summary",
                Message.is_condensed == False
            )
            .count()
        )
    finally:
        db.close()


def get_oldest_uncondensed(session_id: str, active_node_id: str = None, count: int = 4) -> list:
    """Fetches the oldest unconsolidated turns along the active branch path to prepare for condensation."""
    if active_node_id:
        path = get_path_to_node(active_node_id)
        uncondensed = [msg for msg in path if msg.role != "system_summary" and not msg.is_condensed]
        return uncondensed[:count]
        
    db = SessionLocal()
    try:
        return (
            db.query(Message)
            .filter(
                Message.session_id == session_id,
                Message.role != "system_summary",
                Message.is_condensed == False
            )
            .order_by(Message.timestamp.asc())
            .limit(count)
            .all()
        )
    finally:
        db.close()


def mark_messages_condensed(message_ids: list):
    """Flags a batch of messages as condensed (archived into a summary card)."""
    if not message_ids:
        return
    db = SessionLocal()
    try:
        db.query(Message).filter(Message.id.in_(message_ids)).update(
            {"is_condensed": True}, synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def clear_session_history(session_id: str):
    """Deletes all messages and summaries for a session."""
    db = SessionLocal()
    try:
        db.query(Message).filter(Message.session_id == session_id).delete()
        db.commit()
    finally:
        db.close()


def get_all_session_nodes(session_id: str) -> list:
    """Retrieves all message nodes in a session to construct the React Flow tree."""
    db = SessionLocal()
    try:
        nodes = db.query(Message).filter(Message.session_id == session_id).order_by(Message.timestamp.asc()).all()
        # Expunge nodes to safely read fields in serialization
        for n in nodes:
            db.expunge(n)
        return nodes
    finally:
        db.close()


def get_user_by_email(email: str) -> User:
    """Queries user record by email."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.expunge(user)
        return user
    finally:
        db.close()


def create_user(email: str, password_hash: str = None, is_premium: bool = False) -> User:
    """Creates a new registered user in the database."""
    db = SessionLocal()
    try:
        user = User(
            email=email,
            password_hash=password_hash,
            is_premium=is_premium
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        db.expunge(user)
        return user
    finally:
        db.close()
