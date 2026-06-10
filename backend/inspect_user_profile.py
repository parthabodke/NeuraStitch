from database import SessionLocal, User

db = SessionLocal()
try:
    users = db.query(User).all()
    print(f"Total users: {len(users)}")
    for u in users:
        print(f"ID: {u.id}, Email: {u.email}, Share Memory: {u.share_profile_memory}, Profile: '{u.personal_profile}'")
finally:
    db.close()
