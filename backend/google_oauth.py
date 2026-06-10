# backend/google_oauth.py
import os
import httpx
from typing import Dict, Optional
import jwt
from dotenv import load_dotenv

load_dotenv()

# Google API Credentials (retrieved from Google Developer Console)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
# The redirection endpoint registered in both the Google Console and Next.js callback route
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/callback")


async def exchange_google_code(code: str) -> Optional[Dict]:
    """
    Exchanges a client Google authorization code for verified user information.
    Queries Google endpoints asynchronously and returns decoded claims.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        print("WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing in environment. OAuth disabled.")
        return None

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }

    async with httpx.AsyncClient() as client:
        try:
            # 1. Post request to Google OAuth token server
            response = await client.post(token_url, data=payload, timeout=6.0)
            if response.status_code != 200:
                print(f"ERROR [Google OAuth]: Token exchange failed with status {response.status_code}: {response.text}")
                return None

            token_data = response.json()
            id_token = token_data.get("id_token")
            if not id_token:
                print("ERROR [Google OAuth]: id_token missing in Google credentials payload.")
                return None

            # 2. Extract user info from ID token claims.
            # Signature check is safely bypassed because tokens are retrieved directly via secure server-to-server HTTPS.
            user_claims = jwt.decode(id_token, options={"verify_signature": False})
            return {
                "email": user_claims.get("email"),
                "email_verified": user_claims.get("email_verified", False),
                "name": user_claims.get("name"),
                "picture": user_claims.get("picture")
            }
        except Exception as e:
            print(f"ERROR [Google OAuth]: Exception during authorization code exchange: {e}")
            return None
